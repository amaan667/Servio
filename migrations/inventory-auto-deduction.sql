-- Inventory Auto-Deduction System
-- Automatically deducts ingredients when orders are completed

-- ============================================================================
-- Function to Auto-Deduct Inventory on Order Completion
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_deduct_inventory_on_order_complete()
RETURNS TRIGGER AS $$
DECLARE
  item_record JSONB;
  recipe_record RECORD;
  total_qty NUMERIC;
BEGIN
  -- Only deduct when status changes to COMPLETED
  IF NEW.order_status = 'COMPLETED' AND 
     (OLD.order_status IS NULL OR OLD.order_status != 'COMPLETED') THEN
    
    -- Log the auto-deduction
    RAISE NOTICE '[INVENTORY AUTO-DEDUCT] Processing order: %', NEW.id;
    
    -- Loop through each item in the order
    FOR item_record IN SELECT * FROM jsonb_array_elements(NEW.items)
    LOOP
      -- Get recipe for this menu item
      FOR recipe_record IN 
        SELECT 
          mi.ingredient_id, 
          mi.qty_per_item, 
          mi.unit, 
          i.name AS ingredient_name
        FROM menu_item_ingredients mi
        JOIN ingredients i ON i.id = mi.ingredient_id
        WHERE mi.menu_item_id = (item_record->>'menu_item_id')::UUID
      LOOP
        -- Calculate total quantity to deduct
        total_qty := recipe_record.qty_per_item * (item_record->>'quantity')::INTEGER;
        
        -- Insert negative ledger entry (deduction)
        INSERT INTO stock_ledgers (
          ingredient_id,
          venue_id,
          delta,
          reason,
          ref_type,
          ref_id,
          note
        ) VALUES (
          recipe_record.ingredient_id,
          NEW.venue_id,
          -total_qty,
          'sale',
          'order',
          NEW.id,
          'Auto-deducted from order completion'
        );
        
        RAISE NOTICE '[INVENTORY AUTO-DEDUCT] Deducted % % of % for order %', 
          total_qty, recipe_record.unit, recipe_record.ingredient_name, NEW.id;
      END LOOP;
    END LOOP;
    
    RAISE NOTICE '[INVENTORY AUTO-DEDUCT] Completed for order: %', NEW.id;
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the order completion
  RAISE WARNING '[INVENTORY AUTO-DEDUCT] Error processing order %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Create Trigger
-- ============================================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_auto_deduct_inventory ON orders;

-- Create trigger for automatic inventory deduction
CREATE TRIGGER trigger_auto_deduct_inventory
  AFTER INSERT OR UPDATE OF order_status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_deduct_inventory_on_order_complete();

-- ============================================================================
-- Success Message
-- ============================================================================

DO $$ 
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Inventory Auto-Deduction System Installed!';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Trigger: trigger_auto_deduct_inventory';
  RAISE NOTICE 'Function: auto_deduct_inventory_on_order_complete()';
  RAISE NOTICE 'Behavior: Automatically deducts ingredients when orders complete';
  RAISE NOTICE '=================================================================';
END $$;

