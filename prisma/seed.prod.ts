import { PrismaClient, Prisma } from "@prisma/client";
import type { SourceStatus, SourceType } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

// Seed de PRODUCCION.
//
// Crea las categorias, las fuentes iniciales y el usuario administrador. No
// crea raw_items de ejemplo ni usuarios con credenciales fijas.
//
// Requiere en el entorno:
//   SEED_ADMIN_EMAIL, SEED_ADMIN_NAME, SEED_ADMIN_PASSWORD
//
// Uso:
//   npx tsx prisma/seed.prod.ts
//   docker compose -f compose.prod.yaml --profile seed run --rm seed

const prisma = new PrismaClient();

type SourceSeed = {
  name: string;
  type: SourceType;
  url?: string | null;
  config: Prisma.InputJsonValue;
  autopublish: boolean;
  pollIntervalMinutes?: number;
  status?: SourceStatus;
};

const sourceSeeds: SourceSeed[] = [
  {
    name: "UNJBG Noticias",
    type: "WEB",
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
    type: "WEB",
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
    type: "FACEBOOK",
    url: "https://www.facebook.com/UNJBG.ocim/",
    config: { pageId: "UNJBG.ocim" },
    // El contenido scrapeado de Facebook conviene moderarlo antes de publicar.
    autopublish: false,
    pollIntervalMinutes: 60,
  },
  {
    name: "UNJBG CU (Centro Universitario)",
    type: "FACEBOOK",
    url: "https://www.facebook.com/UNJBGCU/",
    config: { pageId: "UNJBGCU" },
    autopublish: false,
    pollIntervalMinutes: 60,
  },
  {
    name: "UNJBG Grupo Comunidad",
    type: "FACEBOOK",
    url: "https://facebook.com/groups/2043096719504792/",
    config: { groupId: "2043096719504792", privateGroup: true },
    autopublish: false,
    // Grupo privado: requiere sesion (fuera de alcance). Pausado.
    status: "PAUSED",
  },
  {
    name: "Grupo WhatsApp (ejemplo)",
    type: "WHATSAPP",
    config: { chatId: "" },
    autopublish: false,
    status: "PAUSED",
  },
  {
    name: "Canal WhatsApp (ejemplo)",
    type: "WHATSAPP",
    config: { chatId: "" },
    autopublish: false,
    status: "PAUSED",
  },
];

const categorySeeds = [
  { slug: "local", name: "Local" },
  { slug: "unjbg", name: "UNJBG" },
  { slug: "regional", name: "Regional" },
  { slug: "nacional", name: "Nacional" },
  { slug: "otros", name: "Otros" },
];

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value;
}

async function main() {
  const adminEmail = required("SEED_ADMIN_EMAIL");
  const adminName = required("SEED_ADMIN_NAME");
  const adminPassword = required("SEED_ADMIN_PASSWORD");

  if (adminPassword.length < 12) {
    throw new Error("SEED_ADMIN_PASSWORD debe tener al menos 12 caracteres");
  }

  const facebookAutopublish = process.env.SEED_FACEBOOK_AUTOPUBLISH === "true";

  for (const category of categorySeeds) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {},
      create: category,
    });
    console.log(`Categoria lista: ${category.name}`);
  }

  for (const source of sourceSeeds) {
    const autopublish =
      source.type === "FACEBOOK" ? facebookAutopublish : source.autopublish;

    await prisma.source.upsert({
      where: {
        name_type: { name: source.name, type: source.type },
      },
      update: {
        url: source.url,
        config: source.config,
        autopublish,
        status: source.status ?? "ACTIVE",
        pollIntervalMinutes: source.pollIntervalMinutes ?? null,
      },
      create: {
        name: source.name,
        type: source.type,
        url: source.url,
        config: source.config,
        autopublish,
        status: source.status ?? "ACTIVE",
        pollIntervalMinutes: source.pollIntervalMinutes ?? null,
      },
    });
    console.log(`Fuente lista: ${source.name} (${source.type})`);
  }

  const passwordHash = await hashPassword(adminPassword);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { name: adminName, passwordHash, role: "ADMIN" },
    create: {
      email: adminEmail,
      name: adminName,
      passwordHash,
      role: "ADMIN",
    },
  });
  console.log(`Admin listo: ${adminEmail}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
