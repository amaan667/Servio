-- Migration: Add modifiers JSONB column to menu_items table
-- This allows storing modifier configurations (sizes, toppings, add-ons, etc.) for each menu item

-- Add modifiers column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'menu_items' 
    AND column_name = 'modifiers'
  ) THEN
    ALTER TABLE menu_items 
    ADD COLUMN modifiers JSONB DEFAULT NULL;
    
    -- Add comment explaining the structure
    COMMENT ON COLUMN menu_items.modifiers IS 'JSONB array of modifier configurations. Each modifier has: name (string), type (single|multiple), required (boolean), options (array of {name, price_modifier, is_available})';
    
    -- Create GIN index for efficient JSONB queries
    CREATE INDEX IF NOT EXISTS idx_menu_items_modifiers ON menu_items USING GIN (modifiers);
  END IF;
END $$;

-- Example modifier structure (for reference):
-- [
--   {
--     "name": "Size",
--     "type": "single",
--     "required": true,
--     "options": [
--       {"name": "Small", "price_modifier": 0, "is_available": true},
--       {"name": "Medium", "price_modifier": 2.00, "is_available": true},
--       {"name": "Large", "price_modifier": 4.00, "is_available": true}
--     ]
--   },
--   {
--     "name": "Toppings",
--     "type": "multiple",
--     "required": false,
--     "options": [
--       {"name": "Extra Cheese", "price_modifier": 1.50, "is_available": true},
--       {"name": "Bacon", "price_modifier": 2.00, "is_available": true}
--     ]
--   }
-- ]

