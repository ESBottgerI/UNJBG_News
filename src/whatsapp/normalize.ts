import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import type { proto, WAMessage } from "@whiskeysockets/baileys";
import { loadBaileys } from "./session";

// Normaliza un mensaje de WhatsApp al formato que espera el pipeline de ingesta.
//
// Los mensajes de WhatsApp no traen "titulo": se arma con el comienzo del texto,
// igual que hace el adaptador de Facebook con las publicaciones.

// Un mensaje puede venir envuelto en capas (efimeros, ver una vez, reenvios).
// Se desenvuelve hasta llegar al contenido real.
function unwrap(
  message: proto.IMessage | null | undefined
): proto.IMessage | null {
  let current = message;
  for (let i = 0; i < 5 && current; i++) {
    if (current.ephemeralMessage?.message) {
      current = current.ephemeralMessage.message;
    } else if (current.viewOnceMessage?.message) {
      current = current.viewOnceMessage.message;
    } else if (current.documentWithCaptionMessage?.message) {
      current = current.documentWithCaptionMessage.message;
    } else {
      return current;
    }
  }
  return current ?? null;
}

// Texto del mensaje, incluyendo el pie de foto de imagenes y videos.
export function extractText(message: proto.IMessage | null): string {
  const inner = unwrap(message);
  if (!inner) return "";

  const parts: string[] = [];
  if (inner.conversation) parts.push(inner.conversation);
  if (inner.extendedTextMessage?.text) parts.push(inner.extendedTextMessage.text);
  if (inner.imageMessage?.caption) parts.push(inner.imageMessage.caption);
  if (inner.videoMessage?.caption) parts.push(inner.videoMessage.caption);
  if (inner.documentMessage?.caption) parts.push(inner.documentMessage.caption);

  return parts.join("\n").replace(/\s+/g, " ").trim();
}

// true si el mensaje trae una imagen (incluida la de un video, como portada).
export function hasImage(message: proto.IMessage | null): boolean {
  const inner = unwrap(message);
  return Boolean(inner?.imageMessage);
}

export function hasVideo(message: proto.IMessage | null): boolean {
  const inner = unwrap(message);
  return Boolean(inner?.videoMessage);
}

// Marca los mensajes que no son contenido publicable por si solos.
export function isRelevant(message: proto.IMessage | null): boolean {
  if (!message) return false;
  if (message.reactionMessage) return false;
  if (message.pollUpdateMessage) return false;
  if (message.protocolMessage) return false;
  const inner = unwrap(message);
  if (!inner) return false;
  // Sin texto ni imagen no hay noticia: stickers, contactos, ubicaciones, etc.
  return extractText(inner).length > 0 || hasImage(inner);
}

export function buildTitle(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "Mensaje de WhatsApp";
  return clean.length > 160 ? `${clean.slice(0, 157)}...` : clean;
}

// Timestamp en segundos; se normaliza a ISO para el campo publishedAt.
export function toIsoTimestamp(message: WAMessage): string | undefined {
  const raw = message.messageTimestamp as unknown;
  let seconds: number | undefined;
  if (typeof raw === "number") seconds = raw;
  else if (raw && typeof raw === "object" && "low" in (raw as Record<string, unknown>)) {
    const low = (raw as { low?: unknown }).low;
    if (typeof low === "number") seconds = low;
  }
  if (seconds == null || seconds <= 0) return undefined;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function getMediaDir(): string {
  return process.env.WA_MEDIA_DIR ?? "public/media/whatsapp";
}

// Descarga la imagen del mensaje a disco. El nombre es el hash del contenido:
// dos mensajes con la misma foto reutilizan el mismo archivo.
export async function downloadImage(
  message: WAMessage
): Promise<string | null> {
  // Baileys es ESM puro: se carga en dinamico, no con import estatico.
  const B = await loadBaileys();
  if (!hasImage(message.message ?? null)) return null;

  const buffer = await B.downloadMediaMessage(message, "buffer", {});
  if (!buffer || buffer.length === 0) return null;

  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 32);
  const dir = getMediaDir();
  await mkdir(dir, { recursive: true });

  const file = join(dir, `${hash}.jpg`);
  await writeFile(file, buffer);
  return `/media/whatsapp/${hash}.jpg`;
}