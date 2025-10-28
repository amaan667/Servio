-- Add unique constraint on venue_id for menu_design_settings
-- This allows upsert to work properly (one design setting per venue)

-- First, remove any duplicate rows if they exist
DELETE FROM menu_design_settings a
USING menu_design_settings b
WHERE a.id > b.id
  AND a.venue_id = b.venue_id;

-- Now add the unique constraint
ALTER TABLE menu_design_settings
ADD CONSTRAINT menu_design_settings_venue_id_key 
UNIQUE (venue_id);

-- Add comment
COMMENT ON CONSTRAINT menu_design_settings_venue_id_key ON menu_design_settings 
IS 'Ensures one design setting per venue. Allows upsert by venue_id.';

