import { createHash } from "crypto";
import { PrismaClient } from "@prisma/client";
import type { Source } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

// Datos iniciales:
// - Registry de fuentes (reales: portal UNJBG + redes de la universidad)
// - Usuarios del panel admin
// - Categorias por defecto
// - raw_items de ejemplo para probar la cola de moderacion

const prisma = new PrismaClient();

// Fuentes iniciales. Por fases: WEB/RSS se ingieren en Fase 2; FACEBOOK
// (Fase 3) y WHATSAPP (Fase 4) quedan registrados para los proximos pasos.
const sourceSeeds = [
  {
    name: "UNJBG Noticias",
    type: "WEB" as const,
    url: "https://unjbg.edu.pe/0022ba85-8ffb-4e47-2850-08d7986baac7",
    config: {
      adapter: "unjbg",
      sectionId: "0022ba85-8ffb-4e47-2850-08d7986baac7",
    },
    autopublish: true,
    pollIntervalMinutes: 15,
  },
  {
    name: "UNJBG Comunicados",
    type: "WEB" as const,
    url: "https://unjbg.edu.pe/ecbc3691-7440-4c6f-b242-08dc0151b45c",
    config: {
      adapter: "unjbg",
      sectionId: "ecbc3691-7440-4c6f-b242-08dc0151b45c",
    },
    autopublish: true,
    pollIntervalMinutes: 15,
  },
  {
    name: "UNJBG OCIM (Imagen)",
    type: "FACEBOOK" as const,
    url: "https://www.facebook.com/UNJBG.ocim/",
    config: { pageId: "UNJBG.ocim" },
    autopublish: true,
  },
  {
    name: "UNJBG CU (Centro Universitario)",
    type: "FACEBOOK" as const,
    url: "https://www.facebook.com/UNJBGCU/",
    config: { pageId: "UNJBGCU" },
    autopublish: true,
  },
  {
    name: "UNJBG Grupo Comunidad",
    type: "FACEBOOK" as const,
    url: "https://facebook.com/groups/2043096719504792/",
    config: { groupId: "2043096719504792", privateGroup: true },
    autopublish: false,
  },
];

const categorySeeds = [
  { slug: "local", name: "Local" },
  { slug: "unjbg", name: "UNJBG" },
  { slug: "regional", name: "Regional" },
  { slug: "nacional", name: "Nacional" },
  { slug: "otros", name: "Otros" },
];

const userSeeds: {
  email: string;
  name: string;
  password: string;
  role: "ADMIN" | "EDITOR";
}[] = [
  {
    email: "admin@unjbg.local",
    name: "Admin UNJBG",
    password: "unjbg_dev_admin",
    role: "ADMIN",
  },
  {
    email: "editor@unjbg.local",
    name: "Editor",
    password: "unjbg_dev_editor",
    role: "EDITOR",
  },
];

// raw_items de ejemplo para probar la cola de moderacion (Fase 1).
const sampleRawItems = [
  {
    sourceName: "UNJBG Noticias",
    externalId: "demo-001",
    title: "Inauguran obra de saneamiento en distrito de Tacna",
    body: "Las autoridades inauguraron una nueva etapa de la obra de saneamiento que beneficiara a mas de 3000 vecinos de la zona este de la ciudad.",
  },
  {
    sourceName: "UNJBG Comunicados",
    externalId: "demo-002",
    title: "Suspenden clases por lluvias intensas en la region",
    body: "Las UGEL de la region suspendieron las clases por las lluvias intensas registradas en las ultimas horas. Comunidad atenta a los comunicados oficiales.",
  },
  {
    sourceName: "UNJBG OCIM (Imagen)",
    externalId: "demo-003",
    title: "Universidad anuncia jornada de admision para proximo semestre",
    body: "La casa superior de estudios publico el cronograma del siguiente proceso de admision. Las inscripciones inician la proxima semana.",
  },
];

async function main() {
  const createdSources = new Map<string, Source>();

  for (const source of sourceSeeds) {
    const saved = await prisma.source.upsert({
      where: {
        name_type: { name: source.name, type: source.type },
      },
      update: {
        url: source.url,
        config: source.config,
        autopublish: source.autopublish,
        status: "ACTIVE",
        pollIntervalMinutes: source.pollIntervalMinutes ?? null,
      },
      create: source,
    });
    createdSources.set(saved.name, saved);
    console.log(`Fuente listada: ${saved.name} (${saved.type})`);
  }

  // Quitar fuentes de ejemplo de fases anteriores que quedaron con URLs
  // falsas (ejemplo.com), para que el scheduler no intente poll aca.
  const oldPlaceholders = [
    "DigitalTacna",
    "RSS Gobierno Regional",
    "Noticias del Valle (canal)",
    "Radio Tacna 99.7",
  ];
  const deleted = await prisma.source.deleteMany({
    where: { name: { in: oldPlaceholders } },
  });
  if (deleted.count > 0) {
    console.log(`Fuentes placeholder eliminadas: ${deleted.count}`);
  }

  for (const category of categorySeeds) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {},
      create: category,
    });
    console.log(`Categoria lista: ${category.name}`);
  }

  for (const userSeed of userSeeds) {
    const passwordHash = await hashPassword(userSeed.password);
    await prisma.user.upsert({
      where: { email: userSeed.email },
      update: { name: userSeed.name, passwordHash, role: userSeed.role },
      create: {
        email: userSeed.email,
        name: userSeed.name,
        passwordHash,
        role: userSeed.role,
      },
    });
    console.log(`Usuario listo: ${userSeed.email} (${userSeed.role})`);
  }

  for (const item of sampleRawItems) {
    const source = createdSources.get(item.sourceName);
    if (!source) continue;

    const contentHash = createHash("sha256")
      .update([item.title, item.body, ""].join("\n"))
      .digest("hex");

    await prisma.rawItem.upsert({
      where: {
        sourceId_externalId: {
          sourceId: source.id,
          externalId: item.externalId,
        },
      },
      update: {},
      create: {
        sourceId: source.id,
        externalId: item.externalId,
        title: item.title,
        status: "NEW",
        payload: {
          title: item.title,
          body: item.body,
          images: [],
          receivedAt: new Date().toISOString(),
        },
        images: [],
        contentHash,
      },
    });
    console.log(`Item de ejemplo: ${item.externalId} (${item.sourceName})`);
  }

  console.log("\nCredenciales de desarrollo:");
  for (const userSeed of userSeeds) {
    console.log(`  ${userSeed.email} / ${userSeed.password}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());