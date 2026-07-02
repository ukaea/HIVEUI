FROM node:24.2.0-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

FROM node:24.2.0-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules node_modules/
COPY package*.json ./
COPY . .
RUN npm run build

FROM node:24.2.0-alpine AS production
WORKDIR /app
COPY --from=builder /app/build build/
COPY --from=builder /app/drizzle drizzle/
COPY --from=builder /app/scripts scripts/
COPY --from=builder /app/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev
EXPOSE 3000
EXPOSE 3003
ENV NODE_ENV=production
# Apply DB migrations on startup, then boot the app (fail fast if migrations fail).
CMD ["sh", "-c", "node scripts/migrate.js && node build"]
