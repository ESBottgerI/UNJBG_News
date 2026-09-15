import { PrismaClient } from "@prisma/client";

// Datos de ejemplo del registry de fuentes (Fase 0).
// En la practica, cada fuente real se agrega/edita desde el panel admin (Fase 1).

const prisma = new PrismaClient();

const sources = [
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

async function main() {
  for (const source of sources) {
    await prisma.source.upsert({
      where: {
        name_type: { name: source.name, type: source.type },
      },
      update: {},
      create: source,
    });
    console.log(`Fuente listada: ${source.name} (${source.type})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());