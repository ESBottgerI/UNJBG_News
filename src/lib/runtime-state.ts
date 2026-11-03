// Estado en memoria del scheduler de adaptadores (Fase 7).
//
// El scheduler vive en el mismo proceso que la app (instrumentation.ts), asi
// que /api/health puede leer aqui para saber si las corridas siguen vivas.
// Al reiniciar el proceso el estado arranca vacio: eso es intencional, un
// health-check posterior a un reinicio debe volver a ver una corrida nueva.

export type SchedulerState = {
  lastRunAt: number | null;
  lastError: string | null;
  lastSummary: { sources: number; newItems: number; duplicates: number } | null;
};

const globalKey = "__unjbgSchedulerState";
const g = globalThis as typeof globalThis & {
  [globalKey]?: SchedulerState;
};

export function getSchedulerState(): SchedulerState {
  return (
    g[globalKey] ?? {
      lastRunAt: null,
      lastError: null,
      lastSummary: null,
    }
  );
}

export function markSchedulerRun(summary: {
  sources: number;
  newItems: number;
  duplicates: number;
}): void {
  g[globalKey] = {
    lastRunAt: Date.now(),
    lastError: null,
    lastSummary: summary,
  };
}

export function markSchedulerError(message: string): void {
  const previous = getSchedulerState();
  g[globalKey] = {
    lastRunAt: previous.lastRunAt,
    lastError: message,
    lastSummary: previous.lastSummary,
  };
}
