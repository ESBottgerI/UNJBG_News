import cron from "node-cron";
import { runDueSources } from "./adapters/runner";

// Scheduler de adaptadores (Fase 2).
//
// Usa el hook `register` de Next.js (instrumentation.ts): corre una sola vez
// cuando arranca el servidor Node. Cada minuto revisa que fuentes WEB/RSS
// activas tienen pendiente su polling (pollIntervalMinutes) y las procesa.
//
// Se puede desactivar con ENABLE_ADAPTER_SCHEDULER=false (util en desarrollo
// si no se quiere que el servidor haga los polling solo).

export function register() {
  // Solo el runtime Node del servidor.
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }
  // Durante `next build` no se debe programar nada.
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return;
  }
  if (process.env.ENABLE_ADAPTER_SCHEDULER === "false") {
    return;
  }

  // Evitar duplicar el job cuando dev recarga el server.
  const g = globalThis as { __adapterSchedulerStarted?: boolean };
  if (g.__adapterSchedulerStarted) {
    return;
  }
  g.__adapterSchedulerStarted = true;

  cron.schedule(
    "* * * * *",
    async () => {
      try {
        const results = await runDueSources(5);
        if (results.length > 0) {
          const summary = results
            .map(
              (r) =>
                `${r.sourceId}: new=${r.newItems} dup=${r.duplicates}${
                  r.error ? ` error=${r.error}` : ""
                }`
            )
            .join(" | ");
          console.log(`[adapters] poll completado -> ${summary}`);
        }
      } catch (error) {
        console.error(
          "[adapters] error en poll:",
          error instanceof Error ? error.message : error
        );
      }
    },
    { name: "adapters-poll", noOverlap: true }
  );

  console.log("[adapters] scheduler iniciado (cada 1 min)");
}