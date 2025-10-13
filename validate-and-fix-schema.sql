-- ========================================
-- DATABASE SCHEMA VALIDATION AND FIX SCRIPT
-- Commit: f7df15cf0e91685740b4cf4eeb7b7418cc24d4c6
-- Description: Ensures all tables and columns match the code expectations
-- ========================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- SECTION 1: CORE TABLES
-- ========================================

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT DEFAULT 'trialing',
  subscription_plan TEXT,
  trial_ends_at TIMESTAMPTZ,
  subscription_current_period_start TIMESTAMPTZ,
  subscription_current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns to organizations if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='stripe_customer_id') THEN
    ALTER TABLE organizations ADD COLUMN stripe_customer_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='stripe_subscription_id') THEN
    ALTER TABLE organizations ADD COLUMN stripe_subscription_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='subscription_status') THEN
    ALTER TABLE organizations ADD COLUMN subscription_status TEXT DEFAULT 'trialing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='subscription_plan') THEN
    ALTER TABLE organizations ADD COLUMN subscription_plan TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='trial_ends_at') THEN
    ALTER TABLE organizations ADD COLUMN trial_ends_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='subscription_current_period_start') THEN
    ALTER TABLE organizations ADD COLUMN subscription_current_period_start TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='subscription_current_period_end') THEN
    ALTER TABLE organizations ADD COLUMN subscription_current_period_end TIMESTAMPTZ;
  END IF;
END $$;

-- Venues table
CREATE TABLE IF NOT EXISTS venues (
  venue_id TEXT PRIMARY KEY,
  venue_name TEXT NOT NULL,
  venue_address TEXT,
  cuisine_type TEXT,
  owner_user_id UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES organizations(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  phone_number TEXT,
  business_hours JSONB,
  menu_theme TEXT DEFAULT 'modern'
);

-- Add missing columns to venues
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='venues' AND column_name='organization_id') THEN
    ALTER TABLE venues ADD COLUMN organization_id UUID REFERENCES organizations(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='venues' AND column_name='phone_number') THEN
    ALTER TABLE venues ADD COLUMN phone_number TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='venues' AND column_name='business_hours') THEN
    ALTER TABLE venues ADD COLUMN business_hours JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='venues' AND column_name='menu_theme') THEN
    ALTER TABLE venues ADD COLUMN menu_theme TEXT DEFAULT 'modern';
  END IF;
END $$;

-- User venue roles table
CREATE TABLE IF NOT EXISTS user_venue_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id TEXT NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'staff', 'kitchen_staff', 'waiter')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, venue_id)
);

-- Menu uploads table
CREATE TABLE IF NOT EXISTS menu_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(venue_id),
  upload_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  original_filename TEXT,
  storage_path TEXT,
  extracted_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Menu items table
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(venue_id),
  item_name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  category TEXT,
  is_available BOOLEAN DEFAULT true,
  image_url TEXT,
  prep_time INTEGER,
  allergens TEXT[],
  is_vegetarian BOOLEAN DEFAULT false,
  is_vegan BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns to menu_items
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='menu_items' AND column_name='prep_time') THEN
    ALTER TABLE menu_items ADD COLUMN prep_time INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='menu_items' AND column_name='allergens') THEN
    ALTER TABLE menu_items ADD COLUMN allergens TEXT[];
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='menu_items' AND column_name='is_vegetarian') THEN
    ALTER TABLE menu_items ADD COLUMN is_vegetarian BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='menu_items' AND column_name='is_vegan') THEN
    ALTER TABLE menu_items ADD COLUMN is_vegan BOOLEAN DEFAULT false;
  END IF;
END $$;

-- ========================================
-- SECTION 2: TABLE MANAGEMENT
-- ========================================

-- Tables table
CREATE TABLE IF NOT EXISTS tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(venue_id),
  label TEXT NOT NULL,
  seat_count INTEGER DEFAULT 4,
  area TEXT,
  is_active BOOLEAN DEFAULT true,
  qr_version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(venue_id, label)
);

-- Add missing columns to tables
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tables' AND column_name='area') THEN
    ALTER TABLE tables ADD COLUMN area TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tables' AND column_name='qr_version') THEN
    ALTER TABLE tables ADD COLUMN qr_version INTEGER DEFAULT 1;
  END IF;
END $$;

-- Table sessions table
CREATE TABLE IF NOT EXISTS table_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(venue_id),
  table_id UUID NOT NULL REFERENCES tables(id),
  order_id UUID,
  status TEXT DEFAULT 'FREE' CHECK (status IN ('FREE', 'OCCUPIED')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  server_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for table_sessions
CREATE INDEX IF NOT EXISTS idx_table_sessions_venue_id ON table_sessions(venue_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_table_id ON table_sessions(table_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_status ON table_sessions(status);

-- Reservations table
CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(venue_id),
  table_id UUID REFERENCES tables(id),
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  party_size INTEGER DEFAULT 2,
  status TEXT DEFAULT 'BOOKED' CHECK (status IN ('BOOKED', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for reservations
CREATE INDEX IF NOT EXISTS idx_reservations_venue_id ON reservations(venue_id);
CREATE INDEX IF NOT EXISTS idx_reservations_table_id ON reservations(table_id);
CREATE INDEX IF NOT EXISTS idx_reservations_start_at ON reservations(start_at);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);

-- ========================================
-- SECTION 3: ORDERS SYSTEM
-- ========================================

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(venue_id),
  table_number INTEGER,
  table_id UUID REFERENCES tables(id),
  session_id TEXT,
  source TEXT DEFAULT 'qr' CHECK (source IN ('qr', 'counter')),
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  order_status TEXT DEFAULT 'PLACED',
  total_amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'GBP',
  notes TEXT,
  payment_method TEXT,
  payment_status TEXT DEFAULT 'UNPAID',
  payment_mode TEXT DEFAULT 'online',
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  scheduled_for TIMESTAMPTZ,
  prep_lead_minutes INTEGER,
  items JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  served_at TIMESTAMPTZ
);

-- Add missing columns to orders
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='table_id') THEN
    ALTER TABLE orders ADD COLUMN table_id UUID REFERENCES tables(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='payment_mode') THEN
    ALTER TABLE orders ADD COLUMN payment_mode TEXT DEFAULT 'online';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='stripe_session_id') THEN
    ALTER TABLE orders ADD COLUMN stripe_session_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='stripe_payment_intent_id') THEN
    ALTER TABLE orders ADD COLUMN stripe_payment_intent_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='currency') THEN
    ALTER TABLE orders ADD COLUMN currency TEXT DEFAULT 'GBP';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='served_at') THEN
    ALTER TABLE orders ADD COLUMN served_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='source') THEN
    ALTER TABLE orders ADD COLUMN source TEXT DEFAULT 'qr';
  END IF;
END $$;

-- Add computed field for active orders
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='is_active') THEN
    ALTER TABLE orders ADD COLUMN is_active BOOLEAN GENERATED ALWAYS AS (
      order_status IN ('PLACED','IN_PREP','READY','SERVING')
    ) STORED;
  END IF;
END $$;

-- Add indexes for orders
CREATE INDEX IF NOT EXISTS idx_orders_venue_id ON orders(venue_id);
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- ========================================
-- SECTION 4: INVENTORY SYSTEM
-- ========================================

-- Ingredients table
CREATE TABLE IF NOT EXISTS ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(venue_id),
  name TEXT NOT NULL,
  sku TEXT,
  unit TEXT NOT NULL,
  cost_per_unit DECIMAL(10,2) DEFAULT 0,
  par_level DECIMAL(10,2) DEFAULT 0,
  reorder_level DECIMAL(10,2) DEFAULT 0,
  supplier TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(venue_id, name)
);

-- Stock ledger table
CREATE TABLE IF NOT EXISTS stock_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  venue_id TEXT NOT NULL REFERENCES venues(venue_id),
  delta DECIMAL(10,2) NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('sale', 'receive', 'adjust', 'waste', 'stocktake', 'return')),
  ref_type TEXT CHECK (ref_type IN ('order', 'shipment', 'manual')),
  ref_id TEXT,
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Menu item ingredients junction table
CREATE TABLE IF NOT EXISTS menu_item_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  qty_per_item DECIMAL(10,2) NOT NULL,
  unit TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(menu_item_id, ingredient_id)
);

-- Add indexes for inventory tables
CREATE INDEX IF NOT EXISTS idx_ingredients_venue_id ON ingredients(venue_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_ingredient_id ON stock_ledger(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_venue_id ON stock_ledger(venue_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_ingredients_menu_item ON menu_item_ingredients(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_ingredients_ingredient ON menu_item_ingredients(ingredient_id);

-- ========================================
-- SECTION 5: KDS (KITCHEN DISPLAY SYSTEM)
-- ========================================

-- KDS Stations table
CREATE TABLE IF NOT EXISTS kds_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(venue_id),
  station_name TEXT NOT NULL,
  station_type TEXT DEFAULT 'general',
  display_order INTEGER DEFAULT 0,
  color_code TEXT DEFAULT '#3b82f6',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(venue_id, station_name)
);

-- KDS Tickets table
CREATE TABLE IF NOT EXISTS kds_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(venue_id),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  station_id UUID NOT NULL REFERENCES kds_stations(id),
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  special_instructions TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'ready', 'bumped')),
  priority INTEGER DEFAULT 0,
  table_number INTEGER,
  table_label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  bumped_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- KDS Station categories junction table
CREATE TABLE IF NOT EXISTS kds_station_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(venue_id),
  station_id UUID NOT NULL REFERENCES kds_stations(id) ON DELETE CASCADE,
  menu_category TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(station_id, menu_category)
);

-- Add indexes for KDS tables
CREATE INDEX IF NOT EXISTS idx_kds_stations_venue_id ON kds_stations(venue_id);
CREATE INDEX IF NOT EXISTS idx_kds_tickets_venue_id ON kds_tickets(venue_id);
CREATE INDEX IF NOT EXISTS idx_kds_tickets_order_id ON kds_tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_kds_tickets_station_id ON kds_tickets(station_id);
CREATE INDEX IF NOT EXISTS idx_kds_tickets_status ON kds_tickets(status);
CREATE INDEX IF NOT EXISTS idx_kds_station_categories_station_id ON kds_station_categories(station_id);

-- ========================================
-- SECTION 6: POS SYSTEM (Counters & Bill Splits)
-- ========================================

-- Counters table
CREATE TABLE IF NOT EXISTS counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(venue_id),
  label TEXT NOT NULL,
  area TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(venue_id, label)
);

-- Counter sessions table
CREATE TABLE IF NOT EXISTS counter_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(venue_id),
  counter_id UUID NOT NULL REFERENCES counters(id),
  server_id UUID REFERENCES auth.users(id),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'AWAITING_PAYMENT', 'CLOSED')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bill splits table
CREATE TABLE IF NOT EXISTS bill_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(venue_id),
  table_session_id UUID REFERENCES table_sessions(id),
  counter_session_id UUID REFERENCES counter_sessions(id),
  split_number INTEGER NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  payment_status TEXT DEFAULT 'UNPAID' CHECK (payment_status IN ('UNPAID', 'PAID', 'REFUNDED')),
  payment_method TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order bill splits junction table
CREATE TABLE IF NOT EXISTS order_bill_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  bill_split_id UUID NOT NULL REFERENCES bill_splits(id),
  amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(order_id, bill_split_id)
);

-- Service charges table
CREATE TABLE IF NOT EXISTS service_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(venue_id),
  table_session_id UUID REFERENCES table_sessions(id),
  counter_session_id UUID REFERENCES counter_sessions(id),
  charge_type TEXT NOT NULL CHECK (charge_type IN ('SERVICE_CHARGE', 'DISCOUNT', 'COMP', 'VOID')),
  amount DECIMAL(10,2) NOT NULL,
  percentage DECIMAL(5,2),
  reason TEXT,
  applied_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for POS tables
CREATE INDEX IF NOT EXISTS idx_counters_venue_id ON counters(venue_id);
CREATE INDEX IF NOT EXISTS idx_counter_sessions_venue_id ON counter_sessions(venue_id);
CREATE INDEX IF NOT EXISTS idx_counter_sessions_counter_id ON counter_sessions(counter_id);
CREATE INDEX IF NOT EXISTS idx_bill_splits_venue_id ON bill_splits(venue_id);
CREATE INDEX IF NOT EXISTS idx_bill_splits_table_session ON bill_splits(table_session_id);
CREATE INDEX IF NOT EXISTS idx_bill_splits_counter_session ON bill_splits(counter_session_id);

-- ========================================
-- SECTION 7: TRIGGERS
-- ========================================

-- Create or replace the updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all tables
DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_venues_updated_at ON venues;
CREATE TRIGGER update_venues_updated_at BEFORE UPDATE ON venues FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_venue_roles_updated_at ON user_venue_roles;
CREATE TRIGGER update_user_venue_roles_updated_at BEFORE UPDATE ON user_venue_roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_menu_uploads_updated_at ON menu_uploads;
CREATE TRIGGER update_menu_uploads_updated_at BEFORE UPDATE ON menu_uploads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_menu_items_updated_at ON menu_items;
CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON menu_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tables_updated_at ON tables;
CREATE TRIGGER update_tables_updated_at BEFORE UPDATE ON tables FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_table_sessions_updated_at ON table_sessions;
CREATE TRIGGER update_table_sessions_updated_at BEFORE UPDATE ON table_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reservations_updated_at ON reservations;
CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON reservations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ingredients_updated_at ON ingredients;
CREATE TRIGGER update_ingredients_updated_at BEFORE UPDATE ON ingredients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_stock_ledger_updated_at ON stock_ledger;
CREATE TRIGGER update_stock_ledger_updated_at BEFORE UPDATE ON stock_ledger FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_menu_item_ingredients_updated_at ON menu_item_ingredients;
CREATE TRIGGER update_menu_item_ingredients_updated_at BEFORE UPDATE ON menu_item_ingredients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_kds_stations_updated_at ON kds_stations;
CREATE TRIGGER update_kds_stations_updated_at BEFORE UPDATE ON kds_stations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_kds_tickets_updated_at ON kds_tickets;
CREATE TRIGGER update_kds_tickets_updated_at BEFORE UPDATE ON kds_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_counters_updated_at ON counters;
CREATE TRIGGER update_counters_updated_at BEFORE UPDATE ON counters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_counter_sessions_updated_at ON counter_sessions;
CREATE TRIGGER update_counter_sessions_updated_at BEFORE UPDATE ON counter_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bill_splits_updated_at ON bill_splits;
CREATE TRIGGER update_bill_splits_updated_at BEFORE UPDATE ON bill_splits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- SECTION 8: VIEWS
-- ========================================

-- Drop existing views first to avoid column name conflicts
DROP VIEW IF EXISTS stock_levels CASCADE;
DROP VIEW IF EXISTS active_table_sessions CASCADE;
DROP VIEW IF EXISTS active_counter_sessions CASCADE;

-- View for stock levels (current inventory)
CREATE VIEW stock_levels AS
SELECT 
  i.id as ingredient_id,
  i.venue_id,
  i.name,
  i.sku,
  i.unit,
  i.cost_per_unit,
  i.par_level,
  i.reorder_level,
  i.supplier,
  i.is_active,
  COALESCE(SUM(sl.delta), 0) as on_hand,
  i.created_at,
  i.updated_at
FROM ingredients i
LEFT JOIN stock_ledger sl ON i.id = sl.ingredient_id
GROUP BY i.id, i.venue_id, i.name, i.sku, i.unit, i.cost_per_unit, 
         i.par_level, i.reorder_level, i.supplier, i.is_active, 
         i.created_at, i.updated_at;

-- View for active table sessions with order details
CREATE VIEW active_table_sessions AS
SELECT 
  ts.*,
  t.label as table_label,
  t.area,
  t.seat_count,
  u.email as server_email,
  COUNT(o.id) as active_orders_count,
  SUM(o.total_amount) as total_amount,
  SUM(CASE WHEN o.payment_status = 'UNPAID' THEN o.total_amount ELSE 0 END) as unpaid_amount
FROM table_sessions ts
JOIN tables t ON ts.table_id = t.id
LEFT JOIN auth.users u ON ts.server_id = u.id
LEFT JOIN orders o ON ts.table_id = o.table_id AND o.is_active = true
WHERE ts.closed_at IS NULL
GROUP BY ts.id, t.label, t.area, t.seat_count, u.email;

-- View for active counter sessions
CREATE VIEW active_counter_sessions AS
SELECT 
  cs.*,
  c.label as counter_label,
  c.area,
  u.email as server_email,
  COUNT(o.id) as active_orders_count,
  SUM(o.total_amount) as total_amount,
  SUM(CASE WHEN o.payment_status = 'UNPAID' THEN o.total_amount ELSE 0 END) as unpaid_amount
FROM counter_sessions cs
JOIN counters c ON cs.counter_id = c.id
LEFT JOIN auth.users u ON cs.server_id = u.id
LEFT JOIN orders o ON c.label = o.table_number::text AND o.source = 'counter' AND o.is_active = true
WHERE cs.closed_at IS NULL
GROUP BY cs.id, c.label, c.area, u.email;

-- ========================================
-- SECTION 9: COMMENTS
-- ========================================

COMMENT ON TABLE organizations IS 'Core organizations table for multi-tenant support';
COMMENT ON TABLE venues IS 'Restaurant venues belonging to organizations';
COMMENT ON TABLE user_venue_roles IS 'User role assignments per venue';
COMMENT ON TABLE tables IS 'Physical tables in a venue';
COMMENT ON TABLE table_sessions IS 'Tracks table occupancy and sessions';
COMMENT ON TABLE reservations IS 'Table reservations';
COMMENT ON TABLE orders IS 'Customer orders from QR or counter';
COMMENT ON TABLE ingredients IS 'Inventory ingredients';
COMMENT ON TABLE stock_ledger IS 'Stock movement history';
COMMENT ON TABLE menu_item_ingredients IS 'Recipe ingredients for menu items';
COMMENT ON TABLE kds_stations IS 'Kitchen display stations';
COMMENT ON TABLE kds_tickets IS 'Kitchen tickets for order items';
COMMENT ON TABLE counters IS 'Virtual counter entities for counter orders';
COMMENT ON TABLE counter_sessions IS 'Tracks counter sessions';
COMMENT ON TABLE bill_splits IS 'Bill splitting functionality';
COMMENT ON TABLE service_charges IS 'Service charges, discounts, comps, and voids';

-- ========================================
-- VALIDATION COMPLETE
-- ========================================

-- Output confirmation
DO $$
BEGIN
  RAISE NOTICE '✓ Schema validation and fixes applied successfully';
  RAISE NOTICE '✓ All tables created or validated';
  RAISE NOTICE '✓ All indexes created';
  RAISE NOTICE '✓ All triggers applied';
  RAISE NOTICE '✓ All views created';
  RAISE NOTICE 'Schema is now synchronized with commit f7df15cf0e91685740b4cf4eeb7b7418cc24d4c6';
END $$;

