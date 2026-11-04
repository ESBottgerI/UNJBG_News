import { createHash } from "crypto";
import type {
  Category,
  Post,
  PostStatus,
  Prisma,
  RawItem,
  Source,
  SourceStatus,
  SourceType,
  User,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";

// Helpers compartidos por la suite de integracion.
//
// Todos los tests trabajan contra la base *_test/*_e2e que valida
// tests/setup/integration.ts. Entre cada test se vacian las tablas para que el
// orden no importe y no queden residuos de una corrida anterior.

export { prisma };

let seq = 0;
export function unique(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}`;
}

export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Post", "RawItem", "SourceRun", "Source", "Category", "User" RESTART IDENTITY CASCADE'
  );
}

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}

export async function createUser(
  overrides: Partial<Prisma.UserUncheckedCreateInput> & { password?: string } = {}
): Promise<User> {
  const { password = "clave-de-test", ...rest } = overrides;
  const email = rest.email ?? `${unique("user")}@example.test`;
  return prisma.user.create({
    data: {
      email,
      name: rest.name ?? "Usuario de test",
      role: rest.role ?? "ADMIN",
      passwordHash: await hashPassword(password),
    },
  });
}

export async function createCategory(
  overrides: Partial<Prisma.CategoryUncheckedCreateInput> = {}
): Promise<Category> {
  return prisma.category.create({
    data: {
      name: overrides.name ?? unique("Categoria"),
      slug: overrides.slug ?? unique("categoria"),
    },
  });
}

export async function createSource(
  overrides: Partial<Prisma.SourceUncheckedCreateInput> = {}
): Promise<Source> {
  return prisma.source.create({
    data: {
      name: overrides.name ?? unique("Fuente"),
      type: (overrides.type ?? "WEB") as SourceType,
      status: (overrides.status ?? "ACTIVE") as SourceStatus,
      autopublish: overrides.autopublish ?? false,
      url: overrides.url ?? "https://example.test/",
      config: overrides.config ?? { adapter: "unjbg" },
      pollIntervalMinutes: overrides.pollIntervalMinutes ?? 15,
      ...overrides,
    },
  });
}

export function contentHash(title: string, body: string, images: string[] = []): string {
  return createHash("sha256")
    .update([title, body, ...images].join("\n"))
    .digest("hex");
}

export async function createRawItem(
  sourceId: string,
  overrides: Partial<Prisma.RawItemUncheckedCreateInput> = {}
): Promise<RawItem> {
  const title = overrides.title ?? unique("Titulo crudo");
  const body =
    typeof overrides.payload === "object" && overrides.payload !== null
      ? String((overrides.payload as Record<string, unknown>).body ?? "")
      : "";

  return prisma.rawItem.create({
    data: {
      sourceId,
      externalId: overrides.externalId ?? unique("ext"),
      title,
      status: overrides.status ?? "NEW",
      payload: overrides.payload ?? {
        title,
        body,
        images: [],
        receivedAt: new Date().toISOString(),
      },
      images: overrides.images ?? [],
      contentHash: overrides.contentHash ?? contentHash(title, body),
    },
  });
}

export async function createPost(
  overrides: Partial<Prisma.PostUncheckedCreateInput> & {
    status?: PostStatus;
  } = {}
): Promise<Post> {
  return prisma.post.create({
    data: {
      title: overrides.title ?? unique("Noticia"),
      bodyHtml: overrides.bodyHtml ?? "<p>Contenido de prueba</p>",
      status: overrides.status ?? "PUBLISHED",
      publishedAt:
        overrides.publishedAt ??
        (overrides.status === "DRAFT" ? null : new Date()),
      ...overrides,
    },
  });
}
