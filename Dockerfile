# Multi-stage build for the Next.js app. Used both for the optional
# "everything in Docker" local dev path (see docker-compose.yml) and, later,
# as the base for the Cloud Run deploy — see CLAUDE.md.
#
# No Prisma binaryTargets/OS concerns here: the schema uses the driver-adapter
# generator (@prisma/adapter-pg), so there's no native query-engine binary to
# match to the container's OS/libc, unlike classic Prisma Client.

FROM node:24-alpine AS base
WORKDIR /app

FROM base AS deps
# Next.js itself needs glibc-compatible shims on musl-based Alpine.
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Placeholder, real value only needed at runtime — prisma generate reads the
# schema's provider, it doesn't connect to a database.
ENV DATABASE_URL="postgresql://user:password@localhost:5432/db"
RUN npx prisma generate
RUN npm run build

# --- Runtime image: only what `output: "standalone"` says is actually needed ---
FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
# Required: the standalone server binds to localhost by default, which is
# unreachable from outside the container.
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
