"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import type { PostStatus, SourceStatus, SourceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/auth/session";
import * as moderation from "@/lib/moderation/service";

// El sitio publico se renderiza con force-dynamic, asi que no depende de la
// cache. Estas revalidaciones limpian la Router Cache del cliente para que al
// volver al sitio publico se vea el cambio al instante.
function revalidatePublic() {
  revalidatePath("/");
  revalidatePath("/buscar");
}

// ---------- Cola de moderacion ----------

// Convierte un RawItem en un Post. La logica de negocio (saneamiento, politica
// de publicacion y transiciones de estado) vive en el servicio de moderacion;
// esta action solo autoriza, delega, revalida y redirige.
export async function approveRawItem(formData: FormData): Promise<void> {
  const user = await requireUser();

  await moderation.approveRawItem({
    rawItemId: String(formData.get("rawItemId") ?? ""),
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
    imageUrl: String(formData.get("imageUrl") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    authorId: user.id,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/queue");
  revalidatePath("/admin/posts");
  revalidatePublic();
  redirect("/admin/posts");
}

export async function discardRawItem(formData: FormData): Promise<void> {
  await requireUser();
  const rawItemId = String(formData.get("rawItemId") ?? "");

  await moderation.discardRawItem(rawItemId);

  revalidatePath("/admin");
  revalidatePath("/admin/queue");
  redirect("/admin/queue");
}

// ---------- Posts ----------

// Cambia el estado de un post (publicar / volver a borrador / rechazar).
export async function setPostStatus(formData: FormData): Promise<void> {
  const user = await requireUser();

  await moderation.setPostStatus({
    postId: String(formData.get("postId") ?? ""),
    status: String(formData.get("status") ?? "") as PostStatus,
    authorId: user.id,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/posts");
  revalidatePath("/admin/queue");
  revalidatePublic();
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
  revalidatePublic();
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
  revalidatePublic();
  redirect("/admin/categories");
}

export async function deleteCategory(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("categoryId") ?? "");
  await prisma.category.delete({ where: { id } });

  revalidatePath("/admin/categories");
  revalidatePublic();
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

// Corre el adaptador de una fuente al instante (Fase 2). Los tipos sin
// adaptador (FACEBOOK/WHATSAPP por ahora) devuelven un resultado con error.
export async function pollSource(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("sourceId") ?? "");
  const { runAdapterForSource } = await import("@/adapters/runner");
  await runAdapterForSource(id);

  revalidatePath("/admin/sources");
}