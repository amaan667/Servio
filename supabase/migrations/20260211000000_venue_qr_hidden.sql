-- Store QR codes that have been "removed" by the venue so they stay hidden
-- (QR codes can be generated/deleted regardless of tables)
CREATE TABLE IF NOT EXISTS public.venue_qr_hidden (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id text NOT NULL,
  qr_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(venue_id, qr_key)
);

CREATE INDEX IF NOT EXISTS idx_venue_qr_hidden_venue_id ON public.venue_qr_hidden (venue_id);

-- RLS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'venue_qr_hidden') THEN
    ALTER TABLE public.venue_qr_hidden ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "venue_qr_hidden_venue_access" ON public.venue_qr_hidden;
    CREATE POLICY "venue_qr_hidden_venue_access" ON public.venue_qr_hidden FOR ALL TO authenticated
      USING (public.user_has_venue_access(venue_id::text)) WITH CHECK (public.user_has_venue_access(venue_id::text));
    DROP POLICY IF EXISTS "venue_qr_hidden_service_role" ON public.venue_qr_hidden;
    CREATE POLICY "venue_qr_hidden_service_role" ON public.venue_qr_hidden FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
