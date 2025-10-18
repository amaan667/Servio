-- Interactive PDF Menu Schema
-- Stores parsed menu items with pixel-perfect coordinates for hitboxes
-- Run this in Supabase SQL Editor

-- 1. Create menu_pages table
CREATE TABLE IF NOT EXISTS menu_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_upload_id UUID REFERENCES menu_uploads(id) ON DELETE CASCADE,
  venue_id TEXT NOT NULL,
  page_number INTEGER NOT NULL,
  width REAL NOT NULL,
  height REAL NOT NULL,
  image_url TEXT NOT NULL,
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(menu_upload_id, page_number)
);

-- 2. Create menu_items table with bounding boxes
CREATE TABLE IF NOT EXISTS menu_items_parsed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_page_id UUID REFERENCES menu_pages(id) ON DELETE CASCADE,
  venue_id TEXT NOT NULL,
  page_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price_minor INTEGER NOT NULL, -- Price in pence/cents
  currency TEXT DEFAULT 'GBP',
  bbox_x REAL NOT NULL, -- X coordinate in original PDF units
  bbox_y REAL NOT NULL, -- Y coordinate in original PDF units
  bbox_w REAL NOT NULL, -- Width in original PDF units
  bbox_h REAL NOT NULL, -- Height in original PDF units
  source TEXT NOT NULL, -- 'pdfjs', 'ocr', 'manual'
  confidence REAL DEFAULT 0.0, -- 0.0 to 1.0
  category TEXT,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_menu_pages_venue ON menu_pages(venue_id);
CREATE INDEX IF NOT EXISTS idx_menu_pages_upload ON menu_pages(menu_upload_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_parsed_venue ON menu_items_parsed(venue_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_parsed_page ON menu_items_parsed(menu_page_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_parsed_bbox ON menu_items_parsed(bbox_x, bbox_y, bbox_w, bbox_h);

-- 4. Enable RLS
ALTER TABLE menu_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items_parsed ENABLE ROW LEVEL SECURITY;

-- 5. Create public read policies
DROP POLICY IF EXISTS "Public can read menu pages" ON menu_pages;
CREATE POLICY "Public can read menu pages"
ON menu_pages FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "Public can read parsed menu items" ON menu_items_parsed;
CREATE POLICY "Public can read parsed menu items"
ON menu_items_parsed FOR SELECT
TO public
USING (true);

-- 6. Create owner write policies
DROP POLICY IF EXISTS "Owners can manage menu pages" ON menu_pages;
CREATE POLICY "Owners can manage menu pages"
ON menu_pages FOR ALL
USING (
  venue_id IN (
    SELECT venue_id FROM venues WHERE owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Owners can manage parsed menu items" ON menu_items_parsed;
CREATE POLICY "Owners can manage parsed menu items"
ON menu_items_parsed FOR ALL
USING (
  venue_id IN (
    SELECT venue_id FROM venues WHERE owner_id = auth.uid()
  )
);

-- 7. Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Create triggers
DROP TRIGGER IF EXISTS trg_menu_pages_updated_at ON menu_pages;
CREATE TRIGGER trg_menu_pages_updated_at
  BEFORE UPDATE ON menu_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_menu_items_parsed_updated_at ON menu_items_parsed;
CREATE TRIGGER trg_menu_items_parsed_updated_at
  BEFORE UPDATE ON menu_items_parsed
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 9. Add helper function to get items for a venue
CREATE OR REPLACE FUNCTION get_venue_menu_items(p_venue_id TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  price_minor INTEGER,
  currency TEXT,
  bbox_x REAL,
  bbox_y REAL,
  bbox_w REAL,
  bbox_h REAL,
  page_number INTEGER,
  image_url TEXT,
  source TEXT,
  confidence REAL,
  category TEXT,
  is_available BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mi.id,
    mi.name,
    mi.description,
    mi.price_minor,
    mi.currency,
    mi.bbox_x,
    mi.bbox_y,
    mi.bbox_w,
    mi.bbox_h,
    mi.page_number,
    mp.image_url,
    mi.source,
    mi.confidence,
    mi.category,
    mi.is_available
  FROM menu_items_parsed mi
  JOIN menu_pages mp ON mi.menu_page_id = mp.id
  WHERE mi.venue_id = p_venue_id
  ORDER BY mi.page_number, mi.bbox_y, mi.bbox_x;
END;
$$ LANGUAGE plpgsql;

-- 10. Verify tables
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name IN ('menu_pages', 'menu_items_parsed')
ORDER BY table_name, ordinal_position;

