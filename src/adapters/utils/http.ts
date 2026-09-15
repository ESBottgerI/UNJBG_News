// Utilidades de red compartidas por los adaptadores: fetch con timeout,
// reintentos simples y un User-Agent que identifica al bot (evita bloqueos).

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/126.0.0.0 Safari/537.36 UNJBG-News-Bot/0.1";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 2;

export async function fetchWithRetry(
  url: string,
  opts: {
    timeoutMs?: number;
    retries?: number;
    headers?: Record<string, string>;
  } = {}
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, retries = DEFAULT_RETRIES } = opts;
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
        await sleep(500 * (attempt + 1));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(500 * (attempt + 1));
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}