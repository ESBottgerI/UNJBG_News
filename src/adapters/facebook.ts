import { createHash } from "crypto";
import type { Source } from "@prisma/client";
import type { FetchedItem, NewsAdapter } from "./types";
import { openPage, closeOpenPage } from "./utils/browser";
import type { Page } from "playwright";

// Adaptador FACEBOOK (Fase 3): ingest de publicaciones de paginas publicas
// sin sesion de usuario. Usa Playwright porque Facebook oculta el contenido
// detras de login, cookies y JS pesado (una peticion HTTP no alcanza).
//
// Grupos privados NO se procesan: devuelven un error claro (requieren sesion,
// fuera de alcance de la fase). La granularidad la da el dedup de ingesta
// por (sourceId, externalId); externalId sale de data-ft o del permalink.

const DEFAULT_MAX_ITEMS = 25;
const MAX_SCROLLS = 14;
const SCROLL_WAIT_MS = 900;

// Seleccionadores del muro (UI en espanol; se usa fallback por rol=article).
const ARTICLE_SELECTORS = ['div[role="article"]', 'div[aria-label="Publicación"]'];

type RawPost = {
  hrefs: string[];
  ft: string;
  text: string;
  images: string[];
  dateTitle: string;
};

export class FacebookAdapter implements NewsAdapter {
  readonly source: Source;

  constructor(source: Source) {
    this.source = source;
  }

  private get config(): Record<string, unknown> {
    return (this.source.config ?? {}) as Record<string, unknown>;
  }

  async fetchItems(): Promise<FetchedItem[]> {
    if (this.config.privateGroup === true) {
      throw new Error(
        "grupo privado de facebook requiere sesion iniciada (fuera de alcance de la fase 3)"
      );
    }
    if (!this.source.url) {
      throw new Error("fuente facebook sin url");
    }

    const maxItems =
      typeof this.config.maxItems === "number"
        ? this.config.maxItems
        : DEFAULT_MAX_ITEMS;

    const session = await openPage(this.source.url);
    try {
      const { page } = session;
      await this.closeDialogs(page);
      await this.waitForFeed(page);

      if (await this.hasLoginWall(page)) {
        throw new Error("facebook pidio iniciar sesion (contenido no publico)");
      }

      await this.scrollFeed(page, maxItems);

      const rawPosts = await this.collectPosts(page);
      return this.toItems(rawPosts, maxItems);
    } finally {
      await closeOpenPage(session);
    }
  }

  // Cierra dialogos tipicos que aparecen al entrar sin sesion
  // (consentimiento de cookies, dialogo de login, etc.) de forma no bloqueante.
  private async closeDialogs(page: Page): Promise<void> {
    for (const selector of ['div[aria-label="Cerrar"]', "div[aria-label=Cerrar]"]) {
      const close = page.locator(selector).first();
      try {
        if (await close.isVisible({ timeout: 2_000 })) {
          await close.click({ timeout: 2_000 });
        }
      } catch {
        // No habia dialogo con ese selector: se sigue con el siguiente.
      }
    }
  }

  // Espera a que cargue el feed (publicaciones o, en su defecto, la pared de
  // login). No lanza si no encuentra nada: la decision la toma hasLoginWall.
  private async waitForFeed(page: Page): Promise<void> {
    try {
      await page.waitForSelector(ARTICLE_SELECTORS.join(","), {
        timeout: 20_000,
      });
    } catch {
      // Puede no haber publicaciones visibles sin sesion; se valida despues.
    }
  }

  private async hasLoginWall(page: Page): Promise<boolean> {
    // Facebook mantiene un form de login en el DOM aun viendo paginas
    // publicas, asi que NO basta con detectar el formulario: solo se
    // considera pared si ademas no hay publicaciones visibles.
    const inLoginUrl =
      page.url().includes("/login/") || page.url().includes("login.php");
    if (inLoginUrl) return true;

    const articles = await page.locator(ARTICLE_SELECTORS.join(",")).count();
    if (articles > 0) return false;

    const hasLoginForm = (await page.locator('form[id="login_form"]').count()) > 0;
    return hasLoginForm;
  }

  // Hace scroll incremental hasta reunir maxItems publicaciones o agotar
  // intentos. Facebook carga el muro de forma virtualizada.
  private async scrollFeed(page: Page, maxItems: number): Promise<void> {
    for (let i = 0; i < MAX_SCROLLS; i++) {
      const count = await page.locator(ARTICLE_SELECTORS.join(",")).count();
      if (count >= maxItems) return;
      await page.mouse.wheel(0, 2_400);
      await page.waitForTimeout(SCROLL_WAIT_MS);
    }
  }

  private async collectPosts(page: Page): Promise<RawPost[]> {
    const selector = ARTICLE_SELECTORS.join(",");
    return page.locator(selector).evaluateAll((els) =>
      els.map((el) => {
        const article = el as HTMLElement;
        const dateEl = article.querySelector("abbr");
        return {
          hrefs: Array.from(
            new Set(
              Array.from(article.querySelectorAll<HTMLAnchorElement>("a"))
                .map((a) => a.href)
                .filter(Boolean)
            )
          ),
          ft: article.getAttribute("data-ft") ?? "",
          text: (article.textContent ?? "").replace(/\s+/g, " ").trim(),
          images: Array.from(
            new Set(
              Array.from(article.querySelectorAll("img"))
                .map((img) => (img as HTMLImageElement).src)
                .filter((src) => /fbcdn|scontent|lookaside/.test(src))
            )
          ),
          dateTitle: dateEl?.getAttribute("title") ?? "",
        };
      })
    );
  }

  private toItems(posts: RawPost[], maxItems: number): FetchedItem[] {
    const items: FetchedItem[] = [];
    const seenIds = new Set<string>();

    for (const post of posts) {
      const externalId = this.resolveExternalId(post);
      if (!externalId || seenIds.has(externalId)) continue;
      if (!post.text && post.images.length === 0) continue;
      seenIds.add(externalId);

      const title = this.buildTitle(post);
      items.push({
        externalId,
        title,
        body: post.text,
        images: post.images,
        publishedAt: this.parseDate(post.dateTitle) ?? undefined,
      });

      if (items.length >= maxItems) break;
    }
    return items;
  }

  // Id estable para dedup. Prioridad:
  //   1. data-ft (id interno de la publicacion)
  //   2. id del permalink (story.php / permalink.php / videos / posts / photos)
  //   3. hash determinista del contenido (ultimo recurso, menos estable porque
  //      las variantes del mismo post pueden diferir ligeramente).
  private resolveExternalId(post: RawPost): string | null {
    const ft = this.parseDataFt(post.ft);
    for (const key of ["top_level_post_id", "post_id", "content_id"] as const) {
      const value = ft?.[key];
      if (typeof value === "string" && value) return value;
      if (typeof value === "number") return String(value);
    }

    for (const href of post.hrefs) {
      const match =
        href.match(/story\.php\?story_fbid=(\d+)/) ??
        href.match(/permalink\.php\?story_fbid=(\d+)/) ??
        href.match(/\/videos\/(\d+)\//) ??
        href.match(/\/reel\/(\d+)\//) ??
        href.match(/\/posts\/(\d+)/) ??
        href.match(/\/photos\/(\d+)/);
      if (match) return match[1];
    }

    const hash = createHash("sha1")
      .update(`${post.text}\n${post.images.join(",")}\n${post.dateTitle}`)
      .digest("hex")
      .slice(0, 20);
    return `fb:${hash}`;
  }

  private parseDataFt(raw: string): Record<string, unknown> | null {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  private buildTitle(post: RawPost): string {
    const preview = post.text.replace(/\s+/g, " ").trim();
    if (!preview) return "Publicación de Facebook";
    return preview.length > 160 ? `${preview.slice(0, 157)}...` : preview;
  }

  private parseDate(value: string): string | null {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
}