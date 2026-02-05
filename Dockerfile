# Dockerfile for Servio Development
# Multi-stage build for optimized image size (deploy trigger)
# Uses Debian slim - canvas has prebuilt binaries for glibc (Alpine/musl fails to compile)

# Stage 1: Dependencies
FROM node:20-slim AS deps
WORKDIR /app

# Install runtime libs + build deps for canvas (prebuild may fall back to compile on some platforms)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libjpeg62-turbo \
    libgif7 \
    graphicsmagick \
    ghostscript \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install pnpm and dependencies
RUN npm install -g pnpm@9.15.9
RUN pnpm install --frozen-lockfile

# Stage 2: Builder
FROM node:20-slim AS builder
WORKDIR /app

RUN npm install -g pnpm@9.15.9

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml

# Copy source code
COPY . .

# Build application (increase memory for Next.js; Railway injects real env vars)
# NEXT_PUBLIC_* variables must be available at build time for Next.js to bundle them
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL}
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}

RUN pnpm build

# Stage 3: Production
FROM node:20-slim AS production
WORKDIR /app

# Runtime libs for canvas + pdf2pic
# Plus Chromium shared libs for @sparticuz/chromium (URL menu extraction / Puppeteer)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libjpeg62-turbo \
    libgif7 \
    graphicsmagick \
    ghostscript \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*
# Install pnpm
RUN npm install -g pnpm@9.15.9

# Copy dependencies and build artifacts
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./next.config.mjs

# Set environment
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG SUPABASE_SERVICE_ROLE_KEY
ARG STRIPE_SECRET_KEY
ARG STRIPE_WEBHOOK_SECRET
ARG DATABASE_URL
ARG REDIS_URL

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL}
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}
ENV SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
ENV STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
ENV STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}
ENV DATABASE_URL=${DATABASE_URL}
ENV REDIS_URL=${REDIS_URL}

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["pnpm", "start"]
