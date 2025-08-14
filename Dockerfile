# Multi-stage Dockerfile for Next.js (Node 20, Debian slim)

FROM node:20-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y dumb-init && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json* ./
# Prefer npm ci, but fall back to install if lockfile is out of sync
RUN npm ci --only=production || npm install --production --no-audit --no-fund

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
ENV PORT=8080
EXPOSE 8080
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/public ./public
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start", "--", "-p", "8080"]


