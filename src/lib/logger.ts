// Logger estructurado minimo (Fase 7).
//
// Imprime una linea JSON por evento, asi los logs se pueden filtrar por
// campo (sourceId, runId, etc.) en el VPS sin agregar dependencias.
//
// Nivel configurable con LOG_LEVEL: debug | info | warn | error (default info).

type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const MIN_LEVEL = LEVELS[(process.env.LOG_LEVEL as Level) ?? "info"] ?? LEVELS.info;

function write(level: Level, event: string, fields?: Record<string, unknown>) {
  if (LEVELS[level] < MIN_LEVEL) return;

  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  });

  if (level === "error" || level === "warn") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (event: string, fields?: Record<string, unknown>) =>
    write("debug", event, fields),
  info: (event: string, fields?: Record<string, unknown>) =>
    write("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) =>
    write("warn", event, fields),
  error: (event: string, fields?: Record<string, unknown>) =>
    write("error", event, fields),
};
