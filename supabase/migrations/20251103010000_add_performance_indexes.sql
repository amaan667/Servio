-- Performance Optimization Indexes
-- Adds indexes for common query patterns to improve response times

-- Menu Items Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_menu_items_venue_category_position 
  ON menu_items(venue_id, category, position);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_menu_items_venue_available 
  ON menu_items(venue_id, is_available) WHERE is_available = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_menu_items_category 
  ON menu_items(category);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_menu_items_position 
  ON menu_items(position);

-- Orders Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_venue_status_created 
  ON orders(venue_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_table_status 
  ON orders(table_number, status) WHERE table_number IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_created_at 
  ON orders(created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_payment_status 
  ON orders(payment_status, created_at DESC);

-- Tables Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tables_venue_status 
  ON tables(venue_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tables_table_number 
  ON tables(table_number, venue_id);

-- Staff Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_staff_venue_role 
  ON staff(venue_id, role);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_staff_user_venue 
  ON staff(user_id, venue_id);

-- Inventory Indexes  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_venue_category 
  ON inventory(venue_id, category) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_low_stock 
  ON inventory(venue_id, current_stock, minimum_stock) 
  WHERE current_stock <= minimum_stock;

-- Feedback Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feedback_venue_created 
  ON customer_feedback(venue_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feedback_rating 
  ON customer_feedback(overall_rating, created_at DESC);

-- Menu Design Settings Index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_menu_design_venue 
  ON menu_design_settings(venue_id);

-- Menu Uploads Index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_menu_uploads_venue_created 
  ON menu_uploads(venue_id, created_at DESC);

-- Add comments for documentation
COMMENT ON INDEX idx_menu_items_venue_category_position IS 'Optimizes menu item queries by venue and category with ordering';
COMMENT ON INDEX idx_orders_venue_status_created IS 'Optimizes live orders dashboard queries';
COMMENT ON INDEX idx_inventory_low_stock IS 'Enables fast low stock alerts';

-- Analyze tables for query planner
ANALYZE menu_items;
ANALYZE orders;
ANALYZE tables;
ANALYZE staff;
ANALYZE inventory;

