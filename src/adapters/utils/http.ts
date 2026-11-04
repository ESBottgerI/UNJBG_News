// Utilidades de red compartidas por los adaptadores: fetch con timeout,
// reintentos con backoff, respeto de Retry-After y un User-Agent que identifica
// al bot (evita bloqueos).

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/126.0.0.0 Safari/537.36 UNJBG-News-Bot/0.1";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_MAX_DELAY_MS = 30_000;
const BASE_DELAY_MS = 500;

export type FetchOptions = {
  timeoutMs?: number;
  retries?: number;
  /** Tope del backoff, incluso si el servidor pide esperar mas. */
  maxRetryDelayMs?: number;
  headers?: Record<string, string>;
};

export async function fetchWithRetry(
  url: string,
  opts: FetchOptions = {}
): Promise<Response> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    maxRetryDelayMs = DEFAULT_MAX_DELAY_MS,
  } = opts;
  let lastError: unknown;
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "*/*",
          ...opts.headers,
        },
      });

      // Reintentar solo errores transitorios de red o 5xx/429.
      if (response.status >= 500 || response.status === 429) {
        lastResponse = response;
        lastError = new Error(`HTTP ${response.status}`);
        if (attempt < retries) {
          // Si el servidor manda Retry-After, respetarlo (con tope).
          const retryAfterMs = parseRetryAfter(
            response.headers.get("retry-after")
          );
          await sleep(backoffDelay(attempt, retryAfterMs, maxRetryDelayMs));
        }
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(backoffDelay(attempt, null, maxRetryDelayMs));
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(
    `fallo al recuperar ${url}: ${
      lastResponse ? `HTTP ${lastResponse.status}` : String(lastError)
    }`
  );
}

export async function fetchText(url: string): Promise<string> {
  const response = await fetchWithRetry(url);
  return response.text();
}

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetchWithRetry(url);
  const text = await response.text();
  return JSON.parse(text) as T;
}

// Espera exponencial con jitter. Si el servidor indico Retry-After, se usa ese
// valor como base; el tope maxDelayMs evita que una fuente lenta frene todo.
function backoffDelay(
  attempt: number,
  retryAfterMs: number | null,
  maxDelayMs: number
): number {
  const exponential = Math.min(
    BASE_DELAY_MS * 2 ** attempt,
    maxDelayMs
  );
  const base = retryAfterMs ?? exponential;
  // Jitter de 0 a 50% para que varias fuentes no reintenten a la vez.
  const jitter = Math.random() * base * 0.5;
  return Math.min(base + jitter, maxDelayMs);
}

// Retry-After admite segundos ("120") o una fecha HTTP ("Wed, 21 Oct ...").
function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }
  const date = Date.parse(value);
  if (Number.isFinite(date)) {
    return Math.max(0, date - Date.now());
  }
  return null;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
