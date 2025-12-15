-- Migration: Add kds_station_id column to menu_items table
-- This allows menu items to be assigned to specific KDS stations for proper routing

-- Add kds_station_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'menu_items' 
    AND column_name = 'kds_station_id'
  ) THEN
    ALTER TABLE menu_items 
    ADD COLUMN kds_station_id UUID REFERENCES kds_stations(id) ON DELETE SET NULL;
    
    -- Add comment explaining the column
    COMMENT ON COLUMN menu_items.kds_station_id IS 'References the KDS station this menu item should be routed to. If NULL, falls back to keyword-based station assignment.';
    
    -- Create index for efficient lookups
    CREATE INDEX IF NOT EXISTS idx_menu_items_kds_station_id ON menu_items(kds_station_id);
  END IF;
END $$;
