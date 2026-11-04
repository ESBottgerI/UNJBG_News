import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";

// Generado por request (no en build) para no depender de la base de datos al
// construir la imagen Docker y reflejar siempre las ultimas noticias.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, categories] = await Promise.all([
    prisma.post.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true, updatedAt: true },
      orderBy: { publishedAt: "desc" },
      take: 5000,
    }),
    prisma.category.findMany({
      select: { slug: true, createdAt: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const now = new Date();

  return [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1,
    },
    ...categories.map((c) => ({
      url: `${SITE_URL}/seccion/${c.slug}`,
      lastModified: c.createdAt,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...posts.map((p) => ({
      url: `${SITE_URL}/noticias/${p.id}`,
      lastModified: p.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
  ];
}
