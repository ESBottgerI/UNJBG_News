import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import {
  getMostRead,
  getPublishedPost,
  getRelated,
  incrementPostViews,
  listCategories,
} from "@/lib/posts";
import { excerpt, formatDateLong } from "@/lib/format";
import { SITE_NAME } from "@/lib/site";
import { LeftRail, RightSidebar } from "@/components/public/Sidebar";
import { PostCard } from "@/components/public/PostCard";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = await getPublishedPost(id);
  if (!post) return { title: "Noticia no encontrada" };

  const description = excerpt(post.bodyHtml, 160);
  return {
    title: post.title,
    description,
    alternates: { canonical: `/noticias/${post.id}` },
    openGraph: {
      type: "article",
      title: post.title,
      description,
      siteName: SITE_NAME,
      url: `/noticias/${post.id}`,
      images: post.imageUrl ? [{ url: post.imageUrl }] : undefined,
      publishedTime: post.publishedAt?.toISOString(),
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
      images: post.imageUrl ? [post.imageUrl] : undefined,
    },
  };
}

export default async function NoticiaPage({ params }: Props) {
  const { id } = await params;
  const post = await getPublishedPost(id);
  if (!post) return notFound();

  // Cuenta la visita despues de responder, sin bloquear el render.
  after(() => incrementPostViews(post.id));

  const [mostRead, categories, related] = await Promise.all([
    getMostRead(),
    listCategories(),
    post.categoryId ? getRelated(post.categoryId, post.id) : Promise.resolve([]),
  ]);

  return (
    <div className="pub-grid pub-grid--article">
      <aside className="hidden lg:block">
        <LeftRail categories={categories} />
      </aside>

      <article className="min-w-0 border border-[#ccc] bg-white p-4">
        <nav className="mb-2 text-xs text-[#666]" aria-label="Ruta">
          <Link href="/" className="text-[#0b3d91] hover:underline">
            Inicio
          </Link>
          {post.category ? (
            <>
              <span className="mx-1">/</span>
              <Link
                href={`/seccion/${post.category.slug}`}
                className="text-[#0b3d91] hover:underline"
              >
                {post.category.name}
              </Link>
            </>
          ) : null}
        </nav>

        <h1 className="break-words text-3xl font-bold leading-tight">{post.title}</h1>

        <div className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-[#666]">
          {post.category ? (
            <Link
              href={`/seccion/${post.category.slug}`}
              className="font-bold uppercase text-[#0b3d91] hover:underline"
            >
              {post.category.name}
            </Link>
          ) : null}
          <span>{formatDateLong(post.publishedAt ?? post.createdAt)}</span>
          {post.source ? <span>Fuente: {post.source.name}</span> : null}
        </div>

        {post.imageUrl ? (
          <img
            src={post.imageUrl}
            alt={post.title}
            className="my-3 w-full border border-[#e5e5e5]"
          />
        ) : null}

        <div
          className="article-body"
          dangerouslySetInnerHTML={{ __html: post.bodyHtml }}
        />

        {related.length > 0 ? (
          <section className="mt-6 border-t border-[#ccc] pt-3">
            <h2 className="mb-1 text-sm font-bold uppercase text-[#0b3d91]">
              Relacionadas
            </h2>
            {related.map((r) => (
              <PostCard key={r.id} post={r} />
            ))}
          </section>
        ) : null}

        <p className="mt-6 text-xs text-[#888]">
          <Link href="/" className="hover:underline">
            &larr; Volver al inicio
          </Link>
        </p>
      </article>

      <aside>
        <RightSidebar mostRead={mostRead} />
      </aside>
    </div>
  );
}
