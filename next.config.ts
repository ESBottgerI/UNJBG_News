import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
