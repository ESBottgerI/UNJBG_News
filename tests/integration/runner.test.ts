import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Source } from "@prisma/client";
import {
  createSource,
  disconnect,
  prisma,
  resetDatabase,
} from "../helpers/db";

// El adaptador real hace red; aqui se reemplaza solo buildAdapter. isDue e
// INGESTIBLE_TYPES se conservan reales para probar la seleccion de fuentes.
vi.mock("@/adapters/index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/adapters/index")>();
  return { ...actual, buildAdapter: vi.fn() };
});

vi.mock("@/lib/alerts", () => ({
  alertsConfigured: vi.fn(() => true),
  sendAlert: vi.fn(async () => undefined),
}));

import { buildAdapter } from "@/adapters/index";
import { sendAlert } from "@/lib/alerts";

type RunnerModule = typeof import("@/adapters/runner");
let runner: RunnerModule;

function adapterReturning(
  items: Array<{
    externalId: string;
    title?: string;
    body?: string;
    images?: string[];
    publishedAt?: string;
  }>
) {
  return {
    source: { id: "x" } as Source,
    fetchItems: vi.fn().mockResolvedValue(items),
  };
}

beforeAll(async () => {
  // El runner lee el umbral al importarse; se fija para que el test no dependa
  // del entorno del contenedor.
  process.env.ALERT_AFTER_FAILURES = "3";
  runner = await import("@/adapters/runner");
});

beforeEach(async () => {
  await resetDatabase();
  vi.mocked(buildAdapter).mockReset();
  vi.mocked(sendAlert).mockClear();
});

afterAll(async () => {
  await disconnect();
});

describe("runAdapterForSource", () => {
  it("lanza si la fuente no existe", async () => {
    await expect(runner.runAdapterForSource("no-existe")).rejects.toThrow(
      /no encontrada/i
    );
  });

  it("marca error y no usa adaptador para WHATSAPP", async () => {
    const source = await createSource({ type: "WHATSAPP" });

    const result = await runner.runAdapterForSource(source.id);

    expect(result).toMatchObject({ fetched: 0, newItems: 0, duplicates: 0 });
    expect(result.error).toMatch(/worker/i);
    expect(buildAdapter).not.toHaveBeenCalled();

    const updated = await prisma.source.findUniqueOrThrow({
      where: { id: source.id },
    });
    expect(updated.consecutiveFailures).toBe(1);
    expect(updated.lastError).toMatch(/worker/i);
    await expect(
      prisma.sourceRun.count({ where: { sourceId: source.id, status: "ERROR" } })
    ).resolves.toBe(1);
  });

  it("registra el fallo del adaptador y suma la racha", async () => {
    const source = await createSource({ consecutiveFailures: 0 });
    vi.mocked(buildAdapter).mockReturnValue({
      source,
      fetchItems: vi.fn().mockRejectedValue(new Error("timeout aguas arriba")),
    } as never);

    const result = await runner.runAdapterForSource(source.id);

    expect(result).toMatchObject({ fetched: 0, newItems: 0, duplicates: 0 });
    expect(result.error).toBe("timeout aguas arriba");

    const updated = await prisma.source.findUniqueOrThrow({
      where: { id: source.id },
    });
    expect(updated.consecutiveFailures).toBe(1);
    expect(updated.lastError).toBe("timeout aguas arriba");
    expect(updated.lastSuccessAt).toBeNull();
    expect(sendAlert).not.toHaveBeenCalled();
  });

  it("envia alerta justo al cruzar el umbral de fallos", async () => {
    const source = await createSource({ consecutiveFailures: 2 });
    vi.mocked(buildAdapter).mockReturnValue({
      source,
      fetchItems: vi.fn().mockRejectedValue(new Error("boom")),
    } as never);

    await runner.runAdapterForSource(source.id);

    const updated = await prisma.source.findUniqueOrThrow({
      where: { id: source.id },
    });
    expect(updated.consecutiveFailures).toBe(3);
    expect(sendAlert).toHaveBeenCalledTimes(1);
    expect(sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "error",
        sourceId: source.id,
        title: "Fuente con fallos repetidos",
      })
    );
  });

  it("ingesta, procesa y registra una corrida OK", async () => {
    const source = await createSource();
    vi.mocked(buildAdapter).mockReturnValue(
      adapterReturning([
        {
          externalId: "ext-1",
          title: "Universidad Nacional Jorge Basadre Grohmann",
          body: "<p>Noticia uno</p>",
        },
        {
          externalId: "ext-2",
          title: "Vecinos de Pocollay",
          body: "<p>Noticia dos</p>",
        },
      ]) as never
    );

    const result = await runner.runAdapterForSource(source.id);

    expect(result).toMatchObject({
      sourceId: source.id,
      fetched: 2,
      newItems: 2,
      duplicates: 0,
    });
    expect(result.error).toBeUndefined();

    const updated = await prisma.source.findUniqueOrThrow({
      where: { id: source.id },
    });
    expect(updated.consecutiveFailures).toBe(0);
    expect(updated.lastSuccessAt).not.toBeNull();
    expect(updated.lastDurationMs).not.toBeNull();
    expect(updated.lastError).toBeNull();

    await expect(prisma.rawItem.count()).resolves.toBe(2);
    await expect(prisma.post.count()).resolves.toBe(2);

    const run = await prisma.sourceRun.findFirstOrThrow({
      where: { sourceId: source.id },
    });
    expect(run).toMatchObject({
      status: "OK",
      fetched: 2,
      newItems: 2,
      duplicates: 0,
    });
  });

  it("en la segunda corrida cuenta duplicados y no recrea posts", async () => {
    const source = await createSource();
    const items = [
      { externalId: "ext-1", title: "Repetida", body: "<p>x</p>" },
    ];
    vi.mocked(buildAdapter).mockReturnValue(adapterReturning(items) as never);

    await runner.runAdapterForSource(source.id);
    const second = await runner.runAdapterForSource(source.id);

    expect(second).toMatchObject({
      fetched: 1,
      newItems: 0,
      duplicates: 1,
    });
    await expect(prisma.rawItem.count()).resolves.toBe(1);
    await expect(prisma.post.count()).resolves.toBe(1);
  });

  it("un item invalido no aborta la corrida y queda como error parcial", async () => {
    const source = await createSource();
    vi.mocked(buildAdapter).mockReturnValue(
      adapterReturning([
        { externalId: "", title: "Sin id" },
        { externalId: "valido", title: "Valido", body: "<p>ok</p>" },
      ]) as never
    );

    const result = await runner.runAdapterForSource(source.id);

    expect(result.fetched).toBe(2);
    expect(result.newItems).toBe(1);
    expect(result.error).toMatch(/externalId es obligatorio/i);

    const updated = await prisma.source.findUniqueOrThrow({
      where: { id: source.id },
    });
    expect(updated.consecutiveFailures).toBe(0);
    expect(updated.lastSuccessAt).not.toBeNull();
    expect(updated.lastError).toMatch(/externalId es obligatorio/i);
  });

  it("avisa cuando la fuente se recupera despues de una racha alertada", async () => {
    const source = await createSource({ consecutiveFailures: 3 });
    vi.mocked(buildAdapter).mockReturnValue(
      adapterReturning([]) as never
    );

    const result = await runner.runAdapterForSource(source.id);

    expect(result.error).toBeUndefined();
    expect(sendAlert).toHaveBeenCalledTimes(1);
    expect(sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "info",
        sourceId: source.id,
        title: "Fuente recuperada",
      })
    );
  });
});

describe("runDueSources", () => {
  function dueSource(overrides: Parameters<typeof createSource>[0] = {}) {
    return createSource({
      status: "ACTIVE",
      pollIntervalMinutes: 15,
      lastRunAt: null,
      ...overrides,
    });
  }

  it("corre solo fuentes activas, ingestibles y vencidas", async () => {
    const due = await dueSource();
    await dueSource({
      status: "PAUSED",
      lastRunAt: null,
    });
    await dueSource({
      lastRunAt: new Date(),
      name: "No vencida",
    });
    await dueSource({ type: "WHATSAPP", lastRunAt: null });

    vi.mocked(buildAdapter).mockReturnValue(adapterReturning([]) as never);

    const results = await runner.runDueSources();

    expect(results.map((r) => r.sourceId)).toEqual([due.id]);
    expect(buildAdapter).toHaveBeenCalledTimes(1);
  });

  it("respeta maxSources", async () => {
    await dueSource({ name: "A" });
    await dueSource({ name: "B" });
    await dueSource({ name: "C" });

    vi.mocked(buildAdapter).mockReturnValue(adapterReturning([]) as never);

    const results = await runner.runDueSources(2);

    expect(results).toHaveLength(2);
  });
});
