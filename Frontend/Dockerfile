# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Les variables NEXT_PUBLIC_* sont figées dans le bundle au build — elles
# doivent être passées ici en --build-arg (voir docker-compose.prod.yml),
# pas seulement au runtime.
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SOKETI_APP_KEY
ARG NEXT_PUBLIC_SOKETI_HOST
ARG NEXT_PUBLIC_SOKETI_PORT
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SOKETI_APP_KEY=$NEXT_PUBLIC_SOKETI_APP_KEY
ENV NEXT_PUBLIC_SOKETI_HOST=$NEXT_PUBLIC_SOKETI_HOST
ENV NEXT_PUBLIC_SOKETI_PORT=$NEXT_PUBLIC_SOKETI_PORT
RUN npm run build

# ─── Image de production — build "standalone" Next.js ───────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
