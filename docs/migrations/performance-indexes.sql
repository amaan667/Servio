-- Performance Optimization Indexes
-- Run these to dramatically improve query performance

-- Menu Items Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_menu_items_venue_category_available 
ON menu_items(venue_id, category, is_available) 
WHERE is_available = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_menu_items_venue_position 
ON menu_items(venue_id, category, position) 
WHERE position IS NOT NULL;

-- Orders Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_venue_status_created 
ON orders(venue_id, status, created_at DESC) 
WHERE created_at > NOW() - INTERVAL '90 days';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_session_id 
ON orders(session_id) 
WHERE status IN ('pending', 'preparing', 'ready');

-- Table Sessions Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_table_sessions_venue_table 
ON table_sessions(venue_id, table_id, status) 
WHERE status IN ('active', 'pending');

-- Staff Invitations Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_staff_invitations_venue_status 
ON staff_invitations(venue_id, status, created_at DESC);

-- Menu Uploads Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_menu_uploads_venue_created 
ON menu_uploads(venue_id, created_at DESC);

-- Venues Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_venues_owner 
ON venues(owner_id);

-- Menu Hotspots Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_menu_hotspots_venue_active 
ON menu_hotspots(venue_id, is_active) 
WHERE is_active = true;

-- Analyze tables for query optimization
ANALYZE menu_items;
ANALYZE orders;
ANALYZE table_sessions;
ANALYZE staff_invitations;
ANALYZE menu_uploads;

-- Query performance monitoring
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- View slow queries
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time,
  rows
FROM pg_stat_statements
WHERE mean_time > 100 -- queries taking > 100ms on average
ORDER BY mean_time DESC
LIMIT 20;

