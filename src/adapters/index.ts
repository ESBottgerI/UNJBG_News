import type { Source } from "@prisma/client";
import type { NewsAdapter } from "./types";
import { UnjbgAdapter } from "./unjbg";
import { SitemapWebAdapter } from "./web";
import { RssAdapter } from "./rss";
import { FacebookAdapter } from "./facebook";

// @uwe UC-09 / UC-10 / A17 — Fabrica de adaptadores.
// Decide que adaptador usar segun el tipo de fuente y su config. El registro de
// tipos ingestibles vive en lib/adapters/registry.ts y se reexporta aqui para
// conservar el contrato que consumen el runner y los tests.

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
      // WHATSAPP esta declarado en el enum pero no es un adaptador: lo consume
      // el worker (src/whatsapp/worker.ts, Fase 4), que es push y no pull.
      throw new Error(
        `tipo de fuente sin adaptador implementado: ${source.type}`
      );
  }
}

// Tipos que el runner puede procesar hoy. WEB/RSS sin navegador (Fase 2);
// FACEBOOK usa Playwright sobre contenido publico (Fase 3). El orden y la
// definicion viven en el registro para que el runner y el panel coincidan.
export { INGESTIBLE_TYPES } from "@/lib/adapters/registry";

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