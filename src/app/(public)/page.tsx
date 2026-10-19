import { getMostRead, listCategories, listPublished } from "@/lib/posts";
import { readPage, type SearchParams } from "@/lib/search-params";
import { LeadCard, PostCard } from "@/components/public/PostCard";
import { LeftRail, RightSidebar } from "@/components/public/Sidebar";
import { Pagination } from "@/components/public/Pagination";
import { EmptyState } from "@/components/public/EmptyState";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = readPage(sp);

  const [list, mostRead, categories] = await Promise.all([
    listPublished({ page }),
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
        {list.posts.length === 0 ? (
          list.total > 0 ? (
            <EmptyState
              title="No hay noticias en esta pagina"
              message="Es posible que hayas llegado al final del listado."
            />
          ) : (
            <EmptyState
              title="Aun no hay noticias publicadas"
              message="Las noticias apareceran aqui cuando las fuentes se procesen."
            />
          )
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

        <Pagination page={list.page} pageCount={list.pageCount} basePath="/" />
      </div>

      <aside>
        <RightSidebar mostRead={mostRead} />
      </aside>
    </div>
  );
}
