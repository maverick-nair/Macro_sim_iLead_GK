# iLead: the reference server and the participant app in one image (docs/SERVER.md "Deploy").
#   docker build -t ilead .
#   docker run -p 8787:8787 -e LAUNCH_SECRET=... -e PUBLIC_URL=https://ilead.example.com -v ilead-data:/data ilead
# Stages: deps (every package), build (the app built against the server's paths, .env.server), runtime
# (production packages, Chromium for report PDFs, the server's TypeScript run by tsx, the app's build).

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY ai/package.json ai/
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY . .
RUN npm run build:server-app

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PORT=8787 \
    STATIC_DIR=dist-server \
    SQLITE_PATH=/data/ilead.sqlite
WORKDIR /app
COPY package.json package-lock.json ./
COPY ai/package.json ai/
# Production packages, then Chromium and the system libraries it needs (for the report PDF).
RUN npm ci --omit=dev --no-audit --no-fund \
 && npx playwright-core install --with-deps chromium \
 && npm cache clean --force \
 && mkdir -p /data && chown node:node /data
COPY tsconfig.json tsconfig.app.json ./
COPY server ./server
COPY src ./src
COPY ai ./ai
COPY --from=build /app/dist-server ./dist-server
USER node
VOLUME /data
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "--import", "tsx", "server/src/index.ts"]
