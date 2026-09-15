import type { Source } from "@prisma/client";

// Contrato comun de los adaptadores (Fase 2).
// Cada adaptador traduce lo que lee de su fuente a items normalizados que
// luego entrega al pipeline de ingesta (src/lib/ingest.ts) con dedup.

export type FetchedItem = {
  // Identificador propio de la fuente (post id, message id, URL del articulo).
  // Se usa para dedup por (sourceId, externalId).
  externalId: string;
  title: string;
  body?: string;
  images?: string[];
  // Fecha reportada por la fuente (texto libre o ISO). La normalizacion a
  // fecha real se hace en el pipeline (Fase 5).
  publishedAt?: string;
};

export type AdapterRunResult = {
  sourceId: string;
  fetched: number;
  newItems: number;
  duplicates: number;
  error?: string;
};

export interface NewsAdapter {
  readonly source: Source;
  // Trae los items mas recientes de la fuente. No hace dedup: esa tarea la
  // hace el runner al entregar cada item al pipeline de ingesta.
  fetchItems(): Promise<FetchedItem[]>;
}