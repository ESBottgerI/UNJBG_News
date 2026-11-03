import Link from "next/link";

function windowPages(current: number, total: number, span = 2): number[] {
  const start = Math.max(1, current - span);
  const end = Math.min(total, current + span);
  const pages: number[] = [];
  for (let p = start; p <= end; p++) pages.push(p);
  return pages;
}

// Paginacion simple por links (server component). basePath es la ruta sin
// query, por ejemplo "/" o "/seccion/local".
export function Pagination({
  page,
  pageCount,
  basePath,
}: {
  page: number;
  pageCount: number;
  basePath: string;
}) {
  if (pageCount <= 1) return null;

  const href = (p: number) => (p <= 1 ? basePath : `${basePath}?page=${p}`);
  const current = Math.min(Math.max(1, page), pageCount);
  const pages = windowPages(current, pageCount);

  const base = "border border-[#ccc] px-3 py-1 text-sm";
  const link = `${base} bg-white text-[#0b3d91] hover:bg-[#f0f0f0]`;
  const disabled = `${base} text-[#bbb]`;

  return (
    <nav className="flex flex-wrap items-center gap-1 py-4" aria-label="Paginacion">
      {current > 1 ? (
        <Link href={href(current - 1)} className={link}>
          &laquo; Anterior
        </Link>
      ) : (
        <span className={disabled}>&laquo; Anterior</span>
      )}

      {pages[0] > 1 ? <span className="px-1 text-[#999]">…</span> : null}

      {pages.map((p) =>
        p === current ? (
          <span key={p} className={`${base} bg-[#0b3d91] font-bold text-white`}>
            {p}
          </span>
        ) : (
          <Link key={p} href={href(p)} className={link}>
            {p}
          </Link>
        ),
      )}

      {pages[pages.length - 1] < pageCount ? (
        <span className="px-1 text-[#999]">…</span>
      ) : null}

      {current < pageCount ? (
        <Link href={href(current + 1)} className={link}>
          Siguiente &raquo;
        </Link>
      ) : (
        <span className={disabled}>Siguiente &raquo;</span>
      )}
    </nav>
  );
}
