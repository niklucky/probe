FROM oven/bun:1.1.38-alpine@sha256:c1cc397e0be452c54f37cbcdfaa747eff93c993723af7d91658764d0fdfe5873 AS builder

WORKDIR /app
COPY package.json bun.lock turbo.json ./
COPY apps ./apps
COPY packages ./packages
RUN bun install --frozen-lockfile
RUN bun build apps/runner/src/index.ts --outfile=dist/runner.js --target=node

FROM oven/bun:1.1.38-alpine@sha256:c1cc397e0be452c54f37cbcdfaa747eff93c993723af7d91658764d0fdfe5873 AS runtime

WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache docker-cli
COPY --from=builder /app/dist/runner.js ./dist/runner.js
CMD ["bun", "run", "dist/runner.js"]
