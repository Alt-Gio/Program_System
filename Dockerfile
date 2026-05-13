# ─────────────────────────────────────────────────────────────
# DICT R5 PMS — Next.js production image
#
# Multi-stage:
#   1. deps    → install npm deps with cache-friendly layer
#   2. builder → run `next build` (needs all deps + source)
#   3. runner  → minimal image w/ only the standalone server + static files
#
# Build:
#   docker build -t dict-pms:latest .
#
# Run (standalone):
#   docker run --rm -p 3000:3000 --env-file .env.local dict-pms:latest
#
# Image size target: ~180 MB (vs ~900 MB without standalone output).
# ─────────────────────────────────────────────────────────────

# ── Stage 1: install dependencies ────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# libc6-compat is needed by some native node modules (sharp, etc).
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund && npm install sharp


# ── Stage 2: build ───────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Copy deps from previous stage.
COPY --from=deps /app/node_modules ./node_modules

# Copy only the dirs Next.js needs to build. Adjust if you add new
# top-level source dirs (e.g. styles/, types/).
COPY package.json package-lock.json ./
COPY next.config.mjs ./
COPY tsconfig.json ./
COPY postcss.config.mjs ./
COPY tailwind.config.ts ./
COPY components.json ./
COPY middleware.ts ./
COPY app ./app
COPY components ./components
COPY lib ./lib
COPY convex ./convex
COPY public ./public

# Public Convex URL must be available at build time so it gets baked
# into the client bundle. Override via `--build-arg` when convenient.
ARG NEXT_PUBLIC_CONVEX_URL
ARG NEXT_PUBLIC_CONVEX_SITE_URL
ARG NEXT_PUBLIC_FACE_SERVER_HTTP
ARG NEXT_PUBLIC_FACE_SERVER_WS
ARG NEXT_PUBLIC_MAPBOX_TOKEN
ENV NEXT_PUBLIC_CONVEX_URL=${NEXT_PUBLIC_CONVEX_URL}
ENV NEXT_PUBLIC_CONVEX_SITE_URL=${NEXT_PUBLIC_CONVEX_SITE_URL}
ENV NEXT_PUBLIC_FACE_SERVER_HTTP=${NEXT_PUBLIC_FACE_SERVER_HTTP}
ENV NEXT_PUBLIC_FACE_SERVER_WS=${NEXT_PUBLIC_FACE_SERVER_WS}
ENV NEXT_PUBLIC_MAPBOX_TOKEN=${NEXT_PUBLIC_MAPBOX_TOKEN}

RUN npm run build


# ── Stage 3: minimal runtime ─────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as a non-root user.
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Standalone build output: a tiny server.js + only the deps it actually uses.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public           ./public

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
