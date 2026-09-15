import { prisma } from "@/lib/prisma";

// Health-check: confirma que la app y la base de datos responden.
// El scheduler/escrapers locales tambien lo usan como "vivo".
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", db: "ok" });
  } catch {
    return Response.json({ status: "error", db: "error" }, { status: 503 });
  }
}