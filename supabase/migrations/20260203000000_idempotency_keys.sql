-- Migration: Create idempotency_keys table for idempotent API operations
-- This table stores idempotency keys to prevent duplicate operations
-- Critical for payment processing and other state-changing operations

-- Create idempotency_keys table
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL,
  response_data JSONB NOT NULL,
  status_code INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Create index for fast lookups by idempotency_key
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_key ON public.idempotency_keys(idempotency_key);

-- Create index for cleanup of expired keys
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at ON public.idempotency_keys(expires_at);

-- Create partial index for active (non-expired) keys
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_active ON public.idempotency_keys(idempotency_key)
  WHERE expires_at > NOW();

-- Add comment to table
COMMENT ON TABLE public.idempotency_keys IS 'Stores idempotency keys for API operations to prevent duplicate processing';

-- Add comments to columns
COMMENT ON COLUMN public.idempotency_keys.idempotency_key IS 'Unique key for idempotent operations';
COMMENT ON COLUMN public.idempotency_keys.request_hash IS 'Hash of request payload for validation';
COMMENT ON COLUMN public.idempotency_keys.response_data IS 'Cached response data for duplicate requests';
COMMENT ON COLUMN public.idempotency_keys.status_code IS 'HTTP status code of the original response';
COMMENT ON COLUMN public.idempotency_keys.expires_at IS 'Expiration time for the idempotency record';

-- Enable Row Level Security
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow service role to manage all idempotency keys
CREATE POLICY "Service role can manage all idempotency_keys"
  ON public.idempotency_keys
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policy: Allow authenticated users to read their own idempotency keys
-- (Optional: if you want users to see their own cached responses)
CREATE POLICY "Users can read own idempotency_keys"
  ON public.idempotency_keys
  FOR SELECT
  TO authenticated
  USING (
    -- This would require adding user_id column if needed
    -- For now, only service role can access
    false
  );

-- Create function to clean up expired idempotency keys
CREATE OR REPLACE FUNCTION public.cleanup_expired_idempotency_keys()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.idempotency_keys
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Add comment to function
COMMENT ON FUNCTION public.cleanup_expired_idempotency_keys() IS 'Cleans up expired idempotency keys. Returns number of deleted rows.';

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION public.cleanup_expired_idempotency_keys() TO service_role;

-- Create a cron job to clean up expired keys (requires pg_cron extension)
-- This is optional and depends on whether pg_cron is available
-- Uncomment if pg_cron is installed:
-- SELECT cron.schedule('cleanup-idempotency-keys', '0 * * * *', 'SELECT public.cleanup_expired_idempotency_keys();');
