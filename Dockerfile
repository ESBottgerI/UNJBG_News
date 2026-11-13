# syntax=docker/dockerfile:1

# Base comun: Node 22 sobre Debian. Chromium (adaptador Facebook) necesita las
# bibliotecas de Debian; Alpine las recibe distinto y complica el runner.
FROM node:22-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PNPM_HOME="/pnpm" \
    PATH="$PNPM_HOME:$PATH"
WORKDIR /app

# Dependencias (incluye devDeps: prisma y tsx).
FROM base AS deps
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# Build de Next.js + cliente de Prisma.
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV SKIP_ENV_VALIDATION=1
RUN npx prisma generate \
 && npm run build

# Chromium para el adaptador de Facebook. Stage aparte: solo se copia
# /ms-playwright al runner, sin arrastrar node_modules.
FROM base AS browsers
COPY --from=deps /app/node_modules ./node_modules
RUN npx playwright install --with-deps chromium

# Produccion: sitio + API + scheduler de adaptadores + Chromium.
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME="0.0.0.0"
# Bibliotecas de runtime de Chromium.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates \
      libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
      libdrm2 libdbus-1-3 libxkbcommon0 libxcomposite1 libxdamage1 \
      libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 \
      libcairo2 libatspi2.0-0 libx11-6 libxcb1 libxext6 libxi6 \
      libxtst6 libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/* \
 && addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs \
 && mkdir -p /app/public/media /ms-playwright \
 && chown -R nextjs:nodejs /app /ms-playwright
COPY --from=browsers --chown=nextjs:nodejs /ms-playwright /ms-playwright
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Playwright queda fuera del bundle (serverExternalPackages): asegurar que los
# paquetes esten junto al standalone.
COPY --from=deps /app/node_modules/playwright ./node_modules/playwright
COPY --from=deps /app/node_modules/playwright-core ./node_modules/playwright-core
COPY --from=deps /app/node_modules/chromium-bidi ./node_modules/chromium-bidi
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]

# Migraciones (one-shot): prisma CLI + schema. Usa DIRECT_URL.
FROM base AS migrate
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npx prisma generate
CMD ["npx", "prisma", "migrate", "deploy"]

# Worker de WhatsApp (Baileys) y seed de produccion.
FROM base AS worker
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json ./
COPY prisma ./prisma
COPY scripts ./scripts
COPY src ./src
RUN npx prisma generate \
 && addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs \
 && mkdir -p /app/public/media /app/.wa-auth \
 && chown -R nextjs:nodejs /app
USER nextjs
CMD ["npx", "tsx", "scripts/whatsapp-worker.ts"]
