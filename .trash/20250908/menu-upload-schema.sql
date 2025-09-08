-- Menu uploads audit trail table
CREATE TABLE IF NOT EXISTS public.menu_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES public.venues(venue_id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  storage_path TEXT,
  file_size BIGINT,
  extracted_text_length INTEGER,
  mode TEXT DEFAULT 'strict' CHECK (mode IN ('strict', 'loose')),
  inserted_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  total_count INTEGER DEFAULT 0,
  categories TEXT[],
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.menu_uploads ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own venue uploads" ON public.menu_uploads
  FOR SELECT USING (
    venue_id IN (
      SELECT venue_id FROM public.venues 
      WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert uploads for their venues" ON public.menu_uploads
  FOR INSERT WITH CHECK (
    venue_id IN (
      SELECT venue_id FROM public.venues 
      WHERE owner_id = auth.uid()
    )
  );

-- Add import_info column to menu_items if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'menu_items' AND column_name = 'import_info'
  ) THEN
    ALTER TABLE public.menu_items ADD COLUMN import_info JSONB;
  END IF;
END $$;
