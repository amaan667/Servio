-- Add optional country (ISO 3166-1 alpha-2) to venues for locale/currency/timezone.
-- Safe to run: only adds column if table exists and column does not exist.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'venues') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'venues' AND column_name = 'country') THEN
      ALTER TABLE public.venues ADD COLUMN country TEXT;
      COMMENT ON COLUMN public.venues.country IS 'ISO 3166-1 alpha-2 country code; used for auto locale/currency/timezone.';
    END IF;
  END IF;
END $$;
