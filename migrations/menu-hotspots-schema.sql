-- Menu Hotspots Schema
-- This schema enables interactive hotspots on PDF menu images
-- Users can click on menu items in the PDF to view details and add to cart

-- Drop existing tables if they exist
DROP TABLE IF EXISTS menu_hotspots CASCADE;

-- Menu Hotspots Table
-- Stores clickable regions on PDF menu images with associated menu items
CREATE TABLE menu_hotspots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  menu_upload_id UUID REFERENCES menu_uploads(id) ON DELETE CASCADE,
  
  -- Position on the PDF page (in pixels or percentage)
  page_index INTEGER NOT NULL DEFAULT 0, -- Which page of the PDF (0-indexed)
  x_percent NUMERIC(5,2) NOT NULL, -- X position as percentage (0-100)
  y_percent NUMERIC(5,2) NOT NULL, -- Y position as percentage (0-100)
  
  -- Optional: Bounding box for larger clickable areas
  width_percent NUMERIC(5,2), -- Width as percentage (optional)
  height_percent NUMERIC(5,2), -- Height as percentage (optional)
  
  -- Metadata
  confidence NUMERIC(3,2) DEFAULT 1.0, -- OCR confidence score (0-1)
  detection_method TEXT DEFAULT 'ocr', -- 'ocr', 'manual', 'ai'
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_x_percent CHECK (x_percent >= 0 AND x_percent <= 100),
  CONSTRAINT valid_y_percent CHECK (y_percent >= 0 AND y_percent <= 100),
  CONSTRAINT valid_width CHECK (width_percent IS NULL OR (width_percent > 0 AND width_percent <= 100)),
  CONSTRAINT valid_height CHECK (height_percent IS NULL OR (height_percent > 0 AND height_percent <= 100)),
  CONSTRAINT valid_confidence CHECK (confidence >= 0 AND confidence <= 1)
);

-- Indexes for performance
CREATE INDEX idx_hotspots_venue ON menu_hotspots(venue_id);
CREATE INDEX idx_hotspots_menu_item ON menu_hotspots(menu_item_id);
CREATE INDEX idx_hotspots_upload ON menu_hotspots(menu_upload_id);
CREATE INDEX idx_hotspots_page ON menu_hotspots(page_index);
CREATE INDEX idx_hotspots_active ON menu_hotspots(is_active) WHERE is_active = true;
CREATE INDEX idx_hotspots_venue_page ON menu_hotspots(venue_id, page_index);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_hotspots_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trg_hotspots_updated_at
  BEFORE UPDATE ON menu_hotspots
  FOR EACH ROW
  EXECUTE FUNCTION update_hotspots_updated_at();

-- Enable Row Level Security
ALTER TABLE menu_hotspots ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view hotspots for their venues
CREATE POLICY "Users can view hotspots for their venues"
  ON menu_hotspots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM venues
      WHERE venues.venue_id = menu_hotspots.venue_id
      AND venues.owner_id = auth.uid()
    )
  );

-- Policy: Users can insert hotspots for their venues
CREATE POLICY "Users can insert hotspots for their venues"
  ON menu_hotspots FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM venues
      WHERE venues.venue_id = menu_hotspots.venue_id
      AND venues.owner_id = auth.uid()
    )
  );

-- Policy: Users can update hotspots for their venues
CREATE POLICY "Users can update hotspots for their venues"
  ON menu_hotspots FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM venues
      WHERE venues.venue_id = menu_hotspots.venue_id
      AND venues.owner_id = auth.uid()
    )
  );

-- Policy: Users can delete hotspots for their venues
CREATE POLICY "Users can delete hotspots for their venues"
  ON menu_hotspots FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM venues
      WHERE venues.venue_id = menu_hotspots.venue_id
      AND venues.owner_id = auth.uid()
    )
  );

-- Add comment for documentation
COMMENT ON TABLE menu_hotspots IS 'Stores clickable hotspot regions on PDF menu images with associated menu items';
COMMENT ON COLUMN menu_hotspots.x_percent IS 'X position as percentage of image width (0-100)';
COMMENT ON COLUMN menu_hotspots.y_percent IS 'Y position as percentage of image height (0-100)';
COMMENT ON COLUMN menu_hotspots.page_index IS 'Zero-indexed page number in the PDF';
COMMENT ON COLUMN menu_hotspots.confidence IS 'OCR detection confidence score from 0 to 1';

