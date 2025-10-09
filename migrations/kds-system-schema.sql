-- Kitchen Display System (KDS) Schema
-- This schema supports station-based ticket management for kitchen operations

-- Drop triggers first (before functions that they depend on)
DROP TRIGGER IF EXISTS trg_create_kds_tickets ON orders;
DROP TRIGGER IF EXISTS trg_sync_order_status ON kds_tickets;
DROP TRIGGER IF EXISTS trg_kds_stations_updated_at ON kds_stations;
DROP TRIGGER IF EXISTS trg_kds_tickets_updated_at ON kds_tickets;

-- Drop functions (after triggers)
DROP FUNCTION IF EXISTS create_kds_tickets_from_order() CASCADE;
DROP FUNCTION IF EXISTS update_order_status_from_kds() CASCADE;
DROP FUNCTION IF EXISTS update_kds_updated_at() CASCADE;
DROP FUNCTION IF EXISTS setup_default_kds_stations(TEXT) CASCADE;

-- Drop existing tables if they exist (in reverse dependency order)
DROP TABLE IF EXISTS kds_station_categories CASCADE;
DROP TABLE IF EXISTS kds_tickets CASCADE;
DROP TABLE IF EXISTS kds_stations CASCADE;

-- KDS Stations Table
-- Represents different preparation stations (Grill, Fryer, Barista, etc.)
CREATE TABLE kds_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
  station_name TEXT NOT NULL,
  station_type TEXT, -- 'grill', 'fryer', 'barista', 'expo', 'cold', 'hot', etc.
  display_order INTEGER DEFAULT 0,
  color_code TEXT DEFAULT '#3b82f6', -- For UI theming
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(venue_id, station_name)
);

-- KDS Tickets Table
-- Individual preparation tickets for each order item at specific stations
CREATE TABLE kds_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  station_id UUID NOT NULL REFERENCES kds_stations(id) ON DELETE CASCADE,
  
  -- Item details (denormalized for performance)
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  special_instructions TEXT,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'new', -- 'new', 'in_progress', 'ready', 'bumped'
  
  -- Timing metrics
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  bumped_at TIMESTAMPTZ,
  
  -- Metadata
  table_number INTEGER,
  table_label TEXT,
  priority INTEGER DEFAULT 0, -- Higher priority = more urgent
  
  -- Audit
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_kds_tickets_venue ON kds_tickets(venue_id);
CREATE INDEX idx_kds_tickets_order ON kds_tickets(order_id);
CREATE INDEX idx_kds_tickets_station ON kds_tickets(station_id);
CREATE INDEX idx_kds_tickets_status ON kds_tickets(status);
CREATE INDEX idx_kds_tickets_created ON kds_tickets(created_at);

-- Station category mapping (optional, for auto-routing items to stations)
CREATE TABLE kds_station_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
  station_id UUID NOT NULL REFERENCES kds_stations(id) ON DELETE CASCADE,
  menu_category TEXT NOT NULL, -- e.g., 'Burgers', 'Drinks', 'Appetizers'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(venue_id, station_id, menu_category)
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_kds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER trg_kds_stations_updated_at
  BEFORE UPDATE ON kds_stations
  FOR EACH ROW
  EXECUTE FUNCTION update_kds_updated_at();

CREATE TRIGGER trg_kds_tickets_updated_at
  BEFORE UPDATE ON kds_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_kds_updated_at();

-- Function to automatically update order status when KDS tickets change
-- KDS handles: PLACED -> IN_PREP -> READY
-- FOH handles: READY -> SERVED -> COMPLETED
CREATE OR REPLACE FUNCTION update_order_status_from_kds()
RETURNS TRIGGER AS $$
DECLARE
  pending_count INTEGER;
  all_bumped BOOLEAN;
  all_ready BOOLEAN;
BEGIN
  -- Check if all tickets for this order are ready (not new or in_progress)
  SELECT COUNT(*) INTO pending_count
  FROM kds_tickets
  WHERE order_id = NEW.order_id
    AND status IN ('new', 'in_progress');
  
  -- Check if all tickets are bumped (kitchen finished)
  SELECT NOT EXISTS (
    SELECT 1 FROM kds_tickets
    WHERE order_id = NEW.order_id
      AND status != 'bumped'
  ) INTO all_bumped;
  
  -- Check if all tickets are ready or bumped (kitchen work done)
  SELECT NOT EXISTS (
    SELECT 1 FROM kds_tickets
    WHERE order_id = NEW.order_id
      AND status IN ('new', 'in_progress')
  ) INTO all_ready;
  
  -- Update order status based on ticket states
  IF all_bumped THEN
    -- All tickets bumped = order ready for FOH service
    UPDATE orders
    SET order_status = 'READY'
    WHERE id = NEW.order_id
      AND order_status NOT IN ('READY', 'SERVED', 'COMPLETED');
  ELSIF all_ready THEN
    -- All tickets ready (but not bumped) = order ready for expo
    UPDATE orders
    SET order_status = 'READY'
    WHERE id = NEW.order_id
      AND order_status NOT IN ('READY', 'SERVED', 'COMPLETED');
  ELSIF NEW.status = 'in_progress' AND OLD.status = 'new' THEN
    -- First ticket started = order in prep
    UPDATE orders
    SET order_status = 'IN_PREP'
    WHERE id = NEW.order_id
      AND order_status = 'PLACED';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to sync order status with KDS tickets
CREATE TRIGGER trg_sync_order_status
  AFTER UPDATE OF status ON kds_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_order_status_from_kds();

-- Function to create KDS tickets from order items
CREATE OR REPLACE FUNCTION create_kds_tickets_from_order()
RETURNS TRIGGER AS $$
DECLARE
  item JSONB;
  station_record RECORD;
  item_category TEXT;
  default_station UUID;
BEGIN
  -- Only create tickets for new orders
  IF NEW.order_status != 'PLACED' AND OLD.order_status IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check if KDS tables exist, if not, skip ticket creation
  BEGIN
    PERFORM 1 FROM information_schema.tables WHERE table_name = 'kds_stations' AND table_schema = 'public';
    IF NOT FOUND THEN
      RETURN NEW;
    END IF;
    
    PERFORM 1 FROM information_schema.tables WHERE table_name = 'kds_tickets' AND table_schema = 'public';
    IF NOT FOUND THEN
      RETURN NEW;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If there's any error checking tables, just return NEW and don't create tickets
    RETURN NEW;
  END;
  
  -- Main ticket creation logic wrapped in exception handling
  BEGIN
    -- Get default/expo station for this venue (or create one if doesn't exist)
    SELECT id INTO default_station
    FROM kds_stations
    WHERE venue_id = NEW.venue_id
      AND station_type = 'expo'
      AND is_active = true
    LIMIT 1;
    
    -- If no expo station exists, create a default one
    IF default_station IS NULL THEN
      INSERT INTO kds_stations (venue_id, station_name, station_type, display_order, is_active)
      VALUES (NEW.venue_id, 'Expo', 'expo', 0, true)
      RETURNING id INTO default_station;
    END IF;
    
    -- Loop through each item in the order
    FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
    LOOP
      -- Extract item category (if available)
      item_category := COALESCE(
        (SELECT category FROM menu_items WHERE id = (item->>'menu_item_id')::TEXT LIMIT 1),
        'General'
      );
      
      -- Find the appropriate station for this category
      SELECT s.id INTO station_record
      FROM kds_stations s
      LEFT JOIN kds_station_categories sc ON s.id = sc.station_id AND sc.menu_category = item_category
      WHERE s.venue_id = NEW.venue_id
        AND s.is_active = true
        AND (sc.menu_category = item_category OR s.station_type = 'expo')
      ORDER BY (CASE WHEN sc.menu_category = item_category THEN 1 ELSE 2 END)
      LIMIT 1;
      
      -- Create ticket at the determined station (or default station)
      INSERT INTO kds_tickets (
        venue_id,
        order_id,
        station_id,
        item_name,
        quantity,
        special_instructions,
        table_number,
        table_label,
        status
      ) VALUES (
        NEW.venue_id,
        NEW.id,
        COALESCE(station_record, default_station),
        item->>'item_name',
        (item->>'quantity')::INTEGER,
        item->>'specialInstructions',
        NEW.table_number,
        COALESCE(NEW.table_id, NEW.table_number::TEXT),
        'new'
      );
    END LOOP;
    
  EXCEPTION WHEN OTHERS THEN
    -- If there's any error creating tickets, just log it and continue
    -- Don't let KDS errors prevent order creation
    RAISE WARNING 'KDS ticket creation failed for order %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create KDS tickets when orders are placed
CREATE TRIGGER trg_create_kds_tickets
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION create_kds_tickets_from_order();

-- Default stations setup function (call this after creating a new venue)
CREATE OR REPLACE FUNCTION setup_default_kds_stations(p_venue_id TEXT)
RETURNS void AS $$
BEGIN
  -- Create default stations if they don't exist
  INSERT INTO kds_stations (venue_id, station_name, station_type, display_order, color_code)
  VALUES
    (p_venue_id, 'Expo', 'expo', 0, '#3b82f6'),
    (p_venue_id, 'Grill', 'grill', 1, '#ef4444'),
    (p_venue_id, 'Fryer', 'fryer', 2, '#f59e0b'),
    (p_venue_id, 'Barista', 'barista', 3, '#8b5cf6'),
    (p_venue_id, 'Cold Prep', 'cold', 4, '#06b6d4')
  ON CONFLICT (venue_id, station_name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security (if needed)
ALTER TABLE kds_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE kds_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE kds_station_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow venue owners and service role to access)
DROP POLICY IF EXISTS "Users can view their venue's KDS stations" ON kds_stations;
DROP POLICY IF EXISTS "Users can manage their venue's KDS stations" ON kds_stations;
DROP POLICY IF EXISTS "Users can view their venue's KDS tickets" ON kds_tickets;
DROP POLICY IF EXISTS "Users can manage their venue's KDS tickets" ON kds_tickets;
DROP POLICY IF EXISTS "Users can view their venue's station categories" ON kds_station_categories;
DROP POLICY IF EXISTS "Users can manage their venue's station categories" ON kds_station_categories;

CREATE POLICY "Users can view their venue's KDS stations"
  ON kds_stations FOR SELECT
  USING (venue_id IN (SELECT venue_id FROM venues WHERE owner_id = auth.uid()));

CREATE POLICY "Users can manage their venue's KDS stations"
  ON kds_stations FOR ALL
  USING (venue_id IN (SELECT venue_id FROM venues WHERE owner_id = auth.uid()));

CREATE POLICY "Users can view their venue's KDS tickets"
  ON kds_tickets FOR SELECT
  USING (venue_id IN (SELECT venue_id FROM venues WHERE owner_id = auth.uid()));

CREATE POLICY "Users can manage their venue's KDS tickets"
  ON kds_tickets FOR ALL
  USING (venue_id IN (SELECT venue_id FROM venues WHERE owner_id = auth.uid()));

CREATE POLICY "Users can view their venue's station categories"
  ON kds_station_categories FOR SELECT
  USING (venue_id IN (SELECT venue_id FROM venues WHERE owner_id = auth.uid()));

CREATE POLICY "Users can manage their venue's station categories"
  ON kds_station_categories FOR ALL
  USING (venue_id IN (SELECT venue_id FROM venues WHERE owner_id = auth.uid()));

-- Service role policies (bypass RLS)
DROP POLICY IF EXISTS "Service role has full access to KDS stations" ON kds_stations;
DROP POLICY IF EXISTS "Service role has full access to KDS tickets" ON kds_tickets;
DROP POLICY IF EXISTS "Service role has full access to station categories" ON kds_station_categories;

CREATE POLICY "Service role has full access to KDS stations"
  ON kds_stations FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Service role has full access to KDS tickets"
  ON kds_tickets FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Service role has full access to station categories"
  ON kds_station_categories FOR ALL
  TO service_role
  USING (true);

