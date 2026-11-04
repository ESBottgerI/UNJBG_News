// Endpoint de busqueda (JSON). El sitio publico usa directamente
// src/lib/posts.ts (searchPublished) en el Server Component /buscar; este
// endpoint queda para consumidores externos o futuros buscadores en cliente.
import { NextResponse } from "next/server";
import { searchPublished } from "@/lib/posts";
import { envInt } from "@/lib/config";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Limite de busquedas por IP (Fase 7): evita que un cliente sature la
  // busqueda full-text de Postgres.
  const limit = rateLimit({
    key: `search:${getClientIp(request)}`,
    limit: envInt("SEARCH_RATE_LIMIT_PER_MIN", 60),
    windowMs: 60_000,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { results: [], error: "demasiadas peticiones; reintenta mas tarde" },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchPublished(q);
    return NextResponse.json({ results });
  } catch (error) {
    console.error("Error en /api/search:", error);
    return NextResponse.json(
      { results: [], error: "No se pudo procesar la busqueda" },
      { status: 500 },
    );
  }
}
