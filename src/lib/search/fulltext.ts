import { prisma } from "../prisma";

export async function updatePostSearchVector(postId: string) {
  await prisma.$executeRaw`
    UPDATE "Post"
    SET "searchVector" = 
      setweight(to_tsvector('spanish', coalesce(title,'')), 'A') ||
      setweight(to_tsvector('spanish', coalesce("bodyHtml",'')), 'B')
    WHERE id = ${postId}
  `;
}

export async function searchPosts(query: string, limit = 20) {
  if (!query || query.trim().length < 2) return [];
  const q = query.trim().replace(/\s+/g, " & ");

  return prisma.$queryRaw`
    SELECT 
      p.*,
      ts_rank("searchVector", to_tsquery('spanish', ${q})) as rank
    FROM "Post" p
    WHERE "searchVector" @@ to_tsquery('spanish', ${q})
      AND p.status = 'PUBLISHED'
    ORDER BY rank DESC, p."publishedAt" DESC
    LIMIT ${limit}
  `;
}
