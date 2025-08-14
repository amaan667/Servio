# Multi-stage Dockerfile for Next.js (Node 20, Debian slim)

FROM node:20-bullseye-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# Use npm install to avoid lock mismatch failures in CI
RUN npm install --no-audit --no-fund

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build

FROM node:20-bullseye-slim AS runner
ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app

# Only copy what we need at runtime
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY package.json next.config.mjs ./
COPY public ./public

EXPOSE 8080
CMD ["npm", "start"]


