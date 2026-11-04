import { listCategories } from "@/lib/posts";
import { SiteHeader } from "@/components/public/SiteHeader";
import { SiteFooter } from "@/components/public/SiteFooter";

// El sitio publico se renderiza en cada request (noticias recien publicadas)
// y ademas evita que el build necesite la base de datos.
export const dynamic = "force-dynamic";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const categories = await listCategories();

  return (
    <div className="min-h-screen bg-white text-[#111]">
      <SiteHeader categories={categories} />
      <main className="site-shell">{children}</main>
      <SiteFooter categories={categories} />
    </div>
  );
}
