import type {
  GroupMetadata,
  proto,
  WASocket,
  WAMessageKey,
} from "@whiskeysockets/baileys";

// Baileys no exporta su ILogger desde la raiz (vive en lib/Utils/logger, que no
// se reexporta), asi que se replica aqui la forma que espera SocketConfig.
type ILogger = {
  level: string;
  child(obj: Record<string, unknown>): ILogger;
  trace(obj: unknown, msg?: string): void;
  debug(obj: unknown, msg?: string): void;
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
};

// Sesion de WhatsApp (Baileys) para la Fase 4.
//
// Baileys 7 es ESM puro y este proyecto compila a CommonJS, asi que el paquete
// se carga con import() dinamico (ver loadBaileys). Los imports de arriba son
// solo de tipo y desaparecen al compilar.
//
// El socket es una conexion WebSocket persistente: por eso vive en un proceso
// aparte (scripts/whatsapp-*.ts) y no dentro del servidor de Next.js.

export const WA_BROWSER_NAME = "UNJBG News Bot";

// Prioridades de log: un nivel se escribe si su numero es <= al configurado.
const LOG_LEVELS: Record<string, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  silent: 5,
};

// Logger propio en lugar del de pino: permite silenciar el ruido de libsignal
// (criptografia de Signal, muy verbosa) sin agregar una dependencia mas.
function createLogger(): ILogger {
  const configured = process.env.WA_LOG_LEVEL ?? "warn";
  const threshold = LOG_LEVELS[configured] ?? LOG_LEVELS.warn;

  const write =
    (level: string) =>
    (obj: unknown, msg?: string): void => {
      if (LOG_LEVELS[level] > threshold) return;
      const text =
        typeof obj === "string" ? obj : JSON.stringify(obj);
      const line = `[wa] ${level.toUpperCase()} ${msg ?? ""} ${text}`.trim();
      if (level === "error") console.error(line);
      else console.log(line);
    };

  const logger: ILogger = {
    level: configured,
    trace: write("trace"),
    debug: write("debug"),
    info: write("info"),
    warn: write("warn"),
    error: write("error"),
    child() {
      return logger;
    },
  };
  return logger;
}

export function getAuthDir(): string {
  return process.env.WA_AUTH_DIR ?? "./.wa-auth";
}

// Tipo del modulo completo, para no perder el tipado tras el import dinamico.
export type BaileysModule = typeof import("@whiskeysockets/baileys");

let baileysPromise: Promise<BaileysModule> | null = null;

export function loadBaileys(): Promise<BaileysModule> {
  if (!baileysPromise) {
    baileysPromise = import("@whiskeysockets/baileys");
  }
  return baileysPromise;
}

// Baileys 7 elimino el store en memoria: el cache de mensajes se mantiene aca
// para implementar getMessage (necesario para que WhatsApp pueda reenviar
// mensajes que no se pudieron descifrar). Es una cola FIFO acotada para que
// un worker de larga duracion no crezca sin limite.
const MESSAGE_CACHE_LIMIT = 500;
const messageCache = new Map<string, proto.IMessage | undefined>();

function cacheKey(key: WAMessageKey): string {
  return `${key.remoteJid ?? ""}:${key.id ?? ""}`;
}

export function cacheMessage(
  key: WAMessageKey,
  message: proto.IMessage | undefined
): void {
  const id = key.id;
  if (!id) return;
  messageCache.set(cacheKey(key), message);
  if (messageCache.size > MESSAGE_CACHE_LIMIT) {
    const oldest = messageCache.keys().next();
    if (!oldest.done) messageCache.delete(oldest.value);
  }
}

async function getCachedMessage(
  key: WAMessageKey
): Promise<proto.IMessage | undefined> {
  return messageCache.get(cacheKey(key));
}

// Cache de metadata de grupos para no pegarle a WhatsApp en cada mensaje.
const groupMetadataCache = new Map<string, GroupMetadata>();

export async function getCachedGroupMetadata(
  jid: string
): Promise<GroupMetadata | undefined> {
  return groupMetadataCache.get(jid);
}

export function cacheGroupMetadata(
  jid: string,
  metadata: GroupMetadata | undefined
): void {
  if (!metadata) return;
  groupMetadataCache.set(jid, metadata);
  if (groupMetadataCache.size > MESSAGE_CACHE_LIMIT) {
    const oldest = groupMetadataCache.keys().next();
    if (!oldest.done) groupMetadataCache.delete(oldest.value);
  }
}

export type WhatsAppSession = {
  sock: WASocket;
  saveCreds: () => Promise<void>;
};

// Crea el socket con la sesion guardada en disco (WA_AUTH_DIR).
export async function createSocket(): Promise<WhatsAppSession> {
  const B = await loadBaileys();
  const logger = createLogger();
  // Alias: el nombre original empieza con "use" y la regla de react-hooks lo
  // marca como Hook (falso positivo; es una funcion de Baileys).
  const loadAuthState = B.useMultiFileAuthState;
  const { state, saveCreds } = await loadAuthState(getAuthDir());

  const sock = B.makeWASocket({
    auth: {
      creds: state.creds,
      keys: B.makeCacheableSignalKeyStore(state.keys, logger),
    },
    // macOS como cliente de escritorio: es lo que hace que WhatsApp entregue
    // el historial completo en el sync inicial (los perfiles Chrome lo recortan).
    browser: B.Browsers.macOS(WA_BROWSER_NAME),
    syncFullHistory: true,
    // false = no marcar el numero como "en linea" desde la sesion del bot, para
    // que el celular personal siga funcionando con normalidad y sin el consumo
    // extra de bateria de una sesion web activa.
    markOnlineOnConnect: false,
    logger,
    getMessage: getCachedMessage,
    cachedGroupMetadata: getCachedGroupMetadata,
  });

  return { sock, saveCreds };
}