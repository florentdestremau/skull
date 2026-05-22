# syntax=docker/dockerfile:1.7

# --- Stage 1 : build du front Vite/React ---
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Stage 2 : runtime Bun (statique + WS + API) ---
FROM oven/bun:1-alpine AS runtime
WORKDIR /app

COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/server /app/server
COPY --from=builder /app/src/game /app/src/game
COPY --from=builder /app/package.json /app/package.json

ENV NODE_ENV=production
ENV PORT=80
ENV DIST_DIR=/app/dist
ENV STORAGE_DIR=/storage

VOLUME ["/storage"]
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/up || exit 1

CMD ["bun", "run", "server/index.ts"]
