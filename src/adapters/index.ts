import type { Source, SourceType } from "@prisma/client";
import type { NewsAdapter } from "./types";
import { UnjbgAdapter } from "./unjbg";
import { SitemapWebAdapter } from "./web";
import { RssAdapter } from "./rss";
import { FacebookAdapter } from "./facebook";

// Fabrica de adaptadores: decide que adaptador usar segun el tipo de fuente
// y su config. Aqui se agregan adaptadores nuevos en fases futuras
// (WHATSAPP: Fase 4).

export function buildAdapter(source: Source): NewsAdapter {
  const config = (source.config ?? {}) as Record<string, unknown>;

  switch (source.type) {
    case "RSS":
      return new RssAdapter(source);
    case "WEB":
      if (config.adapter === "unjbg") {
        return new UnjbgAdapter(source);
      }
      return new SitemapWebAdapter(source);
    case "FACEBOOK":
      return new FacebookAdapter(source);
    default:
      throw new Error(
        `tipo de fuente sin adaptador implementado: ${source.type}`
      );
  }
}

// Tipos que el runner puede procesar hoy. WEB/RSS sin navegador (Fase 2);
// FACEBOOK usa Playwright sobre contenido publico (Fase 3).
export const INGESTIBLE_TYPES: SourceType[] = ["WEB", "RSS", "FACEBOOK"];

// Solo fuentes activas y con intervalo de polling configurado.
export function isDue(
  source: Source,
  now = new Date()
): source is Source & { pollIntervalMinutes: number } {
  if (source.status !== "ACTIVE") return false;
  if (source.pollIntervalMinutes == null) return false;
  if (!source.lastRunAt) return true;
  const nextRun =
    source.lastRunAt.getTime() + source.pollIntervalMinutes * 60_000;
  return now.getTime() >= nextRun;
}