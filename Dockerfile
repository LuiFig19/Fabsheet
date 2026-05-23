# Multi-stage build producing a small standalone Next.js image.
FROM node:20-alpine AS base
# Prisma needs OpenSSL on Alpine, or its engine fails to start.
RUN apk add --no-cache openssl libc6-compat && npm install -g pnpm@10
WORKDIR /app

# --- deps ---
FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* .npmrc* ./
COPY prisma ./prisma
RUN pnpm install --no-frozen-lockfile

# --- build ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate && pnpm build

# --- runtime ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl libc6-compat \
  && addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Standalone server + static assets + Prisma engine/schema for migrations.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.pnpm ./node_modules/.pnpm
COPY --from=build /app/node_modules/prisma ./node_modules/prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/.bin ./node_modules/.bin

RUN mkdir -p /app/uploads && chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

# Apply schema then start the standalone server.
CMD ["sh", "-c", "node_modules/.bin/prisma db push --skip-generate && node server.js"]
