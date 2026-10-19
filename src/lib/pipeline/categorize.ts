export const CATEGORIES = {
  LOCAL: "Local",
  UNJBG: "UNJBG",
  REGIONAL: "Regional",
  NACIONAL: "Nacional",
  OTROS: "Otros"
} as const;

const rules: Record<string, string[]> = {
  UNJBG: ["unjbg", "universidad", "basadre", "grohmann", "pregrado", "postgrado", "ocim", "biblioteca", "cafae", "fau", "fce", "fia", "fib", "fic", "fiq", "fics", "fm", "csalud"],
  LOCAL: ["tacna", "calana", "pocollay", "alto de la alianza", "gregorio albarracin"],
  REGIONAL: ["moquegua", "ilo", "candarave", "jorge basadre", "tarata"],
  NACIONAL: ["lima", "peru", "congreso", "ministerio", "presidente", "pcm", "poder judicial"],
};

export function categorize(text: string, currentCategoryId?: string | null): string | null {
  if (currentCategoryId) return currentCategoryId;
  if (!text) return null;

  const lower = text.toLowerCase();
  for (const [catSlug, keywords] of Object.entries(rules)) {
    if (keywords.some(k => lower.includes(k))) {
      if (catSlug === "NACIONAL") return "Nacional";
      if (catSlug === "UNJBG") return "UNJBG";
      if (catSlug === "LOCAL") return "Local";
      if (catSlug === "REGIONAL") return "Regional";
    }
  }
  return "Otros";
}

export async function getCategoryByName(name: string, prisma: any): Promise<{ id: string } | null> {
  const cat = await prisma.category.findUnique({ where: { name } });
  return cat;
}
