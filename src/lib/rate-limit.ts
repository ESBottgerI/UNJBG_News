// Limitador de peticiones en memoria (Fase 7).
//
// Ventana fija por clave: cada clave tiene un contador que se reinicia al
// cumplirse `windowMs`. Es suficiente para un solo proceso Node en un VPS
// (nuestro caso). Si algun dia la app corre en varias instancias, habria que
// mover el estado a Postgres o Redis.
//
// Uso tipico en un Route Handler o Server Action:
//
//   const limit = rateLimit({ key: `login:${ip}`, limit: 5, windowMs: 60_000 });
//   if (!limit.ok) {
//     return Response.json(
//       { error: "demasiadas peticiones" },
//       { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
//     );
//   }

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 60_000;

export type RateLimitOptions = {
  /** Identifica el sujeto: ip, email, api key, etc. */
  key: string;
  /** Peticiones permitidas dentro de la ventana. */
  limit: number;
  /** Duracion de la ventana en milisegundos. */
  windowMs: number;
};

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  /** Segundos que conviene esperar antes de reintentar (para el header Retry-After). */
  retryAfterSeconds: number;
};

export function rateLimit({
  key,
  limit,
  windowMs,
}: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  maybeCleanup(now);

  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return {
      ok: true,
      limit,
      remaining: limit - 1,
      resetAt,
      retryAfterSeconds: 0,
    };
  }

  if (current.count >= limit) {
    return {
      ok: false,
      limit,
      remaining: 0,
      resetAt: current.resetAt,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((current.resetAt - now) / 1000)
      ),
    };
  }

  current.count += 1;
  return {
    ok: true,
    limit,
    remaining: limit - current.count,
    resetAt: current.resetAt,
    retryAfterSeconds: 0,
  };
}

// Borra el contador de una clave. Se usa tras un login exitoso para que los
// intentos correctos no consuman el cupo de intentos fallidos.
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

// Limpieza perezosa: como maximo una vez por minuto, elimina las ventanas ya
// vencidas para que el Map no crezca sin control.
function maybeCleanup(now: number): void {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

type HeaderReader = { get(name: string): string | null };

// IP del cliente detras de nginx. nginx agrega X-Forwarded-For; tomamos la
// primera (la del cliente original) y caemos a X-Real-IP.
export function getClientIpFromHeaders(headers: HeaderReader): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "desconocida";
}

export function getClientIp(request: Request): string {
  return getClientIpFromHeaders(request.headers);
}

// Lee un entero positivo de entorno, con valor por defecto.
export function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}
