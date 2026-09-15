"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import type { PostStatus, SourceStatus, SourceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/auth/session";

// ---------- Cola de moderacion ----------

// Convierte un RawItem en un Post. Si la fuente tiene autopublish la nota sale
// directo (PUBLISHED); si no, queda DRAFT a la espera de aprobacion manual.
export async function approveRawItem(formData: FormData): Promise<void> {
  const user = await requireUser();
  const rawItemId = String(formData.get("rawItemId") ?? "");

  const rawItem = await prisma.rawItem.findUnique({
    where: { id: rawItemId },
    include: { source: true },
  });
  if (!rawItem || !rawItem.source) {
    throw new Error("RawItem no encontrado");
  }
  if (rawItem.status === "DISCARDED") {
    throw new Error("El item ya fue descartado");
  }

  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    throw new Error("El titular es obligatorio");
  }
  const bodyHtml = String(formData.get("body") ?? "").trim();
  const imageUrl = String(formData.get("imageUrl") ?? "").trim() || null;
  const categoryId = String(formData.get("categoryId") ?? "").trim() || null;

  const status: PostStatus = rawItem.source.autopublish
    ? "PUBLISHED"
    : "DRAFT";

  await prisma.post.create({
    data: {
      rawItemId: rawItem.id,
      sourceId: rawItem.sourceId,
      title,
      bodyHtml,
      imageUrl,
      categoryId,
      status,
      authorId: user.id,
      publishedAt: status === "PUBLISHED" ? new Date() : null,
      moderatedAt: new Date(),
    },
  });

  await prisma.rawItem.update({
    where: { id: rawItem.id },
    data: { status: "PROCESSED", processedAt: new Date() },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/queue");
  revalidatePath("/admin/posts");
  redirect("/admin/posts");
}

export async function discardRawItem(formData: FormData): Promise<void> {
  await requireUser();
  const rawItemId = String(formData.get("rawItemId") ?? "");

  await prisma.rawItem.update({
    where: { id: rawItemId },
    data: { status: "DISCARDED", processedAt: new Date() },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/queue");
  redirect("/admin/queue");
}

// ---------- Posts ----------

// Cambia el estado de un post (publicar / volver a borrador / rechazar).
export async function setPostStatus(formData: FormData): Promise<void> {
  const user = await requireUser();
  const postId = String(formData.get("postId") ?? "");
  const status = String(formData.get("status") ?? "") as PostStatus;

  if (!["DRAFT", "PUBLISHED", "REJECTED"].includes(status)) {
    throw new Error("Estado invalido");
  }

  await prisma.post.update({
    where: { id: postId },
    data: {
      status,
      authorId: user.id,
      moderatedAt: new Date(),
      publishedAt: status === "PUBLISHED" ? new Date() : null,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/posts");
  revalidatePath("/admin/queue");
  redirect("/admin/posts");
}

// ---------- Categorias ----------

function toSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createCategory(formData: FormData): Promise<void> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim() || toSlug(name);
  if (!name) throw new Error("El nombre de la categoria es obligatorio");

  await prisma.category.create({ data: { name, slug } });

  revalidatePath("/admin/categories");
  redirect("/admin/categories");
}

export async function updateCategory(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("categoryId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim() || toSlug(name);
  if (!name) throw new Error("El nombre de la categoria es obligatorio");

  await prisma.category.update({ where: { id }, data: { name, slug } });

  revalidatePath("/admin/categories");
  redirect("/admin/categories");
}

export async function deleteCategory(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("categoryId") ?? "");
  await prisma.category.delete({ where: { id } });

  revalidatePath("/admin/categories");
  redirect("/admin/categories");
}

// ---------- Fuentes ----------

const VALID_SOURCE_TYPES: SourceType[] = ["WEB", "FACEBOOK", "WHATSAPP", "RSS"];
const VALID_SOURCE_STATUS: SourceStatus[] = ["ACTIVE", "PAUSED", "DISABLED"];

function parseConfig(raw: string): Prisma.InputJsonValue | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as Prisma.InputJsonValue;
  } catch {
    throw new Error("config.json invalido: debe ser JSON valido o estar vacio");
  }
}

export async function createSource(formData: FormData): Promise<void> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "") as SourceType;
  if (!name || !VALID_SOURCE_TYPES.includes(type)) {
    throw new Error("Nombre y tipo de fuente validos son obligatorios");
  }

  const url = String(formData.get("url") ?? "").trim() || null;
  const autopublish = formData.get("autopublish") === "on";
  const pollMinutesRaw = String(formData.get("pollIntervalMinutes") ?? "");
  const pollIntervalMinutes = pollMinutesRaw
    ? Number(pollMinutesRaw)
    : null;
  const config = parseConfig(String(formData.get("config") ?? ""));

  await prisma.source.create({
    data: {
      name,
      type,
      url,
      config: config ?? Prisma.JsonNull,
      autopublish,
      pollIntervalMinutes,
    },
  });

  revalidatePath("/admin/sources");
  redirect("/admin/sources");
}

export async function updateSource(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("sourceId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const status = String(formData.get("status") ?? "") as SourceStatus;
  if (!name || !VALID_SOURCE_STATUS.includes(status)) {
    throw new Error("Nombre y estado validos son obligatorios");
  }

  const url = String(formData.get("url") ?? "").trim() || null;
  const autopublish = formData.get("autopublish") === "on";
  const pollMinutesRaw = String(formData.get("pollIntervalMinutes") ?? "");
  const pollIntervalMinutes = pollMinutesRaw
    ? Number(pollMinutesRaw)
    : null;
  const config = parseConfig(String(formData.get("config") ?? ""));

  await prisma.source.update({
    where: { id },
    data: { name, url, status, autopublish, pollIntervalMinutes, config: config ?? Prisma.JsonNull },
  });

  revalidatePath("/admin/sources");
  redirect("/admin/sources");
}

export async function deleteSource(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("sourceId") ?? "");
  await prisma.source.delete({ where: { id } });

  revalidatePath("/admin/sources");
  redirect("/admin/sources");
}