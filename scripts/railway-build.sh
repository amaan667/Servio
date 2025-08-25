#!/usr/bin/env bash
set -euo pipefail
echo "[RAILWAY] build start"

# Debug: Print environment variable status
echo "[RAILWAY] Debug: Checking environment variables"
echo "[RAILWAY] NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL:-'NOT SET'}"
echo "[RAILWAY] NEXT_PUBLIC_SUPABASE_ANON_KEY: ${NEXT_PUBLIC_SUPABASE_ANON_KEY:-'NOT SET'}"
echo "[RAILWAY] SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY:-'NOT SET'}"

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

echo "[RAILWAY] running next build"
npx next build
echo "[RAILWAY] build done"
