import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Capa de datos del sitio publico (Fase 6). Todas las consultas filtran
// status = PUBLISHED para que borradores y rechazados nunca se filtren al
// sitio publico.

export const PAGE_SIZE = 12;
export const MOST_READ_LIMIT = 5;
export const RELATED_LIMIT = 4;

// Campos minimos para las tarjetas/listados del sitio publico.
const postListSelect = {
  id: true,
  title: true,
  bodyHtml: true,
  imageUrl: true,
  thumbnailUrl: true,
  publishedAt: true,
  createdAt: true,
  category: { select: { id: true, name: true, slug: true } },
  source: { select: { id: true, name: true } },
} satisfies Prisma.PostSelect;

export type PostListItem = Prisma.PostGetPayload<{ select: typeof postListSelect }>;

export type PostWithMeta = Prisma.PostGetPayload<{
  include: { category: true; source: true };
}>;

export type CategoryRef = {
  id: string;
  name: string;
  slug: string;
};

export type PaginatedPosts = {
  posts: PostListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

const orderByNewest: Prisma.PostOrderByWithRelationInput[] = [
  { publishedAt: "desc" },
  { createdAt: "desc" },
];

// Listado paginado de noticias publicadas, opcionalmente por categoria.
export async function listPublished(
  options: { page?: number; pageSize?: number; categorySlug?: string } = {},
): Promise<PaginatedPosts> {
  const pageSize = options.pageSize ?? PAGE_SIZE;
  const page = Math.max(1, Math.trunc(options.page ?? 1));

  const where: Prisma.PostWhereInput = { status: "PUBLISHED" };
  if (options.categorySlug) {
    where.category = { slug: options.categorySlug };
  }

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: orderByNewest,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: postListSelect,
    }),
    prisma.post.count({ where }),
  ]);

  return {
    posts,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// Noticia completa para la ficha. Devuelve null si no esta publicada.
// Memoizada: generateMetadata y la pagina piden la misma noticia.
export const getPublishedPost = cache(
  async (id: string): Promise<PostWithMeta | null> => {
    return prisma.post.findFirst({
      where: { id, status: "PUBLISHED" },
      include: { category: true, source: true },
    });
  },
);

// "Lo mas leido": ordena por visitas. Mientras no haya visitas acumuladas,
// el orden por publishedAt descendente hace que se comporte como "lo mas
// reciente", asi la seccion nunca queda vacia.
export async function getMostRead(limit = MOST_READ_LIMIT): Promise<PostListItem[]> {
  return prisma.post.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ views: "desc" }, ...orderByNewest],
    take: limit,
    select: postListSelect,
  });
}

// Noticias relacionadas de la misma categoria (excluyendo la actual).
export async function getRelated(
  categoryId: string,
  excludeId: string,
  limit = RELATED_LIMIT,
): Promise<PostListItem[]> {
  return prisma.post.findMany({
    where: { status: "PUBLISHED", categoryId, id: { not: excludeId } },
    orderBy: orderByNewest,
    take: limit,
    select: postListSelect,
  });
}

export const listCategories = cache(async (): Promise<CategoryRef[]> => {
  return prisma.category.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });
});

export async function getCategoryBySlug(slug: string): Promise<CategoryRef | null> {
  return prisma.category.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });
}

export type SearchResult = {
  id: string;
  title: string;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  publishedAt: Date | null;
};

// Busqueda full-text en espanol. websearch_to_tsquery nunca falla con
// entradas arbitrarias del usuario (a diferencia de to_tsquery).
export async function searchPublished(q: string, limit = 20): Promise<SearchResult[]> {
  const query = q.trim();
  if (query.length < 2) return [];

  return prisma.$queryRaw<SearchResult[]>`
    SELECT p."id", p."title", p."imageUrl", p."thumbnailUrl", p."publishedAt"
    FROM "Post" p
    WHERE p."searchVector" @@ websearch_to_tsquery('spanish', ${query})
      AND p.status = 'PUBLISHED'
    ORDER BY ts_rank(p."searchVector", websearch_to_tsquery('spanish', ${query})) DESC,
             p."publishedAt" DESC
    LIMIT ${limit}
  `;
}

// Suma una visita. Fire-and-forget para poder llamarla desde after().
export async function incrementPostViews(id: string): Promise<void> {
  try {
    await prisma.post.update({
      where: { id },
      data: { views: { increment: 1 } },
    });
  } catch {
    // El contador es best-effort: si falla, no debe romper la pagina.
  }
}
