# API Dockerfile - Multi-stage build
FROM oven/bun:1.1.38-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/trpc/package.json ./packages/trpc/
COPY packages/shared/package.json ./packages/shared/
COPY packages/typescript-config/package.json ./packages/typescript-config/

# Install dependencies
RUN bun install --frozen-lockfile

# Builder stage
FROM base AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules 2>/dev/null || true

# Copy source code
COPY package.json bun.lock turbo.json ./
COPY apps/api ./apps/api
COPY packages ./packages

# Build the application
RUN bun run build --filter=@signal/api

# Production stage
FROM oven/bun:1.1.38-alpine AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 signal
RUN adduser --system --uid 1001 signal

# Copy built application
COPY --from=builder --chown=signal:signal /app/apps/api/dist ./dist
COPY --from=builder --chown=signal:signal /app/node_modules ./node_modules
COPY --from=builder --chown=signal:signal /app/package.json ./package.json

USER signal

# Expose port
EXPOSE 11010

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun run -e "fetch('http://localhost:11010/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))" || exit 1

# Start the application
CMD ["bun", "run", "dist/index.js"]
