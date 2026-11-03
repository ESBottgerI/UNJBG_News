// Utilidades para leer searchParams en Server Components.

export type SearchParams = Record<string, string | string[] | undefined>;

export function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

// Lee ?page=N con un valor valido (>= 1). Cualquier cosa rara cae en 1.
export function readPage(sp: SearchParams): number {
  const raw = firstValue(sp.page);
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
