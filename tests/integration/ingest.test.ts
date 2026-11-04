import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createRawItem,
  createSource,
  disconnect,
  prisma,
  resetDatabase,
} from "../helpers/db";
import { ingestItem } from "@/lib/ingest";

describe("ingestItem", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnect();
  });

  it("rechaza items sin externalId", async () => {
    const result = await ingestItem({ externalId: "   " });
    expect(result).toMatchObject({
      ok: false,
      error: { status: 400 },
    });
  });

  it("exige sourceId o sourceName+sourceType", async () => {
    const result = await ingestItem({ externalId: "ext-1" });
    expect(result).toMatchObject({
      ok: false,
      error: { status: 400 },
    });
  });

  it("devuelve 404 si el sourceId no existe", async () => {
    const result = await ingestItem({
      sourceId: "no-existe",
      externalId: "ext-1",
    });
    expect(result).toMatchObject({
      ok: false,
      error: { status: 404 },
    });
  });

  it("devuelve 404 si no hay fuente con ese nombre y tipo", async () => {
    const result = await ingestItem({
      sourceName: "Inexistente",
      sourceType: "RSS",
      externalId: "ext-1",
    });
    expect(result).toMatchObject({
      ok: false,
      error: { status: 404 },
    });
  });

  it("resuelve la fuente por nombre+tipo cuando no hay sourceId", async () => {
    const source = await createSource({ name: "Feed UNJBG", type: "RSS" });

    const result = await ingestItem({
      sourceName: "Feed UNJBG",
      sourceType: "RSS",
      externalId: "ext-name",
      title: "Titulo",
    });

    expect(result).toMatchObject({ ok: true, duplicate: false });
    const stored = await prisma.rawItem.findUnique({
      where: { id: (result as { rawItemId: string }).rawItemId },
    });
    expect(stored?.sourceId).toBe(source.id);
  });

  it("crea el RawItem con payload normalizado y estado NEW", async () => {
    const source = await createSource();
    const result = await ingestItem({
      sourceId: source.id,
      externalId: "ext-1",
      title: "  Titular  ",
      body: "<p>Cuerpo</p>",
      images: ["https://example.test/a.jpg", 42 as unknown as string, "b.png"],
      publishedAt: "2026-10-18T10:00:00.000Z",
    });

    expect(result).toMatchObject({ ok: true, duplicate: false });
    const id = (result as { rawItemId: string }).rawItemId;
    const raw = await prisma.rawItem.findUniqueOrThrow({ where: { id } });

    expect(raw.status).toBe("NEW");
    expect(raw.title).toBe("Titular");
    expect(raw.images).toEqual([
      "https://example.test/a.jpg",
      "b.png",
    ]);
    expect(raw.payload).toMatchObject({
      title: "  Titular  ",
      body: "<p>Cuerpo</p>",
      images: ["https://example.test/a.jpg", "b.png"],
      publishedAt: "2026-10-18T10:00:00.000Z",
    });
    expect(raw.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("es idempotente: el mismo externalId devuelve duplicate=true", async () => {
    const source = await createSource();
    const first = await ingestItem({
      sourceId: source.id,
      externalId: "mismo-id",
      title: "Titulo",
      body: "Cuerpo",
    });
    const second = await ingestItem({
      sourceId: source.id,
      externalId: "mismo-id",
      title: "Titulo",
      body: "Cuerpo",
    });

    expect(first).toMatchObject({ ok: true, duplicate: false });
    expect(second).toMatchObject({ ok: true, duplicate: true });
    expect((second as { rawItemId: string }).rawItemId).toBe(
      (first as { rawItemId: string }).rawItemId
    );
    await expect(prisma.rawItem.count()).resolves.toBe(1);
  });

  it("un externalId distinto crea otro RawItem aunque el contenido coincida", async () => {
    const source = await createSource();
    await ingestItem({
      sourceId: source.id,
      externalId: "a",
      title: "Titulo",
      body: "Cuerpo",
    });
    const second = await ingestItem({
      sourceId: source.id,
      externalId: "b",
      title: "Titulo",
      body: "Cuerpo",
    });

    expect(second).toMatchObject({ ok: true, duplicate: false });
    await expect(prisma.rawItem.count()).resolves.toBe(2);
  });

  it("permite el mismo externalId en fuentes distintas", async () => {
    const a = await createSource({ name: "Fuente A" });
    const b = await createSource({ name: "Fuente B" });

    await ingestItem({ sourceId: a.id, externalId: "compartido" });
    const second = await ingestItem({
      sourceId: b.id,
      externalId: "compartido",
    });

    expect(second).toMatchObject({ ok: true, duplicate: false });
    await expect(prisma.rawItem.count()).resolves.toBe(2);
  });

  it("ignora images que no sea un arreglo de strings", async () => {
    const source = await createSource();
    const result = await ingestItem({
      sourceId: source.id,
      externalId: "ext-imgs",
      images: "no-es-arreglo" as unknown as string[],
    });

    const raw = await prisma.rawItem.findUniqueOrThrow({
      where: { id: (result as { rawItemId: string }).rawItemId },
    });
    expect(raw.images).toBeNull();
    expect(raw.payload).toMatchObject({ images: [] });
  });

  it("el helper createRawItem sigue siendo compatible con la dedup", async () => {
    const source = await createSource();
    await createRawItem(source.id, { externalId: "ext-helper" });

    const result = await ingestItem({
      sourceId: source.id,
      externalId: "ext-helper",
    });
    expect(result).toMatchObject({ ok: true, duplicate: true });
  });
});
