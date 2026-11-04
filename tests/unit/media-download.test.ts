import { afterEach, describe, expect, it } from "vitest";
import path from "path";
import {
  getMediaDir,
  getRelativeMediaPath,
  hashUrl,
  sanitizeFilename,
} from "@/lib/media/download";

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("hashUrl", () => {
  it("es determinista y de 64 caracteres hex", () => {
    const a = hashUrl("https://example.test/a.jpg");
    const b = hashUrl("https://example.test/a.jpg");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("cambia con la URL", () => {
    expect(hashUrl("https://example.test/a.jpg")).not.toBe(
      hashUrl("https://example.test/b.jpg")
    );
  });
});

describe("sanitizeFilename", () => {
  it("conserva la extension segura y agrega hash", () => {
    const name = sanitizeFilename("https://example.test/foto.jpg?size=large");
    expect(name).toMatch(/^\d+-[0-9a-f]{10}\.jpg$/);
  });

  it("limpia extensiones con caracteres raros", () => {
    const name = sanitizeFilename("https://example.test/foto.jp%67");
    expect(name).not.toContain("%");
    expect(name).toMatch(/\.j/);
  });

  it("usa .jpg cuando la URL no tiene extension", () => {
    const name = sanitizeFilename("https://example.test/articulo");
    expect(name).toMatch(/\.jpg$/);
  });
});

describe("getRelativeMediaPath", () => {
  it("convierte public/media en /media", () => {
    process.env.WA_MEDIA_DIR = "public/media";
    expect(getRelativeMediaPath("foto.jpg")).toBe("/media/foto.jpg");
  });

  it("acepta la forma ./public/media", () => {
    process.env.WA_MEDIA_DIR = "./public/media";
    expect(getRelativeMediaPath("foto.jpg")).toBe("/media/foto.jpg");
  });

  it("conserva subcarpetas", () => {
    process.env.WA_MEDIA_DIR = "public/media/whatsapp";
    expect(getRelativeMediaPath("foto.jpg")).toBe("/media/whatsapp/foto.jpg");
  });

  it("deja intacta una ruta absoluta", () => {
    process.env.WA_MEDIA_DIR = "/var/lib/unjbg/media/";
    expect(getRelativeMediaPath("foto.jpg")).toBe("/var/lib/unjbg/media/foto.jpg");
  });
});

describe("getMediaDir", () => {
  it("resuelve la ruta configurada", () => {
    process.env.WA_MEDIA_DIR = "public/media";
    expect(getMediaDir()).toBe(path.resolve("public/media"));
  });
});
