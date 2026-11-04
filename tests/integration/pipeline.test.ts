import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCategory,
  createRawItem,
  createSource,
  disconnect,
  prisma,
  resetDatabase,
  unique,
} from "../helpers/db";

// El procesamiento de imagenes descarga por red; en integracion se reemplaza
// por un resultado fijo. El resto del pipeline corre contra Postgres real.
vi.mock("@/lib/media/image", () => ({
  processImages: vi.fn(async (urls: string[]) =>
    urls.map((originalUrl, index) => ({
      originalUrl,
      imageUrl: `/media/foto-${index}.jpg`,
      thumbnailUrl: `/media/foto-${index}_thumb.jpg`,
      width: 800,
      height: 600,
      sizeBytes: 1234,
    }))
  ),
}));

import { processAllNew, processRawItem } from "@/lib/pipeline/process";
import { processImages } from "@/lib/media/image";

async function rawWithBody(
  sourceId: string,
  body: string,
  overrides: Parameters<typeof createRawItem>[1] = {}
) {
  return createRawItem(sourceId, {
    payload: {
      title: overrides.title ?? "Titular de prueba",
      body,
      images: [],
      receivedAt: new Date().toISOString(),
    },
    ...overrides,
  });
}

describe("processRawItem", () => {
  beforeEach(async () => {
    await resetDatabase();
    vi.mocked(processImages).mockClear();
  });

  afterAll(async () => {
    await disconnect();
  });

  it("crea un borrador y marca el RawItem como procesado", async () => {
    const source = await createSource({ autopublish: false });
    const raw = await rawWithBody(source.id, "<p>Cuerpo</p>");

    const post = await processRawItem(raw.id);

    expect(post).not.toBeNull();
    expect(post?.status).toBe("DRAFT");
    expect(post?.publishedAt).toBeNull();
    expect(post?.rawItemId).toBe(raw.id);
    expect(post?.sourceId).toBe(source.id);

    const updated = await prisma.rawItem.findUniqueOrThrow({
      where: { id: raw.id },
    });
    expect(updated.status).toBe("PROCESSED");
    expect(updated.processedAt).not.toBeNull();
  });

  it("publica directo cuando la fuente tiene autopublish", async () => {
    const source = await createSource({ autopublish: true });
    const raw = await rawWithBody(source.id, "<p>Cuerpo</p>");

    const post = await processRawItem(raw.id);

    expect(post?.status).toBe("PUBLISHED");
    expect(post?.publishedAt).toBeInstanceOf(Date);
  });

  it("options.autoPublish tambien publica", async () => {
    const source = await createSource({ autopublish: false });
    const raw = await rawWithBody(source.id, "<p>Cuerpo</p>");

    const post = await processRawItem(raw.id, { autoPublish: true });

    expect(post?.status).toBe("PUBLISHED");
    expect(post?.publishedAt).toBeInstanceOf(Date);
  });

  it("sanea el HTML del cuerpo (no guarda script ni onerror)", async () => {
    const source = await createSource();
    const raw = await rawWithBody(
      source.id,
      '<p>Hola <strong>mundo</strong></p><script>alert("xss")</script>' +
        '<img src="https://example.test/a.jpg" onerror="alert(1)">'
    );

    const post = await processRawItem(raw.id);

    expect(post?.bodyHtml).toContain("<strong>mundo</strong>");
    expect(post?.bodyHtml).not.toContain("<script");
    expect(post?.bodyHtml).not.toContain("onerror");
    expect(post?.bodyHtml).not.toContain("alert");
  });

  it("asigna la categoria detectada cuando existe en la base", async () => {
    const source = await createSource();
    const category = await createCategory({ name: "UNJBG", slug: "unjbg" });
    const raw = await rawWithBody(
      source.id,
      "La Universidad Nacional Jorge Basadre Grohmann anuncio medidas."
    );

    const post = await processRawItem(raw.id);

    expect(post?.categoryId).toBe(category.id);
  });

  it("deja la categoria en null si la detectada no esta creada", async () => {
    const source = await createSource();
    const raw = await rawWithBody(
      source.id,
      "La Universidad Nacional Jorge Basadre Grohmann anuncio medidas."
    );

    const post = await processRawItem(raw.id);

    expect(post?.categoryId).toBeNull();
  });

  it("guarda las imagenes procesadas en la portada y en imageMeta", async () => {
    const source = await createSource();
    const raw = await rawWithBody(source.id, "<p>Cuerpo</p>", {
      images: [
        "https://example.test/a.jpg",
        "https://example.test/b.jpg",
      ],
    });

    const post = await processRawItem(raw.id);

    expect(processImages).toHaveBeenCalledTimes(1);
    expect(post?.imageUrl).toBe("/media/foto-0.jpg");
    expect(post?.thumbnailUrl).toBe("/media/foto-0_thumb.jpg");
    expect(post?.imageMeta).toEqual([
      expect.objectContaining({ originalUrl: "https://example.test/a.jpg" }),
      expect.objectContaining({ originalUrl: "https://example.test/b.jpg" }),
    ]);
  });

  it("actualiza searchVector para la busqueda full-text", async () => {
    const source = await createSource();
    const raw = await rawWithBody(
      source.id,
      "El congreso aprobo una ley nacional"
    );

    const post = await processRawItem(raw.id);

    const rows = await prisma.$queryRaw<{ vector: string | null }[]>`
      SELECT "searchVector"::text AS vector FROM "Post" WHERE id = ${post!.id}
    `;
    expect(rows[0]?.vector).toBeTruthy();
    expect(rows[0]?.vector).toContain("congres");
  });

  it("es idempotente: no duplica el post ni vuelve a procesar", async () => {
    const source = await createSource();
    const raw = await rawWithBody(source.id, "<p>Cuerpo</p>");

    const first = await processRawItem(raw.id);
    const second = await processRawItem(raw.id);

    expect(second).toBeNull();
    await expect(prisma.post.count()).resolves.toBe(1);
    expect(first?.id).toBeTruthy();
  });

  it("devuelve null para items inexistentes o ya procesados", async () => {
    await expect(processRawItem("no-existe")).resolves.toBeNull();

    const source = await createSource();
    const raw = await createRawItem(source.id, { status: "PROCESSED" });
    await expect(processRawItem(raw.id)).resolves.toBeNull();
  });
});

describe("processAllNew", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnect();
  });

  it("procesa todos los items NEW sin post y los deja PROCESSED", async () => {
    const source = await createSource();
    const a = await rawWithBody(source.id, "<p>Uno</p>", {
      title: unique("Noticia uno"),
    });
    const b = await rawWithBody(source.id, "<p>Dos</p>", {
      title: unique("Noticia dos"),
    });

    const posts = await processAllNew();

    expect(posts).toHaveLength(2);
    expect(posts.every((p) => p?.status === "DRAFT")).toBe(true);
    await expect(
      prisma.rawItem.count({ where: { status: "PROCESSED" } })
    ).resolves.toBe(2);
    expect([a.id, b.id]).toHaveLength(2);
  });

  it("no reprocesa items ya procesados", async () => {
    const source = await createSource();
    await rawWithBody(source.id, "<p>Uno</p>");
    await rawWithBody(source.id, "<p>Dos</p>", { status: "PROCESSED" });

    const posts = await processAllNew();

    expect(posts).toHaveLength(1);
    await expect(prisma.post.count()).resolves.toBe(1);
  });
});
