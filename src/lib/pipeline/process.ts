import { prisma } from "../prisma";
import { sanitizeBody, cleanText } from "./sanitize";
import { categorize, getCategoryByName } from "./categorize";
import { processImages, type ProcessedImage } from "../media/image";
import {
  publishedAtFor,
  resolvePublicationStatus,
} from "../adaptation/policies";

// @uwe UC-01 / UC-03 / ADP-C1..C2 — Pipeline RawItem -> Post.
// El estado inicial del Post lo decide la politica de adaptacion
// (autopublish de la fuente o del runner), no una condicion inline.

export type ProcessOptions = {
  autoPublish?: boolean;
};

type RawPayload = {
  title?: unknown;
  body?: unknown;
  images?: unknown;
};

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

export async function processRawItem(rawItemId: string, options: ProcessOptions = {}) {
  const raw = await prisma.rawItem.findUnique({
    where: { id: rawItemId },
    include: { source: true, post: true },
  });

  if (!raw || raw.status !== "NEW") return null;
  if (raw.post) return raw.post;

  const payload = (raw.payload ?? {}) as RawPayload;
  const title = String(raw.title ?? payload.title ?? "Sin título");
  const body = String(payload.body ?? "");
  const imageList = [
    ...toStringArray(raw.images),
    ...toStringArray(payload.images),
  ];

  let processedImages: ProcessedImage[] = [];
  if (imageList.length > 0) {
    processedImages = await processImages(imageList);
  }

  const bodyHtml = sanitizeBody(body);
  const categoryName = categorize(title + " " + cleanText(bodyHtml));
  const category = categoryName ? await getCategoryByName(categoryName, prisma) : null;

  const autoPublish = Boolean(options.autoPublish) || raw.source.autopublish;
  const status = resolvePublicationStatus(autoPublish);
  const now = new Date();

  const post = await prisma.post.create({
    data: {
      rawItemId: raw.id,
      sourceId: raw.sourceId,
      title,
      bodyHtml,
      imageUrl: processedImages[0]?.imageUrl || null,
      thumbnailUrl: processedImages[0]?.thumbnailUrl || null,
      imageMeta: processedImages.length > 0 ? processedImages : undefined,
      categoryId: category?.id || null,
      status,
      publishedAt: publishedAtFor(status, now),
    },
  });

  await prisma.rawItem.update({
    where: { id: raw.id },
    data: { status: "PROCESSED", processedAt: now },
  });

  // Actualizar searchVector
  await prisma.$executeRaw`
    UPDATE "Post"
    SET "searchVector" = 
      setweight(to_tsvector('spanish', coalesce(title,'')), 'A') ||
      setweight(to_tsvector('spanish', coalesce("bodyHtml",'')), 'B')
    WHERE id = ${post.id}
  `;

  return post;
}

export async function processAllNew() {
  const newItems = await prisma.rawItem.findMany({
    where: { status: "NEW", post: { is: null } },
    include: { source: true },
    orderBy: { seenAt: "asc" },
  });

  const results = [];
  for (const item of newItems) {
    try {
      const post = await processRawItem(item.id);
      results.push(post);
    } catch (e) {
      console.error("Error processing", item.id, e);
    }
  }
  return results;
}
