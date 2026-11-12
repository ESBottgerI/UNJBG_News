import type { Post, PostStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sanitizeBody } from "@/lib/pipeline/sanitize";
import {
  publishedAtFor,
  resolvePublicationStatus,
} from "@/lib/adaptation/policies";
import {
  assertPostTransition,
  assertRawItemTransition,
} from "@/lib/domain/state-machines";

// @uwe UC-03 / UC-04 / UC-05 / UC-07 — Servicio de moderación.
//
// Concentra las reglas de negocio que antes vivían en las Server Actions. Las
// actions quedan delgadas: autorizan, delegan, revalidan y redirigen. Ver
// docs/uwe/05-modelo-proceso/01-diagramas-actividad.md y
// docs/uwe/02-modelo-conceptual/03-restricciones-ocl.md.

export type ApproveRawItemInput = {
  rawItemId: string;
  title: string;
  body: string;
  imageUrl?: string | null;
  categoryId?: string | null;
  authorId: string;
};

export type SetPostStatusInput = {
  postId: string;
  status: PostStatus;
  authorId: string;
};

const VALID_POST_STATUS: readonly PostStatus[] = [
  "DRAFT",
  "PUBLISHED",
  "REJECTED",
];

/**
 * Convierte un RawItem en Post. El estado inicial lo decide la política de
 * adaptación (`autopublish`) y el cuerpo se sanea siempre antes de persistir.
 */
export async function approveRawItem(
  input: ApproveRawItemInput
): Promise<Post> {
  const rawItem = await prisma.rawItem.findUnique({
    where: { id: input.rawItemId },
    include: { source: true },
  });

  if (!rawItem || !rawItem.source) {
    throw new Error("RawItem no encontrado");
  }
  if (rawItem.status === "DISCARDED") {
    throw new Error("El item ya fue descartado");
  }
  assertRawItemTransition(rawItem.status, "PROCESSED");

  const title = input.title.trim();
  if (!title) {
    throw new Error("El titular es obligatorio");
  }

  const bodyHtml = sanitizeBody(input.body.trim());
  const imageUrl = input.imageUrl?.trim() || null;
  const categoryId = input.categoryId?.trim() || null;
  const status = resolvePublicationStatus(rawItem.source.autopublish);
  const now = new Date();

  const post = await prisma.post.create({
    data: {
      rawItemId: rawItem.id,
      sourceId: rawItem.sourceId,
      title,
      bodyHtml,
      imageUrl,
      categoryId,
      status,
      authorId: input.authorId,
      publishedAt: publishedAtFor(status, now),
      moderatedAt: now,
    },
  });

  await prisma.rawItem.update({
    where: { id: rawItem.id },
    data: { status: "PROCESSED", processedAt: now },
  });

  return post;
}

/** Descarta un item de la cola sin crear Post. */
export async function discardRawItem(rawItemId: string): Promise<void> {
  const rawItem = await prisma.rawItem.findUnique({
    where: { id: rawItemId },
    select: { status: true },
  });

  if (!rawItem) {
    throw new Error("RawItem no encontrado");
  }
  assertRawItemTransition(rawItem.status, "DISCARDED");

  await prisma.rawItem.update({
    where: { id: rawItemId },
    data: { status: "DISCARDED", processedAt: new Date() },
  });
}

/**
 * Cambia el estado editorial de un Post manteniendo la coherencia de
 * `publishedAt` y `moderatedAt`.
 */
export async function setPostStatus(
  input: SetPostStatusInput
): Promise<void> {
  if (!VALID_POST_STATUS.includes(input.status)) {
    throw new Error("Estado invalido");
  }

  const post = await prisma.post.findUnique({
    where: { id: input.postId },
    select: { status: true },
  });
  if (!post) {
    throw new Error("Post no encontrado");
  }
  assertPostTransition(post.status, input.status);

  const now = new Date();
  await prisma.post.update({
    where: { id: input.postId },
    data: {
      status: input.status,
      authorId: input.authorId,
      moderatedAt: now,
      publishedAt: publishedAtFor(input.status, now),
    },
  });
}
