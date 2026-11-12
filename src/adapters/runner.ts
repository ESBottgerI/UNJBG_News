import type { Source } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ingestItem } from "../lib/ingest";
import { processRawItem } from "../lib/pipeline/process";
import { sendAlert } from "../lib/alerts";
import { envInt } from "../lib/config";
import { logger } from "../lib/logger";
import { buildAdapter, INGESTIBLE_TYPES, isDue } from "./index";
import { shouldAlertOnFailure } from "../lib/adaptation/policies";
import type { AdapterRunResult } from "./types";

const INGESTIBLE = new Set<string>(INGESTIBLE_TYPES);
const ALERT_AFTER_FAILURES = envInt("ALERT_AFTER_FAILURES", 3);
const MAX_ERROR_LENGTH = 2000;

// @uwe UC-01 / UC-10 / UC-11 / UC-20 — Runner de adaptadores.
// Runner de adaptadores: corre el adaptador de una fuente, entrega cada item
// al pipeline de ingesta (que hace dedup) y registra el resultado en la fuente
// (lastRunAt / lastError) y en el historial SourceRun (Fase 7).

export async function runAdapterForSource(
  sourceId: string
): Promise<AdapterRunResult> {
  const startedAt = new Date();
  const source = await prisma.source.findUnique({ where: { id: sourceId } });
  if (!source) {
    throw new Error(`fuente no encontrada: ${sourceId}`);
  }

  if (!INGESTIBLE.has(source.type)) {
    // WhatsApp no se consulta por intervalo: lo escucha el worker (Fase 4).
    const error =
      source.type === "WHATSAPP"
        ? "WHATSAPP no se puede probar desde aca: lo consume el worker (npm run whatsapp:start)"
        : `tipo sin adaptador: ${source.type}`;
    await markSourceError(source, error, startedAt, {});
    return { sourceId, fetched: 0, newItems: 0, duplicates: 0, error };
  }

  const adapter = buildAdapter(source);
  let fetched: Awaited<ReturnType<typeof adapter.fetchItems>>;

  try {
    fetched = await adapter.fetchItems();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markSourceError(source, message, startedAt, {});
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
        if (result.duplicate) {
          duplicates++;
        } else {
          newItems++;
          try {
            await processRawItem(result.rawItemId);
          } catch (pipelineError) {
            logger.error("pipeline.item.failed", {
              sourceId,
              rawItemId: result.rawItemId,
              error:
                pipelineError instanceof Error
                  ? pipelineError.message
                  : String(pipelineError),
            });
          }
        }
      } else {
        errors.push(result.error.message);
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  await markSourceSuccess(source, startedAt, {
    fetched: fetched.length,
    newItems,
    duplicates,
    itemErrors: errors,
  });

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

type RunCounts = {
  fetched?: number;
  newItems?: number;
  duplicates?: number;
  itemErrors?: string[];
};

async function markSourceSuccess(
  source: Source,
  startedAt: Date,
  counts: RunCounts
): Promise<void> {
  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();
  const itemErrors = counts.itemErrors ?? [];
  const error = itemErrors.length > 0 ? truncate(itemErrors.join(" | ")) : null;

  await prisma.source.update({
    where: { id: source.id },
    data: {
      lastRunAt: finishedAt,
      lastSuccessAt: finishedAt,
      lastDurationMs: durationMs,
      lastError: error,
      consecutiveFailures: 0,
    },
  });

  await prisma.sourceRun.create({
    data: {
      sourceId: source.id,
      status: "OK",
      fetched: counts.fetched ?? 0,
      newItems: counts.newItems ?? 0,
      duplicates: counts.duplicates ?? 0,
      durationMs,
      error,
      startedAt,
      finishedAt,
    },
  });

  logger.info("adapter.run.ok", {
    sourceId: source.id,
    sourceName: source.name,
    sourceType: source.type,
    durationMs,
    fetched: counts.fetched ?? 0,
    newItems: counts.newItems ?? 0,
    duplicates: counts.duplicates ?? 0,
    itemErrors: itemErrors.length,
  });

  // Aviso de recuperacion: solo si venia de una racha de fallos alertada.
  if (source.consecutiveFailures >= ALERT_AFTER_FAILURES) {
    void sendAlert({
      title: "Fuente recuperada",
      message: `${source.name} (${source.type}) volvio a responder despues de ${source.consecutiveFailures} fallos.`,
      sourceId: source.id,
      level: "info",
    });
  }
}

async function markSourceError(
  source: Source,
  message: string,
  startedAt: Date,
  counts: RunCounts
): Promise<void> {
  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();
  const safeMessage = truncate(message);

  const updated = await prisma.source.update({
    where: { id: source.id },
    data: {
      lastRunAt: finishedAt,
      lastDurationMs: durationMs,
      lastError: safeMessage,
      consecutiveFailures: { increment: 1 },
    },
  });

  await prisma.sourceRun.create({
    data: {
      sourceId: source.id,
      status: "ERROR",
      fetched: counts.fetched ?? 0,
      newItems: counts.newItems ?? 0,
      duplicates: counts.duplicates ?? 0,
      durationMs,
      error: safeMessage,
      startedAt,
      finishedAt,
    },
  });

  logger.error("adapter.run.error", {
    sourceId: source.id,
    sourceName: source.name,
    sourceType: source.type,
    durationMs,
    consecutiveFailures: updated.consecutiveFailures,
    error: safeMessage,
  });

  // Alerta solo al cruzar el umbral (evita un mensaje por cada fallo seguido).
  if (shouldAlertOnFailure(updated.consecutiveFailures, ALERT_AFTER_FAILURES)) {
    void sendAlert({
      title: "Fuente con fallos repetidos",
      message: `${source.name} (${source.type}) fallo ${ALERT_AFTER_FAILURES} veces seguidas. Ultimo error: ${safeMessage}`,
      sourceId: source.id,
      level: "error",
    });
  }
}

function truncate(value: string): string {
  return value.length > MAX_ERROR_LENGTH
    ? `${value.slice(0, MAX_ERROR_LENGTH)}...`
    : value;
}
