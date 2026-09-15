import * as cheerio from "cheerio";
import type { Source } from "@prisma/client";
import type { FetchedItem, NewsAdapter } from "./types";
import { fetchText, fetchWithRetry } from "./utils/http";

// Adaptador WEB generico para sitios de noticias clasicos:
// 1. Lee el sitemap.xml de la fuente (o el path indicado en config).
// 2. Para cada URL del sitemap, extrae titulo/cuerpo/imagen desde los meta
//    tags Open Graph y JSON-LD de tipo NewsArticle.
//
// Funciona para la mayoria de medios que publican sitemap; si un sitio
// renderiza todo por JavaScript (SPA) se necesitara un adaptador propio
// (como el de la UNJBG) o Playwright (Fase 3).

const MAX_DEFAULT_ITEMS = 20;

export class SitemapWebAdapter implements NewsAdapter {
  readonly source: Source;

  constructor(source: Source) {
    this.source = source;
  }

  private get config(): Record<string, unknown> {
    return (this.source.config ?? {}) as Record<string, unknown>;
  }

  async fetchItems(): Promise<FetchedItem[]> {
    if (!this.source.url) {
      throw new Error("fuente web sin url");
    }

    const sitemapUrl = this.buildSitemapUrl(this.source.url);
    const locs = await this.collectUrls(sitemapUrl);

    const maxItems =
      typeof this.config.maxItems === "number"
        ? this.config.maxItems
        : MAX_DEFAULT_ITEMS;

    const items: FetchedItem[] = [];
    for (const url of locs.slice(0, maxItems)) {
      try {
        items.push(await this.extractArticle(url));
      } catch {
        // Una pagina que falle no aborta el resto del sitemap.
      }
    }

    // Filtrar items que no lograron sacar siquiera un titulo.
    return items.filter((i) => i.title);
  }

  private buildSitemapUrl(baseUrl: string): string {
    const configPath =
      typeof this.config.sitemapPath === "string"
        ? this.config.sitemapPath
        : "/sitemap.xml";
    return new URL(configPath, baseUrl).toString();
  }

  // Devuelve las URLs del sitemap, soportando <urlset> y <sitemapindex>
  // (sitemap de sitemaps, un nivel de profundidad).
  private async collectUrls(sitemapUrl: string): Promise<string[]> {
    const robotsXml = await fetchText(sitemapUrl);
    const $ = cheerio.load(robotsXml, { xmlMode: true });

    const direct: string[] = [];
    $("urlset > url > loc").each((_, el) => {
      const href = $(el).text().trim();
      if (href) direct.push(href);
    });

    if (direct.length > 0) {
      return direct;
    }

    // sitemapindex
    const childUrls: string[] = [];
    $("sitemapindex > sitemap > loc").each((_, el) => {
      const href = $(el).text().trim();
      if (href) childUrls.push(href);
    });

    const all: string[] = [];
    for (const child of childUrls) {
      try {
        const childXml = await fetchText(child);
        const $child = cheerio.load(childXml, { xmlMode: true });
        $child("urlset > url > loc").each((_, el) => {
          const href = $child(el).text().trim();
          if (href) all.push(href);
        });
      } catch {
        // Sitemap hijo que falle no aborta el resto.
      }
    }
    return all;
  }

  private async extractArticle(url: string): Promise<FetchedItem> {
    const html = await fetchWithRetry(url, { timeoutMs: 20_000 }).then((r) =>
      r.text()
    );
    const $ = cheerio.load(html);

    const ldJson = this.parseJsonLd($);

    const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();
    const ogDescription = $('meta[property="og:description"]')
      .attr("content")
      ?.trim();
    const ogImage = $('meta[property="og:image"]').attr("content")?.trim();
    const twitterImage = $('meta[name="twitter:image"]').attr("content")?.trim();
    const metaDescription = $('meta[name="description"]').attr("content")?.trim();
    const h1 = $("h1").first().text().trim();

    const title = ogTitle || ldJson.headline || h1 || url;
    const body =
      ogDescription || ldJson.description || metaDescription || "";
    const image = ogImage || twitterImage || ldJson.image;

    return {
      externalId: url,
      title,
      body,
      images: image ? [image] : [],
      publishedAt: ldJson.datePublished ?? undefined,
    };
  }

  private parseJsonLd(
    $: cheerio.CheerioAPI
  ): { headline?: string; description?: string; image?: string; datePublished?: string } {
    const result: {
      headline?: string;
      description?: string;
      image?: string;
      datePublished?: string;
    } = {};

    $('script[type="application/ld+json"]').each((_, el) => {
      const raw = $(el).contents().text();
      if (!raw) return;
      try {
        const data = JSON.parse(raw) as unknown;
        const article = this.findNewsArticle(data);
        if (article) {
          result.headline =
            typeof article.headline === "string" ? article.headline : undefined;
          result.description =
            typeof article.description === "string"
              ? article.description
              : undefined;
          result.image =
            typeof article.image === "string" ? article.image : undefined;
          result.datePublished =
            typeof article.datePublished === "string"
              ? article.datePublished
              : undefined;
        }
      } catch {
        // JSON-LD mal formado: se ignora y se usa solo OG.
      }
    });

    return result;
  }

  private findNewsArticle(data: unknown): Record<string, unknown> | null {
    if (Array.isArray(data)) {
      for (const entry of data) {
        const found = this.findNewsArticle(entry);
        if (found) return found;
      }
      return null;
    }
    if (data && typeof data === "object") {
      const obj = data as Record<string, unknown>;
      if (obj["@type"] === "NewsArticle" || obj["@type"] === "Article") {
        return obj;
      }
      for (const value of Object.values(obj)) {
        const found = this.findNewsArticle(value);
        if (found) return found;
      }
    }
    return null;
  }
}