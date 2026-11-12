import type { SourceType } from "@prisma/client";

// @uwe A14 / A17 — Registro de adaptadores por tipo de fuente.
//
// Centraliza qué tipos puede procesar el runner (pull), cuáles son push-only y
// qué implementación los atiende. `src/adapters/index.ts` reexporta
// `INGESTIBLE_TYPES` desde aquí para conservar el contrato existente.

export type AdapterKind =
  | "rss"
  | "web"
  | "unjbg"
  | "facebook"
  | "whatsapp-worker";

export type AdapterMetadata = {
  type: SourceType;
  /** ¿El runner puede ingerir este tipo por polling? */
  ingestible: boolean;
  /** ¿Se consulta activamente (pull) o lo alimenta un worker (push)? */
  pull: boolean;
  /** Etiqueta legible para el panel de fuentes. */
  label: string;
  /** Implementación asociada. */
  adapter: AdapterKind;
};

export const ADAPTER_REGISTRY: Record<SourceType, AdapterMetadata> = {
  WEB: {
    type: "WEB",
    ingestible: true,
    pull: true,
    label: "Web / Sitemap",
    adapter: "web",
  },
  RSS: {
    type: "RSS",
    ingestible: true,
    pull: true,
    label: "RSS / Atom",
    adapter: "rss",
  },
  FACEBOOK: {
    type: "FACEBOOK",
    ingestible: true,
    pull: true,
    label: "Facebook (Playwright)",
    adapter: "facebook",
  },
  WHATSAPP: {
    type: "WHATSAPP",
    ingestible: false,
    pull: false,
    label: "WhatsApp (worker push)",
    adapter: "whatsapp-worker",
  },
};

// El orden se mantiene estable porque los tests y el runner lo comparan.
export const INGESTIBLE_TYPES: SourceType[] = ["WEB", "RSS", "FACEBOOK"];

export function getAdapterMetadata(type: SourceType): AdapterMetadata {
  return ADAPTER_REGISTRY[type];
}

export function isIngestibleType(type: SourceType): boolean {
  return ADAPTER_REGISTRY[type].ingestible;
}

export function isPullType(type: SourceType): boolean {
  return ADAPTER_REGISTRY[type].pull;
}
