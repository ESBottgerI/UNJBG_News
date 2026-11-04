import { expect, test } from "@playwright/test";

test.describe("sitio publico", () => {
  test("la portada muestra publicadas y oculta borradores/rechazados", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page
        .getByText("UNJBG inaugura laboratorio de inteligencia artificial")
        .first()
    ).toBeVisible();
    await expect(page.getByText("BORRADOR E2E")).toHaveCount(0);
    await expect(page.getByText("RECHAZADO E2E")).toHaveCount(0);
  });

  test("la ficha de la noticia renderiza titulo y cuerpo", async ({ page }) => {
    await page.goto("/noticias/e2e-post-unjbg");

    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "UNJBG inaugura laboratorio"
    );
    await expect(page.locator(".article-body")).toContainText(
      "laboratorio de inteligencia artificial"
    );
  });

  test("la pagina de categoria lista sus noticias", async ({ page }) => {
    await page.goto("/seccion/unjbg");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("UNJBG");
    await expect(
      page
        .getByText("UNJBG inaugura laboratorio de inteligencia artificial")
        .first()
    ).toBeVisible();
    await expect(page.getByText("BORRADOR E2E")).toHaveCount(0);
  });

  test("la busqueda full-text encuentra coincidencias", async ({ page }) => {
    await page.goto("/buscar?q=laboratorio");

    await expect(
      page
        .getByText("UNJBG inaugura laboratorio de inteligencia artificial")
        .first()
    ).toBeVisible();
    await expect(page.getByText(/\d+ resultado/).first()).toBeVisible();
  });

  test("la busqueda no encuentra textos inexistentes", async ({ page }) => {
    await page.goto("/buscar?q=zzzzzz");

    await expect(page.getByText(/Sin resultados para/)).toBeVisible();
  });

  test("una noticia inexistente devuelve 404", async ({ page }) => {
    const response = await page.goto("/noticias/no-existe");
    expect(response?.status()).toBe(404);
  });

  test("una seccion inexistente devuelve 404", async ({ page }) => {
    const response = await page.goto("/seccion/no-existe");
    expect(response?.status()).toBe(404);
  });

  test("el sitemap incluye las noticias publicadas", async ({ request }) => {
    const response = await request.get("/sitemap.xml");

    expect(response.status()).toBe(200);
    const xml = await response.text();
    expect(xml).toContain("/noticias/e2e-post-unjbg");
    expect(xml).not.toContain("/noticias/e2e-post-draft");
  });
});
