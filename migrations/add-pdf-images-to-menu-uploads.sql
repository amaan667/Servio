-- Add pdf_images column to menu_uploads table
-- This stores the converted PDF page images for interactive preview

-- Add pdf_images column (array of text URLs)
ALTER TABLE menu_uploads
ADD COLUMN IF NOT EXISTS pdf_images TEXT[] DEFAULT '{}';

-- Add comment to column
COMMENT ON COLUMN menu_uploads.pdf_images IS 'Array of URLs to converted PDF page images for interactive preview';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_menu_uploads_venue_created 
ON menu_uploads(venue_id, created_at DESC);
