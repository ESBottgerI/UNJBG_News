import type { Source } from "@prisma/client";

// Fuente en memoria para tests de adaptadores. No toca la base de datos.
export function makeSource(overrides: Partial<Source> = {}): Source {
  const now = new Date("2026-10-18T12:00:00.000Z");
  const base: Source = {
    id: "source-test",
    name: "Fuente de test",
    type: "WEB",
    url: "https://example.test/",
    config: {},
    autopublish: false,
    status: "ACTIVE",
    pollIntervalMinutes: 15,
    lastRunAt: null,
    lastError: null,
    lastSuccessAt: null,
    lastDurationMs: null,
    consecutiveFailures: 0,
    createdAt: now,
    updatedAt: now,
  };
  // El spread va al final para que `url: null` o `config: null` no se
  // reemplacen por el valor por defecto.
  return { ...base, ...overrides };
}
