import Link from "next/link";
import type { CategoryRef, PostListItem } from "@/lib/posts";
import { AdSlot } from "@/components/public/AdSlot";

function Box({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="border border-[#ccc] bg-white">
      {title ? (
        <h2 className="border-b border-[#ccc] bg-[#0b3d91] px-2 py-1 text-xs font-bold uppercase tracking-wide text-white">
          {title}
        </h2>
      ) : null}
      <div className="p-2">{children}</div>
    </section>
  );
}

// Columna izquierda: navegacion por secciones arriba (igual que "Lo mas leido"
// en la derecha) y los anuncios verticales debajo.
export function LeftRail({ categories }: { categories: CategoryRef[] }) {
  return (
    <div className="flex flex-col gap-3">
      {categories.length > 0 ? (
        <Box title="Secciones">
          <ul className="flex flex-col">
            {categories.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/seccion/${c.slug}`}
                  className="block py-1 text-sm text-[#111] hover:text-[#0b3d91] hover:underline"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </Box>
      ) : null}
      <AdSlot variant="tall" />
      <AdSlot variant="tall" />
    </div>
  );
}

// Columna derecha: "Lo mas leido" arriba y anuncios debajo.
export function RightSidebar({ mostRead }: { mostRead: PostListItem[] }) {
  return (
    <div className="flex flex-col gap-3">
      {mostRead.length > 0 ? (
        <Box title="Lo mas leido">
          <ol className="flex flex-col gap-2">
            {mostRead.map((p, i) => (
              <li key={p.id} className="flex gap-2">
                <span className="w-5 shrink-0 text-lg font-bold leading-none text-[#0b3d91]">
                  {i + 1}
                </span>
                <Link
                  href={`/noticias/${p.id}`}
                  className="text-sm font-medium leading-snug text-[#111] hover:text-[#0b3d91] hover:underline"
                >
                  {p.title}
                </Link>
              </li>
            ))}
          </ol>
        </Box>
      ) : null}
      <AdSlot variant="box" />
      <AdSlot variant="box" />
    </div>
  );
}
