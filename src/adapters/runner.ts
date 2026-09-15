import { prisma } from "../lib/prisma";
import { ingestItem } from "../lib/ingest";
import { buildAdapter, INGESTIBLE_TYPES, isDue } from "./index";
import type { AdapterRunResult } from "./types";

const INGESTIBLE = new Set<string>(INGESTIBLE_TYPES);

// Runner de adaptadores: corre el adaptador de una fuente, entrega cada item
// al pipeline de ingesta (que hace dedup) y registra el resultado en la fuente
// (lastRunAt / lastError) para verlo en el admin.

export async function runAdapterForSource(
  sourceId: string
): Promise<AdapterRunResult> {
  const source = await prisma.source.findUnique({ where: { id: sourceId } });
  if (!source) {
    throw new Error(`fuente no encontrada: ${sourceId}`);
  }

  if (!INGESTIBLE.has(source.type)) {
    const error = `tipo sin adaptador: ${source.type}`;
    await markSourceError(sourceId, error);
    return { sourceId, fetched: 0, newItems: 0, duplicates: 0, error };
  }

  const adapter = buildAdapter(source);
  let fetched: Awaited<ReturnType<typeof adapter.fetchItems>>;

  try {
    fetched = await adapter.fetchItems();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markSourceError(sourceId, message);
    return { sourceId, fetched: 0, newItems: 0, duplicates: 0, error: message };
  }

  let newItems = 0;
  let duplicates = 0;
  const errors: string[] = [];

  for (const item of fetched) {
    try {
      const result = await ingestItem({
        sourceId,
        externalId: item.externalId,
        title: item.title,
        body: item.body,
        images: item.images,
        publishedAt: item.publishedAt,
      });
      if (result.ok) {
        if (result.duplicate) duplicates++;
        else newItems++;
      } else {
        errors.push(result.error.message);
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  await markSourceSuccess(sourceId);

  const result: AdapterRunResult = {
    sourceId,
    fetched: fetched.length,
    newItems,
    duplicates,
  };
  if (errors.length > 0) {
    result.error = errors.join(" | ");
  }
  return result;
}

// Corre las fuentes WEB/RSS activas que les toque (según pollIntervalMinutes).
// El scheduler (instrumentation.ts) llama a esto cada minuto.
export async function runDueSources(maxSources = 5): Promise<AdapterRunResult[]> {
  const sources = await prisma.source.findMany({
    where: {
      status: "ACTIVE",
      type: { in: INGESTIBLE_TYPES },
    },
  });

  const due = sources.filter((s) => isDue(s)).slice(0, maxSources);

  const results: AdapterRunResult[] = [];
  for (const source of due) {
    results.push(await runAdapterForSource(source.id));
  }
  return results;
}

async function markSourceSuccess(sourceId: string): Promise<void> {
  await prisma.source.update({
    where: { id: sourceId },
    data: { lastRunAt: new Date(), lastError: null },
  });
}

async function markSourceError(sourceId: string, message: string): Promise<void> {
  await prisma.source.update({
    where: { id: sourceId },
    data: { lastRunAt: new Date(), lastError: message },
  });
}