// Endpoint de busqueda (JSON). El sitio publico usa directamente
// src/lib/posts.ts (searchPublished) en el Server Component /buscar; este
// endpoint queda para consumidores externos o futuros buscadores en cliente.
import { NextResponse } from "next/server";
import { searchPublished } from "@/lib/posts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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
