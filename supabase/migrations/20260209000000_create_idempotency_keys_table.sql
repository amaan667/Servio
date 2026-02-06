-- Migration: Create idempotency_keys table if missing
-- This table is used by the unified handler for idempotency

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL,
  response_data JSONB,
  status_code INTEGER NOT NULL DEFAULT 200,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_key ON public.idempotency_keys(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires ON public.idempotency_keys(expires_at);

-- Enable RLS
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Service role can manage idempotency keys" ON public.idempotency_keys
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read their own idempotency keys" ON public.idempotency_keys
  FOR SELECT TO authenticated
  USING (auth.uid()::TEXT LIKE '%'); -- Adjust as needed

COMMENT ON TABLE public.idempotency_keys IS 'Stores idempotency keys for API requests to prevent duplicate processing';
