import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

// Seed exclusivo para la suite E2E (Fase 8.1).
//
// Usa IDs fijos y predecibles (prefijo "e2e-") para que los tests puedan
// navegar a URLs conocidas. Antes de cargar, borra solo los datos de la propia
// suite, de modo que se puede correr varias veces sin acumular basura.
//
// Guard: se niega a correr contra una base que no sea *_e2e.

const DATABASE_URL = process.env.DATABASE_URL ?? "";
if (!/(_e2e)(\?|$)/i.test(DATABASE_URL)) {
  throw new Error(
    `seed.e2e solo corre contra una base *_e2e (DATABASE_URL=${DATABASE_URL})`
  );
}

const prisma = new PrismaClient();

const E2E = {
  adminEmail: "admin@e2e.test",
  editorEmail: "editor@e2e.test",
  password: "e2e-clave",
  pendingRawId: "e2e-raw-pending",
  discardRawId: "e2e-raw-discard",
  publishedPostId: "e2e-post-unjbg",
  localPostId: "e2e-post-local",
  draftPostId: "e2e-post-draft",
} as const;

async function main() {
  // La base es exclusiva de E2E (el guard de arriba lo garantiza), asi que se
  // vacia completa: evita conflictos con datos de una corrida anterior.
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Post", "RawItem", "SourceRun", "Source", "Category", "User" RESTART IDENTITY CASCADE'
  );

  const passwordHash = await hashPassword(E2E.password);

  await prisma.user.createMany({
    data: [
      {
        id: "e2e-admin",
        email: E2E.adminEmail,
        name: "Admin E2E",
        role: "ADMIN",
        passwordHash,
      },
      {
        id: "e2e-editor",
        email: E2E.editorEmail,
        name: "Editor E2E",
        role: "EDITOR",
        passwordHash,
      },
    ],
  });

  await prisma.category.createMany({
    data: [
      { id: "e2e-cat-unjbg", name: "UNJBG", slug: "unjbg" },
      { id: "e2e-cat-local", name: "Local", slug: "local" },
      { id: "e2e-cat-regional", name: "Regional", slug: "regional" },
    ],
  });

  await prisma.source.createMany({
    data: [
      {
        id: "e2e-src-autopublish",
        name: "E2E Autopublish",
        type: "WEB",
        url: "https://example.test/autopublish",
        config: { adapter: "unjbg" },
        autopublish: true,
        status: "ACTIVE",
        pollIntervalMinutes: 60,
      },
      {
        id: "e2e-src-draft",
        name: "E2E Borradores",
        type: "WEB",
        url: "https://example.test/draft",
        autopublish: false,
        status: "ACTIVE",
        pollIntervalMinutes: 60,
      },
    ],
  });

  await prisma.rawItem.createMany({
    data: [
      {
        id: E2E.pendingRawId,
        sourceId: "e2e-src-autopublish",
        externalId: "pending-1",
        status: "NEW",
        title: "Noticia pendiente de aprobacion E2E",
        payload: {
          title: "Noticia pendiente de aprobacion E2E",
          body: "<p>Contenido original pendiente.</p>",
          images: [],
          receivedAt: new Date().toISOString(),
        },
        contentHash: "e2e-hash-pending",
      },
      {
        id: E2E.discardRawId,
        sourceId: "e2e-src-draft",
        externalId: "discard-1",
        status: "NEW",
        title: "Noticia para descartar E2E",
        payload: {
          title: "Noticia para descartar E2E",
          body: "<p>Este item se descarta en el test.</p>",
          images: [],
          receivedAt: new Date().toISOString(),
        },
        contentHash: "e2e-hash-discard",
      },
    ],
  });

  await prisma.post.createMany({
    data: [
      {
        id: E2E.publishedPostId,
        sourceId: "e2e-src-autopublish",
        categoryId: "e2e-cat-unjbg",
        title: "UNJBG inaugura laboratorio de inteligencia artificial en Tacna",
        bodyHtml:
          "<p>La Universidad Nacional Jorge Basadre Grohmann inauguro un laboratorio de inteligencia artificial.</p>",
        status: "PUBLISHED",
        publishedAt: new Date("2026-10-20T10:00:00.000Z"),
        views: 25,
      },
      {
        id: E2E.localPostId,
        sourceId: "e2e-src-draft",
        categoryId: "e2e-cat-local",
        title: "Vecinos de Pocollay reportan mejora en el servicio de agua",
        bodyHtml: "<p>El servicio de agua potable mejoro en Pocollay.</p>",
        status: "PUBLISHED",
        publishedAt: new Date("2026-10-19T10:00:00.000Z"),
        views: 8,
      },
      {
        id: "e2e-post-regional",
        sourceId: "e2e-src-draft",
        categoryId: "e2e-cat-regional",
        title: "Obras del puerto de Ilo avanzan a buen ritmo",
        bodyHtml: "<p>Las obras del puerto de Ilo continuan.</p>",
        status: "PUBLISHED",
        publishedAt: new Date("2026-10-18T10:00:00.000Z"),
        views: 3,
      },
      {
        id: E2E.draftPostId,
        sourceId: "e2e-src-draft",
        categoryId: "e2e-cat-unjbg",
        title: "BORRADOR E2E no debe aparecer en el sitio publico",
        bodyHtml: "<p>Contenido en borrador.</p>",
        status: "DRAFT",
        publishedAt: null,
      },
      {
        id: "e2e-post-rejected",
        sourceId: "e2e-src-draft",
        categoryId: "e2e-cat-local",
        title: "RECHAZADO E2E no debe aparecer en el sitio publico",
        bodyHtml: "<p>Contenido rechazado.</p>",
        status: "REJECTED",
        publishedAt: null,
      },
    ],
  });

  console.log(
    [
      "seed e2e listo:",
      `  usuarios: ${E2E.adminEmail} / ${E2E.editorEmail} (clave ${E2E.password})`,
      `  posts publicados: ${E2E.publishedPostId}, ${E2E.localPostId}, e2e-post-regional`,
      `  pendientes: ${E2E.pendingRawId}, ${E2E.discardRawId}`,
    ].join("\n")
  );
}

main()
  .catch((error) => {
    console.error("seed e2e fallo:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
