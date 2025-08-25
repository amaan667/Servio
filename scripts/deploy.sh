#!/usr/bin/env bash
set -euo pipefail

echo "[DEPLOY] Starting deployment process..."

# Ensure we're in the right directory
cd "$(dirname "$0")/.."

# Clean any existing build artifacts
echo "[DEPLOY] Cleaning build artifacts..."
rm -rf .next
rm -f .env.production
rm -f .env.local

# Create environment file
echo "[DEPLOY] Setting up environment..."
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
  echo "[DEPLOY] Environment file created"
else
  echo "[DEPLOY] Warning: Missing required environment variables"
fi

# Build the application
echo "[DEPLOY] Building application..."
pnpm run build

echo "[DEPLOY] Deployment setup complete"
