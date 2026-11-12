import type { IngestStatus, PostStatus, SourceStatus } from "@prisma/client";

// @uwe UC-03 / UC-05 / UC-07 — Máquinas de estado del dominio.
//
// Formalizan las transiciones válidas de RawItem, Post y Source (ver
// docs/uwe/05-modelo-proceso/03-maquinas-estado.md). Son funciones puras para
// poder usarlas tanto en Server Actions como en el pipeline y en tests.

export const RAW_ITEM_TRANSITIONS: Record<
  IngestStatus,
  readonly IngestStatus[]
> = {
  NEW: ["PROCESSED", "DISCARDED"],
  PROCESSED: [],
  DISCARDED: [],
};

// Un post puede moverse entre cualquier estado editorial. La transición a sí
// mismo se permite para que `setPostStatus` sea idempotente.
export const POST_TRANSITIONS: Record<PostStatus, readonly PostStatus[]> = {
  DRAFT: ["DRAFT", "PUBLISHED", "REJECTED"],
  PUBLISHED: ["DRAFT", "PUBLISHED", "REJECTED"],
  REJECTED: ["DRAFT", "PUBLISHED", "REJECTED"],
};

// El administrador puede activar, pausar o deshabilitar una fuente en cualquier
// momento; la transición a sí mismo también es idempotente.
export const SOURCE_TRANSITIONS: Record<SourceStatus, readonly SourceStatus[]> = {
  ACTIVE: ["ACTIVE", "PAUSED", "DISABLED"],
  PAUSED: ["ACTIVE", "PAUSED", "DISABLED"],
  DISABLED: ["ACTIVE", "PAUSED", "DISABLED"],
};

function canTransition<T extends string>(
  allowed: Record<T, readonly T[]>,
  from: T,
  to: T
): boolean {
  return allowed[from]?.includes(to) ?? false;
}

function assertTransition<T extends string>(
  entity: string,
  allowed: Record<T, readonly T[]>,
  from: T,
  to: T
): void {
  if (!canTransition(allowed, from, to)) {
    throw new Error(`Transicion invalida de ${entity}: ${from} -> ${to}`);
  }
}

export function canTransitionRawItem(
  from: IngestStatus,
  to: IngestStatus
): boolean {
  return canTransition(RAW_ITEM_TRANSITIONS, from, to);
}

export function assertRawItemTransition(
  from: IngestStatus,
  to: IngestStatus
): void {
  assertTransition("RawItem", RAW_ITEM_TRANSITIONS, from, to);
}

export function canTransitionPost(from: PostStatus, to: PostStatus): boolean {
  return canTransition(POST_TRANSITIONS, from, to);
}

export function assertPostTransition(from: PostStatus, to: PostStatus): void {
  assertTransition("Post", POST_TRANSITIONS, from, to);
}

export function canTransitionSource(
  from: SourceStatus,
  to: SourceStatus
): boolean {
  return canTransition(SOURCE_TRANSITIONS, from, to);
}

export function assertSourceTransition(
  from: SourceStatus,
  to: SourceStatus
): void {
  assertTransition("Source", SOURCE_TRANSITIONS, from, to);
}

// Predicados de estado usados por las guardas de negocio.
export function isPublished(status: PostStatus): boolean {
  return status === "PUBLISHED";
}

export function isFinalIngestStatus(status: IngestStatus): boolean {
  return status !== "NEW";
}

export function isSourcePollable(status: SourceStatus): boolean {
  return status === "ACTIVE";
}
