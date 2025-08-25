#!/usr/bin/env bash
set -euo pipefail
echo "[RAILWAY] build start with enhanced debugging"

# Set up comprehensive logging
export NIXPACKS_LOG_LEVEL=debug
export NPM_CONFIG_LOGLEVEL=verbose
export PNPM_LOG_LEVEL=debug

# Clean up any existing build artifacts
echo "[RAILWAY] cleaning build artifacts"
rm -rf .next
rm -f .env.production

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

echo "[RAILWAY] environment setup complete"
