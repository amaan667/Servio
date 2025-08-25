#!/usr/bin/env bash
set -euo pipefail
echo "[RAILWAY] build start with enhanced debugging"

# Set up comprehensive logging
export NIXPACKS_LOG_LEVEL=debug
export NPM_CONFIG_LOGLEVEL=verbose
export PNPM_LOG_LEVEL=debug

# Clean build environment
echo "[RAILWAY] cleaning build environment"
rm -rf .next node_modules .pnpm-store

# Enable corepack and install dependencies
echo "[RAILWAY] enabling corepack and installing dependencies"
corepack enable
pnpm install --frozen-lockfile

# Run guard before build
echo "[RAILWAY] running app directory guard (pre-build)"
if [ -f scripts/guard-app-path.sh ]; then
  scripts/guard-app-path.sh
else
  echo "[RAILWAY] guard script not found, creating app directory manually"
  rm -f app
  mkdir -p app
fi

# Environment file generation
ENV_OUT=".env.production"
if [ -n "${NEXT_PUBLIC_SUPABASE_URL:-}" ] && [ -n "${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}" ]; then
  {
    echo "NODE_ENV=production"
    echo "NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}"
    echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}"
    [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ] && echo "SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}"
    [ -n "${NEXT_PUBLIC_APP_URL:-}" ] && echo "NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}"
    [ -n "${NEXT_PUBLIC_SITE_URL:-}" ] && echo "NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}"
    [ -n "${STRIPE_SECRET_KEY:-}" ] && echo "STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}"
    [ -n "${STRIPE_WEBHOOK_SECRET:-}" ] && echo "STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}"
    [ -n "${GOOGLE_CREDENTIALS_B64:-}" ] && echo "GOOGLE_CREDENTIALS_B64=${GOOGLE_CREDENTIALS_B64}"
    [ -n "${GCS_BUCKET_NAME:-}" ] && echo "GCS_BUCKET_NAME=${GCS_BUCKET_NAME}"
    [ -n "${APP_URL:-}" ] && echo "APP_URL=${APP_URL}"
  } > "$ENV_OUT"
  echo "[RAILWAY] wrote $ENV_OUT"
else
  echo "[RAILWAY] skipping env file generation; required public supabase vars missing"
fi

# Run the build with enhanced logging
echo "[RAILWAY] running pnpm build with verbose logging"
pnpm run build

# Run guard after build
echo "[RAILWAY] running app directory guard (post-build)"
if [ -f scripts/guard-app-path.sh ]; then
  scripts/guard-app-path.sh
else
  echo "[RAILWAY] guard script not found, checking app directory manually"
  if [ ! -d app ]; then
    echo "ERROR: Something replaced the 'app' directory with a file named 'app'"
    exit 1
  fi
  echo "[RAILWAY] app directory integrity OK"
fi

echo "[RAILWAY] build completed successfully"
