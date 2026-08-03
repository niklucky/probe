FROM oven/bun:1.1.38-alpine@sha256:c1cc397e0be452c54f37cbcdfaa747eff93c993723af7d91658764d0fdfe5873 AS builder

WORKDIR /app
COPY package.json bun.lock turbo.json ./
COPY apps ./apps
COPY packages ./packages
RUN bun install --frozen-lockfile
RUN bun run build --filter=@probe/api --filter=@probe/web

FROM oven/bun:1.1.38-alpine@sha256:c1cc397e0be452c54f37cbcdfaa747eff93c993723af7d91658764d0fdfe5873 AS runtime

WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S -g 10001 probe && adduser -S -D -H -u 10001 -G probe probe
COPY --from=builder --chown=probe:probe /app/apps/api/dist/index.js ./dist/index.js
# Drizzle loads SQL migrations from __dirname at runtime; Bun does not embed them.
COPY --from=builder --chown=probe:probe /app/packages/db/src/migrations ./dist/migrations
COPY --from=builder --chown=probe:probe /app/apps/web/dist ./public

USER probe
EXPOSE 11010
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD bun -e "fetch('http://127.0.0.1:11010/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["bun", "run", "dist/index.js"]
