import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import type { SourceType } from "@prisma/client";

// Endpoint de ingesta: recibe contenido de los adaptadores (Fase 2+).
// POST /api/ingest  con header  x-ingest-key: <INGEST_API_KEY>
//
// Body:
//   { "sourceId": "cuid" (recomendado), "externalId": "id-propio-de-la-fuente",
//     "title": "...", "body": "...", "images": ["https://..."] }
// Alternativa a sourceId: enviar "sourceName" + "sourceType".
//
// Hace dedup por (sourceId, externalId) y por hash de contenido: si el item
// ya existe devuelve 200 con duplicate:true (operacion idempotente).

type IngestBody = {
  sourceId?: string;
  sourceName?: string;
  sourceType?: SourceType;
  externalId: string;
  title?: string;
  body?: string;
  images?: string[];
};

const EXPECTED_KEY = process.env.INGEST_API_KEY;

export async function POST(request: NextRequest) {
  if (!EXPECTED_KEY) {
    return Response.json(
      { error: "INGEST_API_KEY no configurado en el servidor" },
      { status: 500 }
    );
  }

  const key = request.headers.get("x-ingest-key");
  if (key !== EXPECTED_KEY) {
    return Response.json({ error: "no autorizado" }, { status: 401 });
  }

  let body: IngestBody;
  try {
    body = (await request.json()) as IngestBody;
  } catch {
    return Response.json({ error: "cuerpo JSON invalido" }, { status: 400 });
  }

  const { externalId, title, body: bodyText, images, sourceName, sourceType } =
    body;
  if (typeof externalId !== "string" || !externalId.trim()) {
    return Response.json(
      { error: "externalId es obligatorio" },
      { status: 400 }
    );
  }

  // Resolver la fuente por id o por (name + type).
  let sourceId = typeof body.sourceId === "string" ? body.sourceId : undefined;
  if (!sourceId) {
    if (typeof sourceName !== "string" || !sourceName) {
      return Response.json(
        { error: "sourceId o sourceName+sourceType son obligatorios" },
        { status: 400 }
      );
    }
    const type = sourceType ?? "WEB";
    const source = await prisma.source.findUnique({
      where: { name_type: { name: sourceName, type } },
    });
    if (!source) {
      return Response.json(
        { error: "fuente no encontrada para ese nombre+tipo" },
        { status: 404 }
      );
    }
    sourceId = source.id;
  }

  const source = await prisma.source.findUnique({ where: { id: sourceId } });
  if (!source) {
    return Response.json({ error: "fuente no encontrada" }, { status: 404 });
  }

  const imageList = Array.isArray(images)
    ? images.filter((i): i is string => typeof i === "string")
    : [];

  const contentHash = createHash("sha256")
    .update([title ?? "", bodyText ?? "", ...imageList].join("\n"))
    .digest("hex");

  const existing = await prisma.rawItem.findUnique({
    where: { sourceId_externalId: { sourceId, externalId } },
  });
  if (existing) {
    return Response.json({
      ok: true,
      rawItemId: existing.id,
      duplicate: true,
    });
  }

  const rawItem = await prisma.rawItem.create({
    data: {
      sourceId,
      externalId,
      title: title ? String(title).trim() : null,
      payload: {
        title: title ?? null,
        body: bodyText ?? "",
        images: imageList,
        receivedAt: new Date().toISOString(),
      },
      images: imageList.length > 0 ? imageList : undefined,
      contentHash,
    },
  });

  return Response.json({
    ok: true,
    rawItemId: rawItem.id,
    duplicate: false,
  });
}