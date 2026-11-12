import type { PostStatus } from "@prisma/client";

// @uwe ADP-C1..C7 / RNF-24 — Políticas de adaptación.
//
// Centralizan las decisiones que antes estaban dispersas en el pipeline, en las
// Server Actions y en el panel de fuentes. Ver
// docs/uwe/06-modelo-adaptacion/02-reglas-adaptacion.md.

/**
 * Decide el estado inicial de un Post según la política de publicación de la
 * fuente o del pipeline.
 */
export function resolvePublicationStatus(autopublish: boolean): PostStatus {
  return autopublish ? "PUBLISHED" : "DRAFT";
}

/** Indica si una fuente puede publicar sin moderación manual. */
export function canAutoPublish(source: { autopublish: boolean }): boolean {
  return source.autopublish === true;
}

/**
 * Fecha de publicación coherente con el estado. `PUBLISHED` siempre lleva
 * `publishedAt`; el resto de estados lo dejan nulo.
 */
export function publishedAtFor(
  status: PostStatus,
  now: Date = new Date()
): Date | null {
  return status === "PUBLISHED" ? now : null;
}

/**
 * La alerta de fallos se dispara exactamente al cruzar el umbral, no en cada
 * fallo posterior (evita spam de notificaciones).
 */
export function shouldAlertOnFailure(
  consecutiveFailures: number,
  threshold: number
): boolean {
  return threshold > 0 && consecutiveFailures === threshold;
}

/**
 * Una fuente `WHATSAPP` no se consulta por polling: la consume el worker push.
 */
export function isPushOnlySource(type: string): boolean {
  return type === "WHATSAPP";
}
