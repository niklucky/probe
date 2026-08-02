FROM mcr.microsoft.com/playwright:v1.60.0-noble@sha256:9bd26ad900bb5e0f4dee75839e957a89ae89c2b7ab1e76050e559790e946b948

WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY playwright.config.ts playwright.config.ts

USER pwuser
ENTRYPOINT ["npx", "playwright", "test", "--config=/workspace/playwright.config.ts"]
