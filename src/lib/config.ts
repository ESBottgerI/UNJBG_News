// Helpers de configuracion leida del entorno.

// Lee un entero positivo de process.env. Si falta o es invalido, usa el valor
// por defecto (así un .env incompleto no rompe la app).
export function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw == null) return fallback;
  return !["false", "0", "off", "no"].includes(raw.trim().toLowerCase());
}
