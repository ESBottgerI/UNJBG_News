import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Playwright se carga en runtime Node (adaptadores Fase 3+); no debe
  // empaquetarse en el bundle porque trae binarios propios (chromium-bidi, etc).
  serverExternalPackages: ["playwright", "playwright-core"],
};

export default nextConfig;
