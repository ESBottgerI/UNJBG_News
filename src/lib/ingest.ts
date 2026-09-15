import { createHash } from "crypto";
import type { SourceType } from "@prisma/client";
import { prisma } from "./prisma";

// Logica compartida de ingesta. La usa la API (POST /api/ingest) y tambien
// los adaptadores web (Fase 2) directamente, sin pasar por HTTP.
//
// Hace dedup por (sourceId, externalId) y por hash de contenido: si el item
// ya existe devuelve duplicate=true (operacion idempotente).

export type IngestInput = {
  sourceId?: string;
  sourceName?: string;
  sourceType?: SourceType;
  externalId: string;
  title?: string;
  body?: string;
  images?: string[];
  publishedAt?: string;
};

export type IngestErrorType = {
  status: number;
  message: string;
};

export type IngestResult =
  | { ok: true; rawItemId: string; duplicate: boolean }
  | { ok: false; error: IngestErrorType };

function ingestFail(status: number, message: string): IngestResult {
  return { ok: false, error: { status, message } };
}

export async function ingestItem(input: IngestInput): Promise<IngestResult> {
  const { externalId, title, body, images, sourceName, sourceType } = input;
  if (typeof externalId !== "string" || !externalId.trim()) {
    return ingestFail(400, "externalId es obligatorio");
  }

  // Resolver la fuente por id o por (name + type).
  let sourceId = typeof input.sourceId === "string" ? input.sourceId : undefined;
  if (!sourceId) {
    if (typeof sourceName !== "string" || !sourceName) {
      return ingestFail(
        400,
        "sourceId o sourceName+sourceType son obligatorios"
      );
    }
    const type = sourceType ?? "WEB";
    const source = await prisma.source.findUnique({
      where: { name_type: { name: sourceName, type } },
    });
    if (!source) {
      return ingestFail(404, "fuente no encontrada para ese nombre+tipo");
    }
    sourceId = source.id;
  }

  const source = await prisma.source.findUnique({ where: { id: sourceId } });
  if (!source) {
    return ingestFail(404, "fuente no encontrada");
  }

  const imageList = Array.isArray(images)
    ? images.filter((i): i is string => typeof i === "string")
    : [];

  const contentHash = createHash("sha256")
    .update([title ?? "", body ?? "", ...imageList].join("\n"))
    .digest("hex");

  const existing = await prisma.rawItem.findUnique({
    where: { sourceId_externalId: { sourceId, externalId } },
  });
  if (existing) {
    return { ok: true, rawItemId: existing.id, duplicate: true };
  }

  const rawItem = await prisma.rawItem.create({
    data: {
      sourceId,
      externalId,
      title: title ? String(title).trim() : null,
      payload: {
        title: title ?? null,
        body: body ?? "",
        images: imageList,
        publishedAt: input.publishedAt ?? null,
        receivedAt: new Date().toISOString(),
      },
      images: imageList.length > 0 ? imageList : undefined,
      contentHash,
    },
  });

  return { ok: true, rawItemId: rawItem.id, duplicate: false };
}