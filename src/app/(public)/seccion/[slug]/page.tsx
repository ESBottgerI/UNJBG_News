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
    <div className="pub-grid">
      <aside className="hidden lg:block">
        <LeftRail categories={categories} />
      </aside>

      <div className="min-w-0">
        <h1 className="mb-3 border-b-2 border-[#0b3d91] pb-1 text-xl font-bold uppercase text-[#0b3d91]">
          {category.name}
        </h1>

        {list.posts.length === 0 ? (
          <EmptyState title={`Aun no hay noticias en ${category.name}`} />
        ) : (
          <div className="feed-grid">
            {lead ? (
              <div className="feed-lead">
                <LeadCard post={lead} />
              </div>
            ) : null}
            {rest.map((post) => (
              <PostCard key={post.id} post={post} variant="card" />
            ))}
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
