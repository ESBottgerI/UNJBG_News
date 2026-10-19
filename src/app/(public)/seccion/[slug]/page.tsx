import { notFound } from "next/navigation";
import {
  getCategoryBySlug,
  getMostRead,
  listCategories,
  listPublished,
} from "@/lib/posts";
import { readPage, type SearchParams } from "@/lib/search-params";
import { LeadCard, PostCard } from "@/components/public/PostCard";
import { LeftRail, RightSidebar } from "@/components/public/Sidebar";
import { Pagination } from "@/components/public/Pagination";
import { EmptyState } from "@/components/public/EmptyState";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
};

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "Seccion no encontrada" };
  return {
    title: category.name,
    description: `Noticias de ${category.name} compiladas por UNJBG News.`,
    alternates: { canonical: `/seccion/${category.slug}` },
  };
}

export default async function SeccionPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;

  const category = await getCategoryBySlug(slug);
  if (!category) return notFound();

  const page = readPage(sp);
  const [list, mostRead, categories] = await Promise.all([
    listPublished({ page, categorySlug: slug }),
    getMostRead(),
    listCategories(),
  ]);

  const [lead, ...rest] = list.posts;

  return (
    <div className="grid grid-cols-1 gap-4 py-4 lg:grid-cols-[160px_minmax(0,1fr)_300px]">
      <aside className="hidden lg:block">
        <LeftRail categories={categories} />
      </aside>

      <div>
        <h1 className="mb-3 border-b-2 border-[#0b3d91] pb-1 text-xl font-bold uppercase text-[#0b3d91]">
          {category.name}
        </h1>

        {list.posts.length === 0 ? (
          <EmptyState title={`Aun no hay noticias en ${category.name}`} />
        ) : (
          <div className="flex flex-col gap-4">
            {lead ? <LeadCard post={lead} /> : null}
            {rest.length > 0 ? (
              <div className="border border-[#ccc] bg-white px-3">
                {rest.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            ) : null}
          </div>
        )}

        <Pagination
          page={list.page}
          pageCount={list.pageCount}
          basePath={`/seccion/${category.slug}`}
        />
      </div>

      <aside>
        <RightSidebar mostRead={mostRead} />
      </aside>
    </div>
  );
}
