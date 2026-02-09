-- Add venue columns used by Settings and locale (currency, timezone, receipt, notifications, etc.).
-- Safe to run: only adds each column if venues table exists and column does not exist.
-- Keeps schema in sync with types/database.ts VenueRow and settings update payload.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'venues') THEN

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'venues' AND column_name = 'currency') THEN
    ALTER TABLE public.venues ADD COLUMN currency TEXT DEFAULT 'GBP';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'venues' AND column_name = 'timezone') THEN
    ALTER TABLE public.venues ADD COLUMN timezone TEXT DEFAULT 'Europe/London';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'venues' AND column_name = 'venue_type') THEN
    ALTER TABLE public.venues ADD COLUMN venue_type TEXT DEFAULT 'restaurant';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'venues' AND column_name = 'service_type') THEN
    ALTER TABLE public.venues ADD COLUMN service_type TEXT DEFAULT 'table_service';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'venues' AND column_name = 'operating_hours') THEN
    ALTER TABLE public.venues ADD COLUMN operating_hours JSONB;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'venues' AND column_name = 'latitude') THEN
    ALTER TABLE public.venues ADD COLUMN latitude DOUBLE PRECISION;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'venues' AND column_name = 'longitude') THEN
    ALTER TABLE public.venues ADD COLUMN longitude DOUBLE PRECISION;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'venues' AND column_name = 'auto_email_receipts') THEN
    ALTER TABLE public.venues ADD COLUMN auto_email_receipts BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'venues' AND column_name = 'show_vat_breakdown') THEN
    ALTER TABLE public.venues ADD COLUMN show_vat_breakdown BOOLEAN DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'venues' AND column_name = 'allow_email_input') THEN
    ALTER TABLE public.venues ADD COLUMN allow_email_input BOOLEAN DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'venues' AND column_name = 'receipt_logo_url') THEN
    ALTER TABLE public.venues ADD COLUMN receipt_logo_url TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'venues' AND column_name = 'receipt_footer_text') THEN
    ALTER TABLE public.venues ADD COLUMN receipt_footer_text TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'venues' AND column_name = 'notify_customer_on_ready') THEN
    ALTER TABLE public.venues ADD COLUMN notify_customer_on_ready BOOLEAN DEFAULT false;
  END IF;

  END IF; -- venues table exists
END $$;
