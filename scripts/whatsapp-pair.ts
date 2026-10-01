import qrcode from "qrcode-terminal";
import { createSocket, getAuthDir, loadBaileys } from "../src/whatsapp/session";

// Empareja la cuenta de WhatsApp con el bot (Fase 4).
//
//   npm run whatsapp:pair
//
// Se escanea un QR desde el celular, o se usa el codigo de 8 digitos si se
// define WA_PHONE en .env (util por SSH, donde no se puede escanear).
//
// La sesion queda en WA_AUTH_DIR. Mientras no se borre ese directorio, no hay
// que volver a escanear el QR.

const PAIRING_TIMEOUT_MS = 5 * 60_000;

let paired = false;

function showQr(qr: string): void {
  console.log("\nEscanea este QR desde el celular en:");
  console.log("  WhatsApp > Ajustes > Dispositivos vinculados > Vincular dispositivo\n");
  qrcode.generate(qr, { small: true }, (code: string) => console.log(code));
}

async function main(): Promise<void> {
  const B = await loadBaileys();
  const { sock, saveCreds } = await createSocket();
  const phone = process.env.WA_PHONE?.replace(/\D/g, "");

  const timeout = setTimeout(() => {
    console.error("\nSe agoto el tiempo de espera (5 min). Vuelve a intentarlo.");
    process.exit(1);
  }, PAIRING_TIMEOUT_MS);

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    if (update.qr) {
      showQr(update.qr);
    }

    if (update.connection === "open") {
      const me = sock.authState?.creds?.me;
      if (me?.id && paired === false) {
        paired = true;
        clearTimeout(timeout);
        console.log(`\nEmparejado correctamente como ${me.id}.`);
        console.log(`Sesion guardada en: ${getAuthDir()}`);
        sock.ev.removeAllListeners("connection.update");
        setTimeout(() => process.exit(0), 300);
      }
      return;
    }

    if (update.connection === "close") {
      const error = update.lastDisconnect?.error as
        | { output?: { statusCode?: number } }
        | undefined;
      const statusCode = error?.output?.statusCode;

      if (statusCode === B.DisconnectReason.restartRequired) {
        // WhatsApp pide reiniciar el socket tras vincular: es normal.
        clearTimeout(timeout);
        console.log("\nVinculacion aceptada. Reiniciando el socket...");
        setTimeout(() => process.exit(0), 300);
        return;
      }

      if (statusCode === B.DisconnectReason.loggedOut) {
        clearTimeout(timeout);
        console.error(
          "\nWhatsApp cerro la sesion. Borra " +
            getAuthDir() +
            " y empareja de nuevo."
        );
        process.exit(1);
      }
    }
  });

  // Si ya hay sesion guardada, se reconecta sola y no hace falta QR.
  if (sock.authState?.creds?.registered && !phone) {
    console.log("Ya hay una sesion guardada; reconectando...");
  }

  console.log("Esperando emparejamiento...");
  console.log(`(sesion: ${getAuthDir()})`);

  if (phone) {
    // El codigo de 8 digitos se pide una vez que el socket esta abierto.
    sock.ev.on("connection.update", async (update) => {
      if (update.connection !== "open") return;
      try {
        const code = await sock.requestPairingCode(phone);
        console.log(`\nCodigo de vinculacion: ${code}`);
        console.log(
          "En el celular: Ajustes > Dispositivos vinculados > " +
            "Vincular con numero de telefono, e ingresalo."
        );
      } catch (error) {
        console.error(
          "No se pudo obtener el codigo de vinculacion:",
          error instanceof Error ? error.message : error
        );
      }
    });
  }

  // El proceso queda vivo escuchando eventos hasta emparejar o expirar.
  await new Promise(() => {});
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});