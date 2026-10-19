import "../src/lib/env";
import { prisma } from "../src/lib/prisma";
import { processAllNew } from "../src/lib/pipeline/process";

async function main() {
  const results = await processAllNew();
  console.log(`Procesados: ${results.length}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
