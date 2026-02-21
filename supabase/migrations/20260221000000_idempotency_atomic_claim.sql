-- Migration: Atomic idempotency key claim
-- Adds RPC for race-free claim and update of idempotency keys

-- Allow NULL response_data for pending claims (if column is NOT NULL from earlier migration)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'idempotency_keys'
    AND column_name = 'response_data'
  ) THEN
    ALTER TABLE public.idempotency_keys
    ALTER COLUMN response_data DROP NOT NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Column may already allow NULL
END $$;

-- RPC: Atomically claim an idempotency key. Returns row if we won the race.
CREATE OR REPLACE FUNCTION public.claim_idempotency_key(
  p_key TEXT,
  p_request_hash TEXT,
  p_ttl_seconds INT DEFAULT 3600
)
RETURNS TABLE (
  id UUID,
  idempotency_key TEXT,
  request_hash TEXT,
  response_data JSONB,
  status_code INT,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  INSERT INTO public.idempotency_keys (
    idempotency_key,
    request_hash,
    response_data,
    status_code,
    expires_at
  )
  VALUES (
    p_key,
    p_request_hash,
    NULL,
    0,
    NOW() + (p_ttl_seconds || ' seconds')::INTERVAL
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING
    idempotency_keys.id,
    idempotency_keys.idempotency_key,
    idempotency_keys.request_hash,
    idempotency_keys.response_data,
    idempotency_keys.status_code,
    idempotency_keys.created_at,
    idempotency_keys.expires_at;
$$;

GRANT EXECUTE ON FUNCTION public.claim_idempotency_key(TEXT, TEXT, INT) TO service_role;

COMMENT ON FUNCTION public.claim_idempotency_key IS 'Atomically claim an idempotency key. Returns row if won; empty if key already exists.';

-- RPC: Update claimed idempotency key with response (only for pending rows with status_code = 0)
CREATE OR REPLACE FUNCTION public.update_idempotency_result(
  p_key TEXT,
  p_response_data JSONB,
  p_status_code INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.idempotency_keys
  SET response_data = p_response_data, status_code = p_status_code
  WHERE idempotency_key = p_key AND status_code = 0;
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_idempotency_result(TEXT, JSONB, INT) TO service_role;

COMMENT ON FUNCTION public.update_idempotency_result IS 'Update a claimed idempotency key with the response. Only updates pending (status_code=0) rows.';
