# syntax=docker/dockerfile:1
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json ./
COPY bun.lock* package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV DEMO_MODE=false

COPY package.json ./
COPY bun.lock* package-lock.json* ./
RUN npm install --omit=dev --legacy-peer-deps && npm install -g tsx

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/src/assets ./src/assets
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/index.html ./index.html

RUN mkdir -p /app/.data

EXPOSE 3000

CMD ["tsx", "server.ts"]
