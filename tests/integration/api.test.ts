import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import {
  createPost,
  createSource,
  disconnect,
  prisma,
  resetDatabase,
} from "../helpers/db";
import { GET as searchGET } from "@/app/api/search/route";
import { GET as healthGET } from "@/app/api/health/route";

const INGEST_KEY = "clave-de-test";
let ingestPOST: typeof import("@/app/api/ingest/route").POST;
let ipSeq = 0;

function nextIp(): string {
  ipSeq += 1;
  return `198.51.100.${ipSeq}`;
}

function ingestRequest(
  body: unknown,
  options: { key?: string; ip?: string; rawBody?: string } = {}
): NextRequest {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-forwarded-for": options.ip ?? nextIp(),
  };
  if (options.key !== undefined) headers["x-ingest-key"] = options.key;
  else headers["x-ingest-key"] = INGEST_KEY;

  return new Request("http://localhost/api/ingest", {
    method: "POST",
    headers,
    body: options.rawBody ?? JSON.stringify(body),
  }) as unknown as NextRequest;
}

beforeAll(async () => {
  process.env.INGEST_API_KEY = INGEST_KEY;
  // El modulo lee la clave al importarse, por eso el import es dinamico.
  ({ POST: ingestPOST } = await import("@/app/api/ingest/route"));
});

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await disconnect();
});

describe("POST /api/ingest", () => {
  it("devuelve 401 sin la clave correcta", async () => {
    const response = await ingestPOST(
      ingestRequest({ externalId: "x" }, { key: "incorrecta" })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "no autorizado" });
  });

  it("devuelve 400 con JSON invalido", async () => {
    const response = await ingestPOST(
      ingestRequest(null, { rawBody: "{no-es-json" })
    );

    expect(response.status).toBe(400);
  });

  it("devuelve 400 si falta externalId", async () => {
    const source = await createSource();
    const response = await ingestPOST(
      ingestRequest({ sourceId: source.id })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringMatching(/externalId/i),
    });
  });

  it("crea el item y luego responde duplicate=true", async () => {
    const source = await createSource();
    const payload = {
      sourceId: source.id,
      externalId: "api-ext-1",
      title: "Desde la API",
      body: "<p>Cuerpo</p>",
    };

    const first = await ingestPOST(ingestRequest(payload));
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as {
      ok: boolean;
      rawItemId: string;
      duplicate: boolean;
    };
    expect(firstBody).toMatchObject({ ok: true, duplicate: false });

    const second = await ingestPOST(
      ingestRequest(payload, { ip: "203.0.113.50" })
    );
    const secondBody = (await second.json()) as {
      rawItemId: string;
      duplicate: boolean;
    };
    expect(secondBody).toMatchObject({
      duplicate: true,
      rawItemId: firstBody.rawItemId,
    });
    await expect(prisma.rawItem.count()).resolves.toBe(1);
  });

  it("acepta sourceName+sourceType", async () => {
    await createSource({ name: "Feed API", type: "RSS" });

    const response = await ingestPOST(
      ingestRequest({
        sourceName: "Feed API",
        sourceType: "RSS",
        externalId: "por-nombre",
      })
    );

    expect(response.status).toBe(200);
    await expect(prisma.rawItem.count()).resolves.toBe(1);
  });

  it("devuelve 404 si la fuente no existe", async () => {
    const response = await ingestPOST(
      ingestRequest({ sourceId: "no-existe", externalId: "x" })
    );

    expect(response.status).toBe(404);
  });

  it("limita por IP y devuelve 429 con Retry-After", async () => {
    const source = await createSource();
    const previous = process.env.INGEST_RATE_LIMIT_PER_MIN;
    process.env.INGEST_RATE_LIMIT_PER_MIN = "1";
    const ip = "203.0.113.77";

    try {
      const first = await ingestPOST(
        ingestRequest(
          { sourceId: source.id, externalId: "rate-1" },
          { ip }
        )
      );
      expect(first.status).toBe(200);

      const second = await ingestPOST(
        ingestRequest(
          { sourceId: source.id, externalId: "rate-2" },
          { ip }
        )
      );
      expect(second.status).toBe(429);
      expect(second.headers.get("Retry-After")).toBeTruthy();
    } finally {
      if (previous === undefined) delete process.env.INGEST_RATE_LIMIT_PER_MIN;
      else process.env.INGEST_RATE_LIMIT_PER_MIN = previous;
    }
  });

  it("devuelve 500 si la clave no esta configurada en el servidor", async () => {
    const previous = process.env.INGEST_API_KEY;
    delete process.env.INGEST_API_KEY;
    vi.resetModules();

    try {
      const fresh = await import("@/app/api/ingest/route");
      const response = await fresh.POST(
        ingestRequest({ externalId: "x" }, { ip: "203.0.113.99" })
      );
      expect(response.status).toBe(500);
    } finally {
      process.env.INGEST_API_KEY = previous;
    }
  });
});

describe("GET /api/search", () => {
  it("devuelve vacio con consultas de menos de 2 caracteres", async () => {
    const response = await searchGET(
      new Request("http://localhost/api/search?q=a", {
        headers: { "x-forwarded-for": nextIp() },
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ results: [] });
  });

  it("encuentra posts publicados", async () => {
    const post = await createPost({
      title: "Universidad Nacional de Tacna",
      bodyHtml: "<p>Noticia regional</p>",
    });
    await createPost({ title: "Universidad en borrador", status: "DRAFT" });

    const response = await searchGET(
      new Request("http://localhost/api/search?q=universidad", {
        headers: { "x-forwarded-for": nextIp() },
      })
    );
    const body = (await response.json()) as {
      results: Array<{ id: string; title: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.results.map((r) => r.id)).toEqual([post.id]);
  });

  it("limita por IP y devuelve 429", async () => {
    const previous = process.env.SEARCH_RATE_LIMIT_PER_MIN;
    process.env.SEARCH_RATE_LIMIT_PER_MIN = "1";
    const ip = "203.0.113.88";

    try {
      const first = await searchGET(
        new Request("http://localhost/api/search?q=tacna", {
          headers: { "x-forwarded-for": ip },
        })
      );
      expect(first.status).toBe(200);

      const second = await searchGET(
        new Request("http://localhost/api/search?q=tacna", {
          headers: { "x-forwarded-for": ip },
        })
      );
      expect(second.status).toBe(429);
      expect(second.headers.get("Retry-After")).toBeTruthy();
    } finally {
      if (previous === undefined) delete process.env.SEARCH_RATE_LIMIT_PER_MIN;
      else process.env.SEARCH_RATE_LIMIT_PER_MIN = previous;
    }
  });
});

describe("GET /api/health", () => {
  it("responde ok cuando la base responde y el scheduler esta apagado", async () => {
    const previous = process.env.ENABLE_ADAPTER_SCHEDULER;
    process.env.ENABLE_ADAPTER_SCHEDULER = "false";

    try {
      await createPost();
      const response = await healthGET(
        new Request("http://localhost/api/health")
      );
      const body = (await response.json()) as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        status: "ok",
        db: "ok",
        queue: { pendingRaw: 0, draftPosts: 0 },
      });
      expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    } finally {
      if (previous === undefined) delete process.env.ENABLE_ADAPTER_SCHEDULER;
      else process.env.ENABLE_ADAPTER_SCHEDULER = previous;
    }
  });

  it("marca degraded y responde 503 en modo strict con fuentes fallando", async () => {
    const previous = process.env.ENABLE_ADAPTER_SCHEDULER;
    process.env.ENABLE_ADAPTER_SCHEDULER = "false";
    await createSource({ consecutiveFailures: 3, status: "ACTIVE" });

    try {
      const plain = await healthGET(
        new Request("http://localhost/api/health")
      );
      expect(plain.status).toBe(200);
      await expect(plain.json()).resolves.toMatchObject({
        status: "degraded",
        sources: { active: 1, failing: 1 },
      });

      const strict = await healthGET(
        new Request("http://localhost/api/health?strict=1")
      );
      expect(strict.status).toBe(503);
    } finally {
      if (previous === undefined) delete process.env.ENABLE_ADAPTER_SCHEDULER;
      else process.env.ENABLE_ADAPTER_SCHEDULER = previous;
    }
  });

  it("incluye la cola pendiente en el resumen", async () => {
    const previous = process.env.ENABLE_ADAPTER_SCHEDULER;
    process.env.ENABLE_ADAPTER_SCHEDULER = "false";

    try {
      const source = await createSource();
      await prisma.rawItem.create({
        data: {
          sourceId: source.id,
          externalId: "pendiente",
          payload: { title: "Pendiente", body: "" },
          contentHash: "hash",
        },
      });
      await createPost({ status: "DRAFT" });

      const response = await healthGET(
        new Request("http://localhost/api/health")
      );
      await expect(response.json()).resolves.toMatchObject({
        queue: { pendingRaw: 1, draftPosts: 1 },
      });
    } finally {
      if (previous === undefined) delete process.env.ENABLE_ADAPTER_SCHEDULER;
      else process.env.ENABLE_ADAPTER_SCHEDULER = previous;
    }
  });
});
