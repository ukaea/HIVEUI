FROM node:24.2.0-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24.2.0-alpine AS production
WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev
EXPOSE 3000
EXPOSE 3003
ENV NODE_ENV=production
CMD ["sh", "-c", "ORIGIN=http://scicat-test.apps.l:3003 node build"]