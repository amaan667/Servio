-- POS System Database Schema Updates
-- This script implements the full POS system specification

-- ========================================
-- 1. Add missing fields to orders table
-- ========================================

-- Add payment_mode field to differentiate online/pay_later/pay_at_till
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(20) DEFAULT 'online';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_id UUID REFERENCES tables(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_session_id VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255);

-- Add computed field for active orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_active BOOLEAN GENERATED ALWAYS AS (
  order_status IN ('PLACED','IN_PREP','READY','SERVING')
) STORED;

-- Update existing orders to have proper payment_mode
UPDATE orders SET payment_mode = 'online' WHERE payment_method = 'stripe' OR payment_method = 'demo';
UPDATE orders SET payment_mode = 'pay_at_till' WHERE payment_method = 'till';
UPDATE orders SET payment_mode = 'pay_later' WHERE payment_status = 'UNPAID' AND payment_method IS NULL;

-- ========================================
-- 2. Create table_sessions table
-- ========================================

CREATE TABLE IF NOT EXISTS table_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(venue_id),
  table_id UUID NOT NULL REFERENCES tables(id),
  server_id UUID REFERENCES auth.users(id),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'OCCUPIED' CHECK (status IN ('OCCUPIED', 'AWAITING_PAYMENT', 'CLEANING', 'FREE')),
  guest_count INTEGER DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_table_sessions_venue_id ON table_sessions(venue_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_table_id ON table_sessions(table_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_status ON table_sessions(status);
CREATE INDEX IF NOT EXISTS idx_table_sessions_opened_at ON table_sessions(opened_at);

-- ========================================
-- 3. Create counters table for virtual counter entities
-- ========================================

CREATE TABLE IF NOT EXISTS counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(venue_id),
  label VARCHAR(50) NOT NULL,
  area VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(venue_id, label)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_counters_venue_id ON counters(venue_id);
CREATE INDEX IF NOT EXISTS idx_counters_active ON counters(is_active);

-- ========================================
-- 4. Create counter_sessions table for counter orders
-- ========================================

CREATE TABLE IF NOT EXISTS counter_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(venue_id),
  counter_id UUID NOT NULL REFERENCES counters(id),
  server_id UUID REFERENCES auth.users(id),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'AWAITING_PAYMENT', 'CLOSED')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_counter_sessions_venue_id ON counter_sessions(venue_id);
CREATE INDEX IF NOT EXISTS idx_counter_sessions_counter_id ON counter_sessions(counter_id);
CREATE INDEX IF NOT EXISTS idx_counter_sessions_status ON counter_sessions(status);

-- ========================================
-- 5. Create bill_splits table for bill splitting functionality
-- ========================================

CREATE TABLE IF NOT EXISTS bill_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(venue_id),
  table_session_id UUID REFERENCES table_sessions(id),
  counter_session_id UUID REFERENCES counter_sessions(id),
  split_number INTEGER NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  payment_status VARCHAR(20) DEFAULT 'UNPAID' CHECK (payment_status IN ('UNPAID', 'PAID', 'REFUNDED')),
  payment_method VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_bill_splits_venue_id ON bill_splits(venue_id);
CREATE INDEX IF NOT EXISTS idx_bill_splits_table_session ON bill_splits(table_session_id);
CREATE INDEX IF NOT EXISTS idx_bill_splits_counter_session ON bill_splits(counter_session_id);

-- ========================================
-- 6. Create order_bill_splits junction table
-- ========================================

CREATE TABLE IF NOT EXISTS order_bill_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  bill_split_id UUID NOT NULL REFERENCES bill_splits(id),
  amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(order_id, bill_split_id)
);

-- ========================================
-- 7. Create service_charges table
-- ========================================

CREATE TABLE IF NOT EXISTS service_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(venue_id),
  table_session_id UUID REFERENCES table_sessions(id),
  counter_session_id UUID REFERENCES counter_sessions(id),
  charge_type VARCHAR(20) NOT NULL CHECK (charge_type IN ('SERVICE_CHARGE', 'DISCOUNT', 'COMP', 'VOID')),
  amount DECIMAL(10,2) NOT NULL,
  percentage DECIMAL(5,2),
  reason TEXT,
  applied_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- 8. Create functions for POS operations
-- ========================================

-- Function to get table status with order counts and totals
CREATE OR REPLACE FUNCTION get_table_status(p_venue_id UUID)
RETURNS TABLE (
  table_id UUID,
  table_label VARCHAR,
  area VARCHAR,
  seat_count INTEGER,
  session_id UUID,
  session_status VARCHAR,
  opened_at TIMESTAMPTZ,
  server_id UUID,
  guest_count INTEGER,
  active_orders_count INTEGER,
  total_amount DECIMAL,
  unpaid_amount DECIMAL,
  payment_mode_mix JSONB,
  last_order_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id as table_id,
    t.label as table_label,
    t.area,
    t.seat_count,
    ts.id as session_id,
    ts.status as session_status,
    ts.opened_at,
    ts.server_id,
    ts.guest_count,
    COALESCE(order_counts.active_count, 0) as active_orders_count,
    COALESCE(order_totals.total_amount, 0) as total_amount,
    COALESCE(unpaid_totals.unpaid_amount, 0) as unpaid_amount,
    COALESCE(payment_modes.mode_mix, '{}'::jsonb) as payment_mode_mix,
    COALESCE(order_totals.last_order_at, ts.opened_at) as last_order_at
  FROM tables t
  LEFT JOIN table_sessions ts ON t.id = ts.table_id AND ts.closed_at IS NULL
  LEFT JOIN (
    SELECT 
      o.table_id,
      COUNT(*) as active_count
    FROM orders o
    WHERE o.venue_id = p_venue_id 
      AND o.is_active = true
      AND o.table_id IS NOT NULL
    GROUP BY o.table_id
  ) order_counts ON t.id = order_counts.table_id
  LEFT JOIN (
    SELECT 
      o.table_id,
      SUM(o.total_amount) as total_amount,
      MAX(o.created_at) as last_order_at
    FROM orders o
    WHERE o.venue_id = p_venue_id 
      AND o.is_active = true
      AND o.table_id IS NOT NULL
    GROUP BY o.table_id
  ) order_totals ON t.id = order_totals.table_id
  LEFT JOIN (
    SELECT 
      o.table_id,
      SUM(o.total_amount) as unpaid_amount
    FROM orders o
    WHERE o.venue_id = p_venue_id 
      AND o.is_active = true
      AND o.table_id IS NOT NULL
      AND o.payment_mode IN ('pay_later', 'pay_at_till')
      AND o.payment_status = 'UNPAID'
    GROUP BY o.table_id
  ) unpaid_totals ON t.id = unpaid_totals.table_id
  LEFT JOIN (
    SELECT 
      o.table_id,
      jsonb_object_agg(o.payment_mode, mode_count) as mode_mix
    FROM (
      SELECT 
        table_id,
        payment_mode,
        COUNT(*) as mode_count
      FROM orders o
      WHERE o.venue_id = p_venue_id 
        AND o.is_active = true
        AND o.table_id IS NOT NULL
      GROUP BY table_id, payment_mode
    ) o
    GROUP BY o.table_id
  ) payment_modes ON t.id = payment_modes.table_id
  WHERE t.venue_id = p_venue_id AND t.is_active = true
  ORDER BY t.label;
END;
$$ LANGUAGE plpgsql;

-- Function to get counter status
CREATE OR REPLACE FUNCTION get_counter_status(p_venue_id UUID)
RETURNS TABLE (
  counter_id UUID,
  counter_label VARCHAR,
  area VARCHAR,
  session_id UUID,
  session_status VARCHAR,
  opened_at TIMESTAMPTZ,
  server_id UUID,
  active_orders_count INTEGER,
  total_amount DECIMAL,
  unpaid_amount DECIMAL,
  last_order_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as counter_id,
    c.label as counter_label,
    c.area,
    cs.id as session_id,
    cs.status as session_status,
    cs.opened_at,
    cs.server_id,
    COALESCE(order_counts.active_count, 0) as active_orders_count,
    COALESCE(order_totals.total_amount, 0) as total_amount,
    COALESCE(unpaid_totals.unpaid_amount, 0) as unpaid_amount,
    COALESCE(order_totals.last_order_at, cs.opened_at) as last_order_at
  FROM counters c
  LEFT JOIN counter_sessions cs ON c.id = cs.counter_id AND cs.closed_at IS NULL
  LEFT JOIN (
    SELECT 
      o.table_number,
      COUNT(*) as active_count
    FROM orders o
    WHERE o.venue_id = p_venue_id 
      AND o.is_active = true
      AND o.source = 'counter'
    GROUP BY o.table_number
  ) order_counts ON c.label = order_counts.table_number::text
  LEFT JOIN (
    SELECT 
      o.table_number,
      SUM(o.total_amount) as total_amount,
      MAX(o.created_at) as last_order_at
    FROM orders o
    WHERE o.venue_id = p_venue_id 
      AND o.is_active = true
      AND o.source = 'counter'
    GROUP BY o.table_number
  ) order_totals ON c.label = order_totals.table_number::text
  LEFT JOIN (
    SELECT 
      o.table_number,
      SUM(o.total_amount) as unpaid_amount
    FROM orders o
    WHERE o.venue_id = p_venue_id 
      AND o.is_active = true
      AND o.source = 'counter'
      AND o.payment_mode IN ('pay_later', 'pay_at_till')
      AND o.payment_status = 'UNPAID'
    GROUP BY o.table_number
  ) unpaid_totals ON c.label = unpaid_totals.table_number::text
  WHERE c.venue_id = p_venue_id AND c.is_active = true
  ORDER BY c.label;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 9. Create triggers for updated_at timestamps
-- ========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_table_sessions_updated_at 
  BEFORE UPDATE ON table_sessions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_counters_updated_at 
  BEFORE UPDATE ON counters 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_counter_sessions_updated_at 
  BEFORE UPDATE ON counter_sessions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bill_splits_updated_at 
  BEFORE UPDATE ON bill_splits 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 10. Insert default counters for existing venues
-- ========================================

INSERT INTO counters (venue_id, label, area, is_active)
SELECT 
  v.venue_id,
  'Counter ' || generate_series(1, 3),
  'Main',
  true
FROM venues v
WHERE NOT EXISTS (
  SELECT 1 FROM counters c WHERE c.venue_id = v.venue_id
);

-- ========================================
-- 11. Update existing orders to link to proper table_id
-- ========================================

-- Link orders to tables based on table_number
UPDATE orders 
SET table_id = t.id
FROM tables t
WHERE orders.venue_id = t.venue_id 
  AND orders.table_number::text = t.label
  AND orders.table_id IS NULL
  AND orders.source = 'qr';

-- ========================================
-- 12. Create views for easier querying
-- ========================================

-- View for active table sessions with order details
CREATE OR REPLACE VIEW active_table_sessions AS
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
CREATE OR REPLACE VIEW active_counter_sessions AS
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

COMMENT ON TABLE table_sessions IS 'Tracks table occupancy and sessions for POS system';
COMMENT ON TABLE counters IS 'Virtual counter entities for counter orders';
COMMENT ON TABLE counter_sessions IS 'Tracks counter sessions for counter orders';
COMMENT ON TABLE bill_splits IS 'Bill splitting functionality for tables';
COMMENT ON TABLE service_charges IS 'Service charges, discounts, comps, and voids';
