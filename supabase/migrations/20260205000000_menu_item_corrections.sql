-- User corrections for extracted menu items (low-confidence field overrides).
-- Used to train/improve display and future extractions.
CREATE TABLE IF NOT EXISTS public.menu_item_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL,
  menu_item_id UUID,
  item_name TEXT,
  field TEXT NOT NULL CHECK (field IN ('name', 'description', 'price', 'category', 'image_url')),
  value_text TEXT,
  value_number NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_menu_item_corrections_upsert
  ON public.menu_item_corrections (venue_id, menu_item_id, field)
  WHERE menu_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_menu_item_corrections_venue
  ON public.menu_item_corrections (venue_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_corrections_item
  ON public.menu_item_corrections (menu_item_id) WHERE menu_item_id IS NOT NULL;

ALTER TABLE public.menu_item_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage corrections for venues they can access"
  ON public.menu_item_corrections
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.menu_item_corrections IS 'User-submitted corrections for extracted menu fields; applied when displaying or re-extracting.';
