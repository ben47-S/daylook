# syntax=docker/dockerfile:1.7

# ── Base ──────────────────────────────────────────────
FROM node:22-slim AS base
RUN npm install -g pnpm@12.4.2
WORKDIR /app

# ── Dependencies ──────────────────────────────────────
# prisma/ + prisma7.config.ts copiés avant install : le postinstall
# (`prisma generate`) en a besoin. DATABASE_URL factice : generate ne
# se connecte pas mais le config exige une valeur.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc prisma7.config.ts ./
COPY prisma ./prisma
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/daylook"
RUN pnpm install --frozen-lockfile

# ── Builder ───────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Client Prisma régénéré (le dossier est en .dockerignore)
COPY --from=deps /app/app/generated ./app/generated

# Variables inlinées à la build (NEXT_PUBLIC_*) ou lues au build.
ARG DATABASE_URL
ARG AUTH_SECRET
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV DATABASE_URL=$DATABASE_URL
ENV AUTH_SECRET=$AUTH_SECRET
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm build

# ── Runner ────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Retrait du fond : les assets du modèle sont chargés par leur hash (via
# resources.json) — le tracing Next.js ne les suit pas, copie explicite.
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/@imgly/background-removal-node ./node_modules/@imgly/background-removal-node

# Photos des pièces : volume monté ici par docker-compose.
RUN mkdir -p /app/storage && chown nextjs:nodejs /app/storage

USER nextjs

EXPOSE 3000
CMD ["node", "server.js"]
