import "../src/lib/env";
import { existsSync } from "fs";
import { prisma } from "../src/lib/prisma";
import { startWorker } from "../src/whatsapp/worker";
import { getAuthDir } from "../src/whatsapp/session";

// Arranca el worker de WhatsApp (Fase 4).
//
//   npm run whatsapp:start
//
// Escucha los chats/canales configurados como fuentes y los manda al pipeline
// de ingesta. Se mantiene corriendo hasta que se interrumpa (Ctrl+C).

async function main(): Promise<void> {
  if (process.env.ENABLE_WHATSAPP_WORKER === "false") {
    console.log("[wa] ENABLE_WHATSAPP_WORKER=false; worker no iniciado.");
    return;
  }

  // Sin sesion guardada el worker no tiene nada que hacer: avisar en lugar de
  // fallar con un error criptico de Baileys.
  if (!existsSync(getAuthDir())) {
    console.error(
      `[wa] no hay sesion en ${getAuthDir()}. Empareja primero:`
    );
    console.error("     npm run whatsapp:pair");
    process.exit(1);
  }

  // Salir limpiamente: corta el socket y desconecta la base de datos.
  const shutdown = (signal: string) => {
    console.log(`\n[wa] ${signal}: cerrando worker...`);
    prisma
      .$disconnect()
      .then(() => process.exit(0))
      .catch(() => process.exit(0));
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  await startWorker();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});