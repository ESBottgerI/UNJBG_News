import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Directorio de build. El servidor E2E local corre en paralelo al `next dev`
  // normal, asi que usa un distDir aparte (.next-e2e) para no pelear por el
  // lock de .next. En produccion y desarrollo queda el valor por defecto.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  output: "standalone",
  // Playwright se carga en runtime Node (adaptadores Fase 3+); no debe
  // empaquetarse en el bundle porque trae binarios propios (chromium-bidi, etc).
  // Baileys (Fase 4) es ESM puro y trae WASM: tambien queda fuera del bundle.
  serverExternalPackages: [
    "playwright",
    "playwright-core",
    "@whiskeysockets/baileys",
    "libsignal",
  ],
};

export default nextConfig;
