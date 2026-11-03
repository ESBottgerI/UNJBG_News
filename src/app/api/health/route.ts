import { prisma } from "@/lib/prisma";
import { envInt } from "@/lib/config";
import { getSchedulerState } from "@/lib/runtime-state";

// Health-check (Fase 7): confirma que la app y la base de datos responden y
// expone el estado del pipeline (cola, fuentes con fallos y scheduler).
//
// - Sin `?strict=1` siempre responde 200 si la BD responde; el campo `status`
//   puede ser "degraded" para que lo lea un panel.
// - Con `?strict=1` responde 503 cuando hay algo degradado, util para un
//   monitor externo (Uptime Kuma, healthchecks, etc.).

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await prisma.$queryRaw`SELECT 1`;

    const alertAfter = envInt("ALERT_AFTER_FAILURES", 3);
    const [pendingRaw, draftPosts, activeSources, failingSources] =
      await Promise.all([
        prisma.rawItem.count({ where: { status: "NEW" } }),
        prisma.post.count({ where: { status: "DRAFT" } }),
        prisma.source.count({ where: { status: "ACTIVE" } }),
        prisma.source.count({
          where: {
            status: "ACTIVE",
            consecutiveFailures: { gte: alertAfter },
          },
        }),
      ]);

    const schedulerEnabled =
      process.env.ENABLE_ADAPTER_SCHEDULER !== "false";
    const scheduler = getSchedulerState();
    const staleAfterMs =
      envInt("HEALTH_SCHEDULER_STALE_MIN", 5) * 60_000;
    const schedulerStale =
      schedulerEnabled &&
      (scheduler.lastRunAt === null ||
        Date.now() - scheduler.lastRunAt > staleAfterMs);

    const degraded = schedulerStale || failingSources > 0;
    const strict = new URL(request.url).searchParams.get("strict") === "1";

    return Response.json(
      {
        status: degraded ? "degraded" : "ok",
        db: "ok",
        queue: { pendingRaw, draftPosts },
        sources: { active: activeSources, failing: failingSources },
        scheduler: {
          enabled: schedulerEnabled,
          stale: schedulerStale,
          lastRunAt: scheduler.lastRunAt
            ? new Date(scheduler.lastRunAt).toISOString()
            : null,
          lastError: scheduler.lastError,
          lastSummary: scheduler.lastSummary,
        },
        uptimeSeconds: Math.round(process.uptime()),
      },
      { status: strict && degraded ? 503 : 200 }
    );
  } catch {
    return Response.json({ status: "error", db: "error" }, { status: 503 });
  }
}
