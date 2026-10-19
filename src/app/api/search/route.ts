import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  if (q.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }
  const query = q.trim().replace(/\s+/g, " & ");
  const results = await prisma.$queryRaw`
    SELECT 
      p.id, p.title, p."imageUrl", p."thumbnailUrl", p."publishedAt", p."createdAt",
      ts_rank("searchVector", to_tsquery('spanish', ${query})) as rank
    FROM "Post" p
    WHERE "searchVector" @@ to_tsquery('spanish', ${query})
      AND p.status = 'PUBLISHED'
    ORDER BY rank DESC, p."publishedAt" DESC
    LIMIT 20
  `;
  return NextResponse.json({ results });
}
