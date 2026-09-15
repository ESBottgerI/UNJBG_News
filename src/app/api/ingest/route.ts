import { NextRequest } from "next/server";
import { ingestItem } from "@/lib/ingest";

// Endpoint de ingesta: recibe contenido de los adaptadores.
// POST /api/ingest  con header  x-ingest-key: <INGEST_API_KEY>
//
// Body:
//   { "sourceId": "cuid" (recomendado), "externalId": "id-propio-de-la-fuente",
//     "title": "...", "body": "...", "images": ["https://..."] }
// Alternativa a sourceId: enviar "sourceName" + "sourceType".
//
// La logica de dedup y de alta vive en src/lib/ingest.ts (compartida con los
// adaptadores web, que llaman directo sin pasar por HTTP).

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

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "cuerpo JSON invalido" }, { status: 400 });
  }

  const result = await ingestItem({
    sourceId:
      typeof body.sourceId === "string" ? body.sourceId : undefined,
    sourceName:
      typeof body.sourceName === "string" ? body.sourceName : undefined,
    sourceType:
      typeof body.sourceType === "string"
        ? (body.sourceType as "WEB" | "FACEBOOK" | "WHATSAPP" | "RSS")
        : undefined,
    externalId:
      typeof body.externalId === "string" ? body.externalId : "",
    title: typeof body.title === "string" ? body.title : undefined,
    body: typeof body.body === "string" ? body.body : undefined,
    images: Array.isArray(body.images)
      ? body.images.filter((i): i is string => typeof i === "string")
      : undefined,
    publishedAt:
      typeof body.publishedAt === "string" ? body.publishedAt : undefined,
  });

  if (!result.ok) {
    return Response.json({ error: result.error.message }, {
      status: result.error.status,
    });
  }

  return Response.json({
    ok: true,
    rawItemId: result.rawItemId,
    duplicate: result.duplicate,
  });
}