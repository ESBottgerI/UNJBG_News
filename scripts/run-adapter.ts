import { prisma } from "../src/lib/prisma";
import { runAdapterForSource } from "../src/adapters/runner";

// CLI de desarrollo: corre el adaptador de una fuente al instante.
//
//   npm run adapters:run -- "UNJBG Noticias"
//   npm run adapters:run -- <sourceId>
//
// Util para probar una fuente en local sin esperar al scheduler.

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error(
      'uso: npm run adapters:run -- "<nombre de la fuente>" o "<sourceId>"'
    );
    process.exit(1);
  }

  const source = await prisma.source.findFirst({
    where: {
      OR: [{ name: arg }, { id: arg }],
    },
  });

  if (!source) {
    console.error(`fuente no encontrada: ${arg}`);
    process.exit(1);
  }

  console.log(`Corriendo adaptador para: ${source.name} (${source.type})...`);
  const started = Date.now();
  const result = await runAdapterForSource(source.id);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`Finalizado en ${seconds}s`);
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());