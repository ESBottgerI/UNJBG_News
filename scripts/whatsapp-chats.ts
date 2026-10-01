import { createSocket, getAuthDir } from "../src/whatsapp/session";
import type { Chat } from "@whiskeysockets/baileys";

// Lista los chats (grupos y canales) a los que la cuenta esta suscrita, para
// poder configurarlos como fuentes con su JID.
//
//   npm run whatsapp:chats
//   npm run whatsapp:chats -- https://whatsapp.com/channel/0029Va9vcYKGgYKQNc8wUd
//
// Los grupos se descubren del sync inicial. Los canales NO se pueden listar
// (la libreria no expone los canales seguidos), asi que hay que pasar su link
// de invitacion como argumento: el script lo resuelve a su JID.

const QUIET_MS = 6_000;
const MAX_WAIT_MS = 60_000;

type Found = { jid: string; name: string };

const groups = new Map<string, Found>();
const channels = new Map<string, Found>();
let quietTimer: NodeJS.Timeout | null = null;
let printed = false;

function schedulePrint(): void {
  if (quietTimer) clearTimeout(quietTimer);
  quietTimer = setTimeout(printAndExit, QUIET_MS);
}

function printAndExit(): void {
  if (printed) return;
  printed = true;

  console.log("\n=== GRUPOS (copiar el jid en source.config.chatId) ===");
  if (groups.size === 0) {
    console.log("  (ninguno: la cuenta no esta en ningun grupo)");
  }
  for (const g of [...groups.values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  )) {
    console.log(`  ${g.jid}  ${g.name}`);
  }

  console.log("\n=== CANALES ===");
  if (channels.size === 0) {
    console.log(
      "  (ninguno. Para sumar uno, pasa su link: npm run whatsapp:chats -- <link>)"
    );
  }
  for (const c of [...channels.values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  )) {
    console.log(`  ${c.jid}  ${c.name}`);
  }

  process.exit(0);
}

function ingestChat(chat: Chat | undefined): void {
  const jid = chat?.id;
  if (!jid) return;
  const name = chat?.name?.trim() || jid;

  if (jid.endsWith("@g.us")) {
    groups.set(jid, { jid, name });
    schedulePrint();
  } else if (jid.endsWith("@newsletter")) {
    channels.set(jid, { jid, name });
    schedulePrint();
  }
}

async function resolveChannels(
  sock: Awaited<ReturnType<typeof createSocket>>["sock"],
  links: string[]
): Promise<void> {
  if (links.length === 0) return;

  for (const link of links) {
    try {
      // Acepta el link completo o solo el codigo final.
      const code = link.trim().split("/").filter(Boolean).pop() ?? link;
      const meta = await sock.newsletterMetadata("invite", code);
      if (meta?.id) {
        channels.set(meta.id, { jid: meta.id, name: meta.name ?? meta.id });
        console.log(`Canal resuelto: ${meta.name} -> ${meta.id}`);
      } else {
        console.log(`No se pudo resolver el canal: ${link}`);
      }
    } catch (error) {
      console.log(
        `Error resolviendo ${link}:`,
        error instanceof Error ? error.message : error
      );
    }
  }
}

async function main(): Promise<void> {
  const links = process.argv.slice(2);
  const { sock } = await createSocket();

  const maxWait = setTimeout(printAndExit, MAX_WAIT_MS);

  sock.ev.on("chats.upsert", (chats) => {
    for (const chat of chats) ingestChat(chat);
  });

  sock.ev.on("messaging-history.set", ({ chats: historyChats }) => {
    for (const chat of historyChats ?? []) ingestChat(chat as Chat);
  });

  sock.ev.on("connection.update", async (update) => {
    if (update.connection === "open") {
      console.log("Conectado. Sincronizando chats...");
      await resolveChannels(sock, links);
      // Margen para que llegue el sync inicial antes de imprimir.
      schedulePrint();
    }

    if (update.connection === "close") {
      clearTimeout(maxWait);
      console.log("\nSe cerro la conexion.");
      console.log(
        `Si es la primera vez, empareja antes: npm run whatsapp:pair (${getAuthDir()})`
      );
      process.exit(1);
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});