FROM node:24.2.0-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund --prefer-offline

FROM node:24.2.0-alpine AS prod-deps
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --no-audit --no-fund --prefer-offline

FROM node:24.2.0-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules node_modules/
COPY . .
RUN npm run build

FROM node:24.2.0-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY --from=prod-deps /app/node_modules node_modules/
COPY drizzle drizzle/
COPY scripts scripts/
COPY --from=builder /app/build build/
EXPOSE 3000
EXPOSE 3003
# Apply DB migrations on startup, then boot the app (fail fast if migrations fail).
CMD ["sh", "-c", "node scripts/migrate.js && node build"]
