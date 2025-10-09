-- Inventory Management System Schema
-- This schema supports ingredient tracking, recipe costing, stock movements, and low-stock alerts

-- Drop triggers, functions, views and tables safely
-- Using DO block to handle cases where tables don't exist yet
DO $$ 
BEGIN
    -- Drop triggers (requires tables to exist, so we handle exceptions)
    DROP TRIGGER IF EXISTS trg_check_stock_after_movement ON stock_ledgers;
    DROP TRIGGER IF EXISTS trg_ingredients_updated_at ON ingredients;
    DROP TRIGGER IF EXISTS trg_stock_ledgers_updated_at ON stock_ledgers;
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;

-- Drop functions (after triggers)
DROP FUNCTION IF EXISTS check_low_stock_and_86() CASCADE;
DROP FUNCTION IF EXISTS update_inventory_updated_at() CASCADE;

-- Drop existing tables if they exist (in reverse dependency order)
DROP VIEW IF EXISTS v_stock_levels CASCADE;
DROP TABLE IF EXISTS menu_item_ingredients CASCADE;
DROP TABLE IF EXISTS stock_ledgers CASCADE;
DROP TABLE IF EXISTS ingredients CASCADE;

-- Ingredients master table
-- Tracks all ingredients available at a venue
CREATE TABLE ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  unit TEXT NOT NULL, -- g, ml, pcs, oz, lb, kg, l
  cost_per_unit NUMERIC(10,4) DEFAULT 0,
  par_level NUMERIC(12,4) DEFAULT 0, -- desired inventory level
  reorder_level NUMERIC(12,4) DEFAULT 0, -- alert threshold
  supplier TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT ingredients_venue_name_unique UNIQUE(venue_id, name)
);

-- Stock ledger (movements)
-- Immutable ledger tracking all stock changes
CREATE TABLE stock_ledgers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  venue_id TEXT NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
  delta NUMERIC(12,4) NOT NULL, -- + for receive, - for consume/waste
  reason TEXT NOT NULL CHECK (reason IN ('sale', 'receive', 'adjust', 'waste', 'stocktake', 'return')),
  ref_type TEXT, -- 'order', 'shipment', 'manual'
  ref_id UUID, -- order_id, etc
  note TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Menu item to ingredient mapping (recipes)
-- Defines how much of each ingredient is needed per menu item
CREATE TABLE menu_item_ingredients (
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  qty_per_item NUMERIC(12,4) NOT NULL, -- e.g., 150 (g)
  unit TEXT NOT NULL, -- g, ml, pcs, etc
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (menu_item_id, ingredient_id)
);

-- Indexes for performance
CREATE INDEX idx_ingredients_venue ON ingredients(venue_id);
CREATE INDEX idx_ingredients_active ON ingredients(is_active) WHERE is_active = true;
CREATE INDEX idx_stock_ledgers_ingredient ON stock_ledgers(ingredient_id);
CREATE INDEX idx_stock_ledgers_venue ON stock_ledgers(venue_id);
CREATE INDEX idx_stock_ledgers_created ON stock_ledgers(created_at DESC);
CREATE INDEX idx_stock_ledgers_reason ON stock_ledgers(reason);
CREATE INDEX idx_menu_item_ingredients_menu_item ON menu_item_ingredients(menu_item_id);
CREATE INDEX idx_menu_item_ingredients_ingredient ON menu_item_ingredients(ingredient_id);

-- View for efficient stock level calculation
-- Aggregates all ledger movements to show current on-hand quantity
CREATE OR REPLACE VIEW v_stock_levels AS
  SELECT 
    i.id AS ingredient_id,
    i.venue_id,
    i.name,
    i.sku,
    i.unit,
    i.cost_per_unit,
    i.par_level,
    i.reorder_level,
    i.supplier,
    i.is_active,
    COALESCE(SUM(l.delta), 0) AS on_hand,
    i.created_at,
    i.updated_at
  FROM ingredients i
  LEFT JOIN stock_ledgers l ON l.ingredient_id = i.id
  GROUP BY i.id, i.venue_id, i.name, i.sku, i.unit, i.cost_per_unit, 
           i.par_level, i.reorder_level, i.supplier, i.is_active, 
           i.created_at, i.updated_at;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_inventory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER trg_ingredients_updated_at
  BEFORE UPDATE ON ingredients
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_updated_at();

CREATE TRIGGER trg_stock_ledgers_updated_at
  BEFORE UPDATE ON stock_ledgers
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_updated_at();

-- Function to check low stock and auto-86 menu items
CREATE OR REPLACE FUNCTION check_low_stock_and_86()
RETURNS TRIGGER AS $$
DECLARE
  current_stock NUMERIC;
  ingredient_record RECORD;
  menu_item_record RECORD;
BEGIN
  -- Calculate current stock for the ingredient
  SELECT COALESCE(SUM(delta), 0) INTO current_stock
  FROM stock_ledgers
  WHERE ingredient_id = NEW.ingredient_id;
  
  -- Get ingredient details
  SELECT * INTO ingredient_record
  FROM ingredients
  WHERE id = NEW.ingredient_id;
  
  -- If stock is at or below 0, auto-86 related menu items
  IF current_stock <= 0 THEN
    -- Find all menu items using this ingredient
    FOR menu_item_record IN 
      SELECT DISTINCT menu_item_id 
      FROM menu_item_ingredients 
      WHERE ingredient_id = NEW.ingredient_id
    LOOP
      -- Set menu item as unavailable
      UPDATE menu_items
      SET is_available = false
      WHERE id = menu_item_record.menu_item_id;
      
      -- Log the auto-86 event (could also publish to realtime channel)
      RAISE NOTICE 'Auto-86: Menu item % unavailable due to ingredient % (stock: %)', 
        menu_item_record.menu_item_id, ingredient_record.name, current_stock;
    END LOOP;
  END IF;
  
  -- If stock crosses below reorder level, raise warning
  IF current_stock <= ingredient_record.reorder_level AND ingredient_record.reorder_level > 0 THEN
    RAISE NOTICE 'Low stock alert: % is at % % (reorder level: %)', 
      ingredient_record.name, current_stock, ingredient_record.unit, ingredient_record.reorder_level;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to check stock levels after movements
CREATE TRIGGER trg_check_stock_after_movement
  AFTER INSERT ON stock_ledgers
  FOR EACH ROW
  EXECUTE FUNCTION check_low_stock_and_86();

-- Enable Row Level Security
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_ingredients ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow venue owners to access their data)
DROP POLICY IF EXISTS "Users can view their venue's ingredients" ON ingredients;
DROP POLICY IF EXISTS "Users can manage their venue's ingredients" ON ingredients;
DROP POLICY IF EXISTS "Users can view their venue's stock ledgers" ON stock_ledgers;
DROP POLICY IF EXISTS "Users can manage their venue's stock ledgers" ON stock_ledgers;
DROP POLICY IF EXISTS "Users can view menu item ingredients" ON menu_item_ingredients;
DROP POLICY IF EXISTS "Users can manage menu item ingredients" ON menu_item_ingredients;

CREATE POLICY "Users can view their venue's ingredients"
  ON ingredients FOR SELECT
  USING (venue_id IN (SELECT venue_id FROM venues WHERE owner_id = auth.uid()));

CREATE POLICY "Users can manage their venue's ingredients"
  ON ingredients FOR ALL
  USING (venue_id IN (SELECT venue_id FROM venues WHERE owner_id = auth.uid()));

CREATE POLICY "Users can view their venue's stock ledgers"
  ON stock_ledgers FOR SELECT
  USING (venue_id IN (SELECT venue_id FROM venues WHERE owner_id = auth.uid()));

CREATE POLICY "Users can manage their venue's stock ledgers"
  ON stock_ledgers FOR ALL
  USING (venue_id IN (SELECT venue_id FROM venues WHERE owner_id = auth.uid()));

CREATE POLICY "Users can view menu item ingredients"
  ON menu_item_ingredients FOR SELECT
  USING (
    menu_item_id IN (
      SELECT id FROM menu_items 
      WHERE venue_id IN (SELECT venue_id FROM venues WHERE owner_id = auth.uid())
    )
  );

CREATE POLICY "Users can manage menu item ingredients"
  ON menu_item_ingredients FOR ALL
  USING (
    menu_item_id IN (
      SELECT id FROM menu_items 
      WHERE venue_id IN (SELECT venue_id FROM venues WHERE owner_id = auth.uid())
    )
  );

-- Service role policies (bypass RLS)
DROP POLICY IF EXISTS "Service role has full access to ingredients" ON ingredients;
DROP POLICY IF EXISTS "Service role has full access to stock ledgers" ON stock_ledgers;
DROP POLICY IF EXISTS "Service role has full access to menu item ingredients" ON menu_item_ingredients;

CREATE POLICY "Service role has full access to ingredients"
  ON ingredients FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Service role has full access to stock ledgers"
  ON stock_ledgers FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Service role has full access to menu item ingredients"
  ON menu_item_ingredients FOR ALL
  TO service_role
  USING (true);

-- Helper function: Deduct stock for an order
CREATE OR REPLACE FUNCTION deduct_stock_for_order(p_order_id UUID, p_venue_id TEXT)
RETURNS JSON AS $$
DECLARE
  order_record RECORD;
  item JSONB;
  recipe RECORD;
  deducted_items JSON[];
BEGIN
  -- Get order details
  SELECT * INTO order_record FROM orders WHERE id = p_order_id AND venue_id = p_venue_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  -- Initialize array
  deducted_items := ARRAY[]::JSON[];
  
  -- Loop through each order item
  FOR item IN SELECT * FROM jsonb_array_elements(order_record.items)
  LOOP
    -- Get recipe for this menu item
    FOR recipe IN 
      SELECT mi.ingredient_id, mi.qty_per_item, mi.unit, i.name AS ingredient_name
      FROM menu_item_ingredients mi
      JOIN ingredients i ON i.id = mi.ingredient_id
      WHERE mi.menu_item_id = (item->>'menu_item_id')::UUID
    LOOP
      -- Calculate total quantity to deduct
      DECLARE
        total_qty NUMERIC;
      BEGIN
        total_qty := recipe.qty_per_item * (item->>'quantity')::INTEGER;
        
        -- Insert negative ledger entry
        INSERT INTO stock_ledgers (
          ingredient_id,
          venue_id,
          delta,
          reason,
          ref_type,
          ref_id,
          note
        ) VALUES (
          recipe.ingredient_id,
          p_venue_id,
          -total_qty,
          'sale',
          'order',
          p_order_id,
          'Auto-deducted from order ' || p_order_id
        );
        
        -- Track what was deducted
        deducted_items := array_append(
          deducted_items,
          json_build_object(
            'ingredient_id', recipe.ingredient_id,
            'ingredient_name', recipe.ingredient_name,
            'quantity_deducted', total_qty,
            'unit', recipe.unit
          )
        );
      END;
    END LOOP;
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'order_id', p_order_id,
    'deductions', array_to_json(deducted_items)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;

