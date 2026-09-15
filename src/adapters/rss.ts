import Parser from "rss-parser";
import type { Source } from "@prisma/client";
import type { FetchedItem, NewsAdapter } from "./types";
import { fetchText } from "./utils/http";

// Adaptador para feeds RSS/Atom. Descarga el XML con el mismo http util
// (timeout + reintentos + User-Agent) y lo parsea con rss-parser.
// Si el item trae <content:encoded> usa ese cuerpo; si no, el resumen
// (contentSnippet).

const MAX_DEFAULT_ITEMS = 20;

type RssItem = {
  guid?: string;
  link?: string;
  title?: string;
  contentSnippet?: string;
  content?: string;
  isoDate?: string;
  pubDate?: string;
  enclosure?: { url?: string; type?: string };
  mediaContent?: Array<{ $?: { url?: string } } | { url?: string }>;
};

export class RssAdapter implements NewsAdapter {
  readonly source: Source;

  constructor(source: Source) {
    this.source = source;
  }

  private get config(): Record<string, unknown> {
    return (this.source.config ?? {}) as Record<string, unknown>;
  }

  async fetchItems(): Promise<FetchedItem[]> {
    if (!this.source.url) {
      throw new Error("fuente RSS sin url");
    }

    const xml = await fetchText(this.source.url);
    const parser = new Parser<RssItem, unknown>();
    const feed = await parser.parseString(xml);

    const maxItems =
      typeof this.config.maxItems === "number"
        ? this.config.maxItems
        : MAX_DEFAULT_ITEMS;

    const items: FetchedItem[] = [];
    for (const item of feed.items.slice(0, maxItems)) {
      const externalId = item.guid || item.link;
      if (!externalId) continue;

      const body = cleanBody(item.content ?? item.contentSnippet ?? "");
      const images = extractImages(item);

      items.push({
        externalId,
        title: item.title ?? "Sin titulo",
        body,
        images,
        publishedAt: item.isoDate ?? item.pubDate ?? undefined,
      });
    }

    return items;
  }
}

// El cuerpo del feed suele venir con HTML incrustado: lo dejamos como texto
// plano (las etiquetas figcaption/videos no aportan al texto de la noticia).
function cleanBody(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractImages(item: RssItem): string[] {
  const images: string[] = [];
  const mediaUrl = firstMediaUrl(item.mediaContent);
  if (mediaUrl) images.push(mediaUrl);

  const enclosure =
    item.enclosure?.url && (!item.enclosure.type || item.enclosure.type.startsWith("image/"))
      ? item.enclosure.url
      : undefined;
  if (enclosure && !images.includes(enclosure)) images.push(enclosure);

  // Ultima opcion: cualquier <img src> dentro del contenido.
  if (item.content) {
    const matches = [...item.content.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)];
    for (const match of matches) {
      if (match[1] && images.length < 3) images.push(match[1]);
    }
  }
  return images;
}

function firstMediaUrl(mediaContent: RssItem["mediaContent"]): string | undefined {
  if (!Array.isArray(mediaContent)) return undefined;
  for (const entry of mediaContent) {
    const url =
      typeof entry === "object" && "url" in entry && typeof entry.url === "string"
        ? entry.url
        : undefined;
    if (url) return url;
  }
  return undefined;
}