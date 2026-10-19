import type { Source } from "@prisma/client";
import { ingestItem } from "../lib/ingest";
import { processRawItem } from "../lib/pipeline/process";
import { prisma } from "../lib/prisma";
import {
  cacheMessage,
  createSocket,
  getAuthDir,
  type WhatsAppSession,
} from "./session";
import {
  buildTitle,
  downloadImage,
  extractText,
  hasImage,
  isRelevant,
  toIsoTimestamp,
} from "./normalize";
import type { WAMessage } from "@whiskeysockets/baileys";

// Worker de WhatsApp (Fase 4).
//
// Se corre como proceso aparte (npm run whatsapp:start), no dentro de Next.js,
// porque el socket es una conexion WebSocket persistente que el servidor web y
// su hot-reload cortarian.
//
// A diferencia de los adaptadores web (pull / node-cron), aca todo es push: los
// mensajes llegan por eventos y se mandan directo al pipeline de ingesta, que
// es quien hace dedup y los deja en la cola de moderacion.

const MAX_RECONNECT_DELAY_MS = 60_000;

// Mapa de fuentes de WhatsApp indexadas por el jid del chat/grupo/canal.
let sourcesByChat = new Map<string, Source>();

export async function loadWhatsAppSources(): Promise<Map<string, Source>> {
  const sources = await prisma.source.findMany({
    where: { type: "WHATSAPP", status: "ACTIVE" },
  });

  const map = new Map<string, Source>();
  for (const source of sources) {
    const config = (source.config ?? {}) as Record<string, unknown>;
    const chatId = typeof config.chatId === "string" ? config.chatId : "";
    if (!chatId) {
      console.log(
        `[wa] fuente "${source.name}" sin config.chatId; ignorada hasta configurarla`
      );
      continue;
    }
    map.set(chatId, source);
  }
  return map;
}

function backfillCutoff(): number {
  const hours = Number(process.env.WA_BACKFILL_HOURS ?? "24");
  return Date.now() - hours * 3_600_000;
}

async function ingestOne(message: WAMessage): Promise<void> {
  const chatJid = message.key?.remoteJid ?? "";
  const messageId = message.key?.id ?? "";

  if (!chatJid || !messageId) return;

  // Solo los chats configurados como fuente; el resto se ignora en silencio
  // (la cuenta de WhatsApp puede estar en muchos grupos ajenos al proyecto).
  const source = sourcesByChat.get(chatJid);
  if (!source) return;

  // Mensajes propios no son noticia.
  if (message.key.fromMe) return;

  const content = message.message ?? null;
  if (!isRelevant(content)) return;

  const text = extractText(content);
  if (!text && !hasImage(content)) return;

  let images: string[] = [];
  if (hasImage(content)) {
    try {
      const url = await downloadImage(message);
      if (url) images = [url];
    } catch (error) {
      // La imagen es opcional: si no se puede bajar, la noticia igual entra.
      console.log(
        `[wa] no se pudo bajar imagen de ${chatJid}:${messageId}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  const result = await ingestItem({
    sourceId: source.id,
    externalId: `${chatJid}:${messageId}`,
    title: buildTitle(text),
    body: text,
    images,
    publishedAt: toIsoTimestamp(message),
  });

  if (result.ok && !result.duplicate) {
    try { await processRawItem(result.rawItemId); } catch (e) { console.error('pipeline error', e); }
    console.log(`[wa] mensaje nuevo de ${source.name}`);
  }
}

// Backfill del historial: solo mensajes de los chats configurados dentro de la
// ventana de WA_BACKFILL_HOURS. Los canales no llegan por historial.
async function ingestHistory(messages: WAMessage[]): Promise<void> {
  const cutoff = backfillCutoff();

  for (const message of messages) {
    const chatJid = message.key?.remoteJid ?? "";
    if (!sourcesByChat.has(chatJid)) continue;
    if (message.key?.fromMe) continue;

    const timestamp = toIsoTimestamp(message);
    if (timestamp && new Date(timestamp).getTime() < cutoff) continue;

    await ingestOne(message);
  }
}

export async function startWorker(): Promise<void> {
  sourcesByChat = await loadWhatsAppSources();
  console.log(
    `[wa] ${sourcesByChat.size} fuentes de WhatsApp activas (sesion: ${getAuthDir()})`
  );
  if (sourcesByChat.size === 0) {
    console.log(
      "[wa] configuralas con el chatId que imprime `npm run whatsapp:chats`"
    );
  }

  let reconnectDelay = 1_000;

  for (;;) {
    // Si ni siquiera se puede abrir el socket (red caida, credenciales a medio
    // escribir), se reintenta con backoff en vez de tumbar el proceso.
    let session: WhatsAppSession;
    try {
      session = await createSocket();
    } catch (error) {
      console.error(
        "[wa] no se pudo abrir la conexion:",
        error instanceof Error ? error.message : error
      );
      await new Promise((r) => setTimeout(r, reconnectDelay));
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
      continue;
    }

    const { sock, saveCreds } = session;

    const closed = await new Promise<boolean>((resolve) => {
      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("messages.upsert", async ({ type, messages }) => {
        // "notify" son mensajes nuevos; "append" son mensajes ya vistos.
        for (const message of messages) {
          if (message.message) {
            cacheMessage(message.key, message.message);
          }
          if (type !== "notify") continue;
          try {
            await ingestOne(message);
          } catch (error) {
            console.error(
              "[wa] error ingiriendo mensaje:",
              error instanceof Error ? error.message : error
            );
          }
        }
      });

      sock.ev.on("messaging-history.set", async ({ messages }) => {
        const total = messages?.length ?? 0;
        console.log(`[wa] historial recibido: ${total} mensajes`);
        try {
          await ingestHistory(messages ?? []);
        } catch (error) {
          console.error(
            "[wa] error en backfill:",
            error instanceof Error ? error.message : error
          );
        }
      });

      sock.ev.on("connection.update", (update) => {
        if (update.connection === "open") {
          console.log("[wa] conectado a WhatsApp");
          reconnectDelay = 1_000;
          return;
        }
        if (update.connection !== "close") return;

        const error = update.lastDisconnect?.error as
          | { output?: { statusCode?: number } }
          | undefined;
        const statusCode = error?.output?.statusCode;

        // 401 = sesion invalida / cerrada: reintentar no sirve de nada.
        if (statusCode === 401) {
          console.error(
            `[wa] la sesion fue cerrada por WhatsApp. Borra ${getAuthDir()} y vuelve a emparejar.`
          );
          resolve(false);
          return;
        }

        console.log(
          `[wa] conexion cerrada (codigo ${statusCode ?? "desconocido"}); reconectando...`
        );
        resolve(true);
      });
    });

    // El socket viejo se descarta en cada vuelta del bucle: se cierra para
    // liberar la conexion antes de que el bucle cree el siguiente.
    try {
      sock.end(undefined);
    } catch {
      // Ya estaba cerrado; no hay nada que hacer.
    }

    // false = se cerro por un error fatal, no se reintenta.
    if (!closed) return;

    await new Promise((r) => setTimeout(r, reconnectDelay));
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
  }
}