import { createHash } from "crypto";
import { PrismaClient } from "@prisma/client";
import type { Source } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

// Datos iniciales (Fase 0 + Fase 1):
// - Registry de fuentes
// - Usuarios del panel admin
// - Categorias por defecto
// - raw_items de ejemplo para probar la cola de moderacion

const prisma = new PrismaClient();

const sourceSeeds = [
  {
    name: "DigitalTacna",
    type: "WEB" as const,
    url: "https://ejemplo.com/digitaltacna",
    config: { sitemapPath: "/sitemap.xml" },
    autopublish: true,
    pollIntervalMinutes: 30,
  },
  {
    name: "Radio Tacna 99.7",
    type: "FACEBOOK" as const,
    url: "https://facebook.com/radiotacna",
    config: { pageId: "radiotacna" },
    autopublish: false,
  },
  {
    name: "Noticias del Valle (canal)",
    type: "WHATSAPP" as const,
    url: null,
    config: { channelId: "canal-xyz" },
    autopublish: true,
  },
  {
    name: "RSS Gobierno Regional",
    type: "RSS" as const,
    url: "https://ejemplo.com/rss/gobierno-regional",
    config: {},
    autopublish: false,
    pollIntervalMinutes: 60,
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
    sourceName: "DigitalTacna",
    externalId: "demo-001",
    title: "Inauguran obra de saneamiento en distrito de Tacna",
    body: "Las autoridades inauguraron una nueva etapa de la obra de saneamiento que beneficiara a mas de 3000 vecinos de la zona este de la ciudad.",
  },
  {
    sourceName: "Noticias del Valle (canal)",
    externalId: "demo-002",
    title: "Suspenden clases por lluvias intensas en la region",
    body: "Las UGEL de la region suspendieron las clases por las lluvias intensas registradas en las ultimas horas. Comunidad atenta a los comunicados oficiales.",
  },
  {
    sourceName: "Radio Tacna 99.7",
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
      update: {},
      create: source,
    });
    createdSources.set(saved.name, saved);
    console.log(`Fuente listada: ${saved.name} (${saved.type})`);
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
        sourceId_externalId: { sourceId: source.id, externalId: item.externalId },
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