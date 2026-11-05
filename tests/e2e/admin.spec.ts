import { expect, test, type Page } from "@playwright/test";

const ADMIN_EMAIL = "admin@e2e.test";
const ADMIN_PASSWORD = "e2e-clave";

async function login(page: Page): Promise<void> {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Contrasena").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe("panel de administracion", () => {
  test("sin sesion redirige al login", async ({ page }) => {
    await page.goto("/admin");

    await expect(page).toHaveURL(/\/admin\/login(\?.*)?$/);
    await expect(page.getByRole("heading", { name: "NCA UNJBG" })).toBeVisible();
  });

  test("cerrar sesion vuelve al login y protege el panel", async ({ page }) => {
    await login(page);

    await page.getByRole("button", { name: "Cerrar sesion" }).click();
    await expect(page).toHaveURL(/\/admin\/login(\?.*)?$/);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login(\?.*)?$/);
  });

  test("credenciales invalidas muestran un error", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Contrasena").fill("clave-incorrecta");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page.getByText("Credenciales incorrectas.")).toBeVisible();
  });

  test("login y aprobacion de un item con HTML malicioso (regresion XSS)", async ({
    page,
  }) => {
    const dialogs: string[] = [];
    page.on("dialog", async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });

    await login(page);

    await page.goto("/admin/queue");
    await page
      .getByRole("link", { name: "Noticia pendiente de aprobacion E2E" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Noticia pendiente de aprobacion E2E" })
    ).toBeVisible();

    await page.getByLabel("Titular").fill("Noticia aprobada E2E");
    await page
      .getByLabel("Cuerpo (texto o HTML)")
      .fill(
        '<p>Contenido <strong>seguro</strong></p><script>alert("xss-e2e")</script>' +
          '<img src="https://example.test/a.jpg" onerror="alert(1)">'
      );
    await page.getByRole("button", { name: "Aprobar" }).click();

    await expect(page).toHaveURL(/\/admin\/posts$/);

    // Se publica directo (la fuente semilla tiene autopublish) y aparece en el
    // sitio publico. El <script> no debe ejecutarse ni guardarse.
    await page.goto("/");
    await page.getByRole("link", { name: "Noticia aprobada E2E" }).first().click();
    await expect(page.locator(".article-body")).toContainText("Contenido seguro");
    await expect(page.locator(".article-body script")).toHaveCount(0);
    await expect(page.locator(".article-body img")).toHaveAttribute(
      "src",
      "https://example.test/a.jpg"
    );
    expect(dialogs).toEqual([]);
  });

  test("descartar un item lo saca de la cola de pendientes", async ({ page }) => {
    await login(page);

    await page.goto("/admin/queue");
    await page
      .getByRole("link", { name: "Noticia para descartar E2E" })
      .click();
    await page.getByRole("button", { name: "Descartar" }).click();

    await expect(page).toHaveURL(/\/admin\/queue$/);
    await expect(
      page.getByRole("link", { name: "Noticia para descartar E2E" })
    ).toHaveCount(0);

    await page.getByRole("link", { name: "Descartados" }).click();
    await expect(
      page.getByRole("link", { name: "Noticia para descartar E2E" })
    ).toBeVisible();
  });
});
