import type { Metadata } from "next";
import Link from "next/link";
import { getMostRead, searchPublished, type SearchResult } from "@/lib/posts";
import { formatDateShort } from "@/lib/format";
import { firstValue, type SearchParams } from "@/lib/search-params";
import { RightSidebar } from "@/components/public/Sidebar";
import { EmptyState } from "@/components/public/EmptyState";
import { PostImage } from "@/components/public/PostImage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Buscar",
  description: "Busca noticias por palabra clave.",
  robots: { index: false, follow: true },
};

export default async function BuscarPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = firstValue(sp.q).trim();

  let results: SearchResult[] = [];
  let failed = false;
  if (q.length >= 2) {
    try {
      results = await searchPublished(q);
    } catch {
      failed = true;
    }
  }

  const mostRead = await getMostRead();

  return (
    <div className="pub-grid pub-grid--no-left">
      <div className="min-w-0">
        <h1 className="mb-3 border-b-2 border-[#0b3d91] pb-1 text-xl font-bold uppercase text-[#0b3d91]">
          Buscar noticias
        </h1>

        <form action="/buscar" method="get" className="mb-4 flex gap-2">
          <label htmlFor="q" className="sr-only">
            Palabra clave
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Escribe una o mas palabras..."
            className="w-full border border-[#ccc] px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="border border-[#0b3d91] bg-[#0b3d91] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a347c]"
          >
            Buscar
          </button>
        </form>

        {q.length < 2 ? (
          <EmptyState
            title="Escribe al menos 2 letras"
            message="Se buscara en el titulo y el contenido de las noticias publicadas."
          />
        ) : failed ? (
          <EmptyState title="No se pudo completar la busqueda" />
        ) : results.length === 0 ? (
          <EmptyState title={`Sin resultados para "${q}"`} message="Prueba con otras palabras." />
        ) : (
          <>
            <p className="mb-2 text-xs text-[#666]">
              {results.length} resultado{results.length === 1 ? "" : "s"} para “{q}”
            </p>
            <div className="feed-grid">
              {results.map((r) => (
                <article
                  key={r.id}
                  className="flex gap-3 border border-[#ccc] bg-white p-3"
                >
                  {r.thumbnailUrl || r.imageUrl ? (
                    <Link
                      href={`/noticias/${r.id}`}
                      className="block h-[72px] w-[96px] shrink-0 overflow-hidden bg-[#ececec]"
                    >
                      <PostImage
                        src={r.thumbnailUrl ?? r.imageUrl}
                        alt={r.title}
                        sizes="96px"
                      />
                    </Link>
                  ) : null}
                  <div className="min-w-0 break-words">
                    <h2 className="text-base font-bold leading-snug">
                      <Link
                        href={`/noticias/${r.id}`}
                        className="text-[#111] hover:text-[#0b3d91] hover:underline"
                      >
                        {r.title}
                      </Link>
                    </h2>
                    <p className="mt-1 text-xs text-[#666]">
                      {formatDateShort(r.publishedAt)}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>

      <aside>
        <RightSidebar mostRead={mostRead} />
      </aside>
    </div>
  );
}
