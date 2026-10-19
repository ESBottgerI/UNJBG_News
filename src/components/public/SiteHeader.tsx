import Link from "next/link";
import type { CategoryRef } from "@/lib/posts";
import { formatDateShort } from "@/lib/format";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block px-3 py-2 text-sm font-medium text-white/90 hover:bg-white/10 hover:text-white"
    >
      {children}
    </Link>
  );
}

// Cabecera minimal del sitio publico: masthead + barra de secciones + buscador.
export function SiteHeader({ categories }: { categories: CategoryRef[] }) {
  return (
    <header className="border-b border-[#ccc] bg-white">
      <div className="mx-auto flex max-w-[1080px] flex-wrap items-end justify-between gap-2 px-3 pt-3">
        <div>
          <Link href="/" className="text-3xl font-bold tracking-tight text-[#0b3d91]">
            UNJBG News
          </Link>
          <p className="text-xs text-[#666]">Noticias de Tacna y la region</p>
        </div>
        <div className="pb-1 text-right text-xs text-[#666]">
          {formatDateShort(new Date())}
        </div>
      </div>

      <nav className="mt-2 bg-[#0b3d91]">
        <div className="mx-auto flex max-w-[1080px] flex-wrap items-center px-3">
          <NavLink href="/">Inicio</NavLink>
          {categories.map((c) => (
            <NavLink key={c.id} href={`/seccion/${c.slug}`}>
              {c.name}
            </NavLink>
          ))}

          <form action="/buscar" method="get" className="ml-auto py-1">
            <label htmlFor="q" className="sr-only">
              Buscar noticias
            </label>
            <input
              id="q"
              name="q"
              type="search"
              placeholder="Buscar..."
              className="w-40 border border-[#0b3d91] bg-white px-2 py-1 text-sm text-[#111] placeholder:text-[#999] focus:outline-none"
            />
          </form>
        </div>
      </nav>
    </header>
  );
}
