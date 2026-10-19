import Link from "next/link";
import type { PostListItem } from "@/lib/posts";
import { excerpt, formatDateShort } from "@/lib/format";
import { PostImage } from "@/components/public/PostImage";

function Meta({ post }: { post: PostListItem }) {
  return (
    <div className="text-xs text-[#666]">
      {post.category ? (
        <>
          <Link
            href={`/seccion/${post.category.slug}`}
            className="font-bold uppercase text-[#0b3d91] hover:underline"
          >
            {post.category.name}
          </Link>
          <span className="mx-1 text-[#bbb]">|</span>
        </>
      ) : null}
      <span>{formatDateShort(post.publishedAt ?? post.createdAt)}</span>
      {post.source ? (
        <>
          <span className="mx-1 text-[#bbb]">|</span>
          <span>{post.source.name}</span>
        </>
      ) : null}
    </div>
  );
}

// Tarjeta principal (destacada) del feed.
export function LeadCard({ post }: { post: PostListItem }) {
  const href = `/noticias/${post.id}`;
  return (
    <article className="border border-[#ccc] bg-white">
      <Link href={href} className="block aspect-[16/9] overflow-hidden bg-[#ececec]">
        <PostImage src={post.imageUrl ?? post.thumbnailUrl} alt={post.title} sizes="600px" />
      </Link>
      <div className="p-3">
        <Meta post={post} />
        <h2 className="mt-1 text-2xl font-bold leading-tight">
          <Link href={href} className="text-[#111] hover:text-[#0b3d91] hover:underline">
            {post.title}
          </Link>
        </h2>
        {post.bodyHtml ? (
          <p className="mt-2 text-sm leading-relaxed text-[#444]">
            {excerpt(post.bodyHtml, 220)}
          </p>
        ) : null}
      </div>
    </article>
  );
}

// Tarjeta de la lista del feed.
export function PostCard({ post }: { post: PostListItem }) {
  const href = `/noticias/${post.id}`;
  const thumb = post.thumbnailUrl ?? post.imageUrl;
  return (
    <article className="flex gap-3 border-b border-[#e5e5e5] py-3 last:border-b-0">
      {thumb ? (
        <Link
          href={href}
          className="block h-[84px] w-[112px] shrink-0 overflow-hidden bg-[#ececec]"
        >
          <PostImage src={thumb} alt={post.title} sizes="112px" />
        </Link>
      ) : null}
      <div className="min-w-0">
        <h3 className="text-base font-bold leading-snug">
          <Link href={href} className="text-[#111] hover:text-[#0b3d91] hover:underline">
            {post.title}
          </Link>
        </h3>
        <p className="mt-1 line-clamp-2 text-sm text-[#555]">{excerpt(post.bodyHtml, 140)}</p>
        <div className="mt-1">
          <Meta post={post} />
        </div>
      </div>
    </article>
  );
}
