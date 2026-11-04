import { NextRequest } from "next/server";
import { ingestItem } from "@/lib/ingest";
import { envInt } from "@/lib/config";
import {
  getClientIp,
  rateLimit,
  type RateLimitResult,
} from "@/lib/rate-limit";

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

function tooManyRequests(result: RateLimitResult): Response {
  return Response.json(
    { error: "demasiadas peticiones; reintenta mas tarde" },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
      },
    }
  );
}

export async function POST(request: NextRequest) {
  if (!EXPECTED_KEY) {
    return Response.json(
      { error: "INGEST_API_KEY no configurado en el servidor" },
      { status: 500 }
    );
  }

  // Limite de peticiones por IP (Fase 7). Los adaptadores locales casi nunca
  // superan esto; protege el endpoint si queda expuesto.
  const limit = rateLimit({
    key: `ingest:${getClientIp(request)}`,
    limit: envInt("INGEST_RATE_LIMIT_PER_MIN", 120),
    windowMs: 60_000,
  });
  if (!limit.ok) {
    return tooManyRequests(limit);
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