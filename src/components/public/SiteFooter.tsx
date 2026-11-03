import Link from "next/link";
import type { CategoryRef } from "@/lib/posts";

export function SiteFooter({ categories }: { categories: CategoryRef[] }) {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-6 border-t border-[#ccc] bg-[#f7f7f7]">
      <div className="site-shell flex flex-wrap items-center gap-x-4 gap-y-1 py-4 text-xs text-[#666]">
        <span className="font-bold text-[#0b3d91]">UNJBG News</span>
        <Link href="/" className="hover:underline">
          Inicio
        </Link>
        {categories.map((c) => (
          <Link key={c.id} href={`/seccion/${c.slug}`} className="hover:underline">
            {c.name}
          </Link>
        ))}
        <Link href="/buscar" className="hover:underline">
          Buscar
        </Link>
        <span className="ml-auto">
          &copy; {year} UNJBG News. Noticias compiladas de fuentes publicas.
        </span>
      </div>
    </footer>
  );
}
