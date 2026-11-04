import { afterEach, describe, expect, it } from "vitest";
import type { proto, WAMessage } from "@whiskeysockets/baileys";
import {
  buildTitle,
  extractText,
  getMediaDir,
  hasImage,
  hasVideo,
  isRelevant,
  toIsoTimestamp,
} from "@/whatsapp/normalize";

// messageTimestamp vive en la raiz de WAMessage, no dentro de `message`.
function timestampMsg(value: unknown): WAMessage {
  return { key: { id: "x" }, messageTimestamp: value } as unknown as WAMessage;
}

function content(value: Record<string, unknown>): proto.IMessage {
  return value as unknown as proto.IMessage;
}

describe("extractText", () => {
  it("lee conversation", () => {
    expect(extractText(content({ conversation: "  Hola   mundo " }))).toBe(
      "Hola mundo"
    );
  });

  it("lee extendedTextMessage e image caption", () => {
    expect(
      extractText(
        content({
          extendedTextMessage: { text: "Texto largo" },
          imageMessage: { caption: "Pie de foto" },
        })
      )
    ).toBe("Texto largo Pie de foto");
  });

  it("desenvuelve mensajes efimeros y de una sola vista", () => {
    expect(
      extractText(
        content({
          ephemeralMessage: { message: { conversation: "efimero" } },
        })
      )
    ).toBe("efimero");
    expect(
      extractText(
        content({
          viewOnceMessage: { message: { conversation: "una vez" } },
        })
      )
    ).toBe("una vez");
  });

  it("devuelve vacio sin contenido de texto", () => {
    expect(extractText(null)).toBe("");
    expect(extractText(content({ imageMessage: {} }))).toBe("");
  });
});

describe("hasImage / hasVideo", () => {
  it("detecta imagen directa y envuelta", () => {
    expect(hasImage(content({ imageMessage: { url: "x" } }))).toBe(true);
    expect(
      hasImage(
        content({ viewOnceMessage: { message: { imageMessage: {} } } })
      )
    ).toBe(true);
    expect(hasImage(content({ conversation: "solo texto" }))).toBe(false);
    expect(hasImage(null)).toBe(false);
  });

  it("detecta video", () => {
    expect(hasVideo(content({ videoMessage: {} }))).toBe(true);
    expect(hasVideo(content({ conversation: "texto" }))).toBe(false);
  });
});

describe("isRelevant", () => {
  it("descarta mensajes sin contenido publicable", () => {
    expect(isRelevant(null)).toBe(false);
    expect(isRelevant(content({ reactionMessage: {} }))).toBe(false);
    expect(isRelevant(content({ pollUpdateMessage: {} }))).toBe(false);
    expect(isRelevant(content({ protocolMessage: {} }))).toBe(false);
    expect(isRelevant(content({ stickerMessage: {} }))).toBe(false);
  });

  it("acepta texto o imagen", () => {
    expect(isRelevant(content({ conversation: "noticia" }))).toBe(true);
    expect(isRelevant(content({ imageMessage: {} }))).toBe(true);
  });
});

describe("buildTitle", () => {
  it("usa un titulo por defecto sin texto", () => {
    expect(buildTitle("   ")).toBe("Mensaje de WhatsApp");
  });

  it("colapsa espacios", () => {
    expect(buildTitle("  hola   mundo \n")).toBe("hola mundo");
  });

  it("trunca a 160 caracteres", () => {
    const out = buildTitle("a".repeat(200));
    expect(out).toHaveLength(160);
    expect(out.endsWith("...")).toBe(true);
  });

  it("no trunca textos de 160 o menos", () => {
    const text = "a".repeat(160);
    expect(buildTitle(text)).toBe(text);
  });
});

describe("toIsoTimestamp", () => {
  it("convierte segundos numericos", () => {
    expect(toIsoTimestamp(timestampMsg(1_700_000_000))).toBe(
      new Date(1_700_000_000 * 1000).toISOString()
    );
  });

  it("soporta el objeto Long de Baileys", () => {
    expect(toIsoTimestamp(timestampMsg({ low: 1_700_000_000 }))).toBe(
      new Date(1_700_000_000 * 1000).toISOString()
    );
  });

  it("devuelve undefined para valores ausentes o invalidos", () => {
    expect(toIsoTimestamp(timestampMsg(undefined))).toBeUndefined();
    expect(toIsoTimestamp(timestampMsg(0))).toBeUndefined();
    expect(toIsoTimestamp(timestampMsg("123"))).toBeUndefined();
    expect(toIsoTimestamp(timestampMsg(1e20))).toBeUndefined();
  });
});

describe("getMediaDir", () => {
  const original = process.env.WA_MEDIA_DIR;
  afterEach(() => {
    if (original === undefined) delete process.env.WA_MEDIA_DIR;
    else process.env.WA_MEDIA_DIR = original;
  });

  it("usa la variable de entorno", () => {
    process.env.WA_MEDIA_DIR = "/tmp/media";
    expect(getMediaDir()).toBe("/tmp/media");
  });

  it("cae en public/media/whatsapp", () => {
    delete process.env.WA_MEDIA_DIR;
    expect(getMediaDir()).toBe("public/media/whatsapp");
  });
});
