FROM node:24.2.0-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --production

FROM node:24.2.0-alpine AS production
WORKDIR /app
COPY --from=builder /app/build build/
COPY --from=builder /app/node_modules node_modules/
EXPOSE 3000
EXPOSE 3003
ENV NODE_ENV=production
CMD ["sh", "-c", "node build"]