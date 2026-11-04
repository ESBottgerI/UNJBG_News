import { expect, test } from "@playwright/test";

// Smoke de los endpoints publicos contra el servidor real.

test.describe("API", () => {
  test("health responde ok con la base conectada", async ({ request }) => {
    const response = await request.get("/api/health");

    expect(response.status()).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ status: "ok", db: "ok" });
  });

  test("search devuelve solo noticias publicadas", async ({ request }) => {
    const response = await request.get("/api/search?q=laboratorio");

    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      results: Array<{ id: string; title: string }>;
    };
    expect(body.results.map((r) => r.id)).toContain("e2e-post-unjbg");
    expect(body.results.map((r) => r.id)).not.toContain("e2e-post-draft");
  });

  test("search ignora consultas demasiado cortas", async ({ request }) => {
    const response = await request.get("/api/search?q=a");
    await expect(response.json()).resolves.toEqual({ results: [] });
  });

  test("ingest rechaza peticiones sin la clave", async ({ request }) => {
    const response = await request.post("/api/ingest", {
      data: { externalId: "e2e-api-1" },
    });

    expect(response.status()).toBe(401);
  });
});
