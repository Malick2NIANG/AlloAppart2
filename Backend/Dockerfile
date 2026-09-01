# syntax=docker/dockerfile:1

# ─── Étape 1 : dépendances + build ───────────────────────────────────────────
# Debian slim (pas alpine) : évite les soucis classiques de binaire moteur
# Prisma sur musl libc.
FROM node:22-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# ─── Étape 2 : image de production ───────────────────────────────────────────
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nestjs

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER nestjs
EXPOSE 4000

CMD ["node", "dist/main"]
