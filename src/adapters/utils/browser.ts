import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

// Factoría Playwright para los adaptadores que necesitan navegador real
// (inicialmente Facebook, Fase 3).
//
// Un solo browser se lanza al primer uso y se reutiliza entre corridas;
// cada corrida abre su propio contexto (perfil limpio) y una pagina.
// `closeBrowser()` libera la instancia (util al finalizar el runner/test).

let browserPromise: Promise<Browser> | null = null;

const FACEBOOK_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: [
        // Reduce la deteccion de automatizacion por parte de las paginas.
        "--disable-blink-features=AutomationControlled",
        // Requerido si algun dia se corre dentro de contenedores como root.
        "--no-sandbox",
      ],
    });
  }
  return browserPromise;
}

export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close().catch(() => {
      // Ignorar errores al cerrar: la instancia ya no se necesita.
    });
    browserPromise = null;
  }
}

export type OpenPage = { page: Page; context: BrowserContext };

// Abre `url` en un contexto limpio (UA realista, locale es-PE). Lanza si la
// pagina no responde. El cierre lo hace el llamador via `closeOpenPage`.
export async function openPage(url: string): Promise<OpenPage> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    locale: "es-PE",
    viewport: { width: 1280, height: 1000 },
    userAgent: FACEBOOK_UA,
    extraHTTPHeaders: {
      "Accept-Language": "es-PE,es-419;q=0.9,es;q=0.8,en;q=0.7",
    },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(45_000);

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  return { page, context };
}

export async function closeOpenPage(session: OpenPage): Promise<void> {
  await session.context.close().catch(() => {
    // El contexto pudo cerrarse por otra via; no es un error bloqueante.
  });
}