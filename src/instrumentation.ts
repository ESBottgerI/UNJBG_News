import cron from "node-cron";
import { runDueSources } from "./adapters/runner";
import { logger } from "./lib/logger";
import {
  markSchedulerError,
  markSchedulerRun,
} from "./lib/runtime-state";

// @uwe UC-20 — Scheduler de polling.
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

        // Estado para /api/health, aunque no haya fuentes pendientes.
        markSchedulerRun({
          sources: results.length,
          newItems: results.reduce((sum, r) => sum + r.newItems, 0),
          duplicates: results.reduce((sum, r) => sum + r.duplicates, 0),
        });

        if (results.length > 0) {
          logger.info("scheduler.poll", {
            sources: results.length,
            newItems: results.reduce((sum, r) => sum + r.newItems, 0),
            duplicates: results.reduce((sum, r) => sum + r.duplicates, 0),
            errors: results.filter((r) => r.error).length,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        markSchedulerError(message);
        logger.error("scheduler.poll.failed", { error: message });
      }
    },
    { name: "adapters-poll", noOverlap: true }
  );

  logger.info("scheduler.started", { interval: "1m" });
}
