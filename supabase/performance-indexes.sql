-- Performance Optimization Indexes for Servio MVP
-- Run this script in your Supabase SQL Editor to improve query performance
-- These indexes support the optimized queries in the unified handler and dashboard routes

-- ============================================================================
-- ORDERS TABLE INDEXES
-- ============================================================================

-- Composite index for dashboard orders query (venue_id + payment_status + order_status + created_at)
-- Used by: /api/dashboard/orders, /api/live-orders, /api/pos/orders
CREATE INDEX IF NOT EXISTS idx_orders_venue_payment_status_created 
ON orders(venue_id, payment_status, order_status, created_at DESC);

-- Index for filtering orders by venue and date range
-- Used by: dashboard orders with scope filtering (live, earlier, history)
CREATE INDEX IF NOT EXISTS idx_orders_venue_created_at 
ON orders(venue_id, created_at DESC);

-- Index for order status filtering
-- Used by: order status updates and filtering
CREATE INDEX IF NOT EXISTS idx_orders_status 
ON orders(order_status) 
WHERE order_status IN ('PLACED', 'IN_PREP', 'READY', 'SERVING', 'COMPLETED');

-- Index for payment status filtering
-- Used by: payment status queries
CREATE INDEX IF NOT EXISTS idx_orders_payment_status 
ON orders(payment_status) 
WHERE payment_status IN ('PAID', 'UNPAID', 'REFUNDED');

-- Index for table_id lookups (for table-specific orders)
CREATE INDEX IF NOT EXISTS idx_orders_table_id 
ON orders(table_id) 
WHERE table_id IS NOT NULL;

-- ============================================================================
-- TABLES TABLE INDEXES
-- ============================================================================

-- Index for venue tables lookup
-- Used by: dashboard table counts, table management
CREATE INDEX IF NOT EXISTS idx_tables_venue_active 
ON tables(venue_id, is_active) 
WHERE is_active = true;

-- Index for table lookups by venue
CREATE INDEX IF NOT EXISTS idx_tables_venue 
ON tables(venue_id);

-- ============================================================================
-- TABLE_SESSIONS TABLE INDEXES
-- ============================================================================

-- Composite index for active sessions lookup
-- Used by: dashboard active tables count, session management
CREATE INDEX IF NOT EXISTS idx_table_sessions_venue_status 
ON table_sessions(venue_id, status, closed_at) 
WHERE status = 'OCCUPIED' AND closed_at IS NULL;

-- Index for venue sessions
CREATE INDEX IF NOT EXISTS idx_table_sessions_venue 
ON table_sessions(venue_id);

-- Index for table_id lookups in sessions
CREATE INDEX IF NOT EXISTS idx_table_sessions_table_id 
ON table_sessions(table_id) 
WHERE table_id IS NOT NULL;

-- ============================================================================
-- RESERVATIONS TABLE INDEXES
-- ============================================================================

-- Composite index for current reservations lookup
-- Used by: dashboard reservations count
CREATE INDEX IF NOT EXISTS idx_reservations_venue_status_dates 
ON reservations(venue_id, status, start_at, end_at) 
WHERE status = 'BOOKED';

-- Index for venue reservations
CREATE INDEX IF NOT EXISTS idx_reservations_venue 
ON reservations(venue_id);

-- Index for table_id lookups in reservations
CREATE INDEX IF NOT EXISTS idx_reservations_table_id 
ON reservations(table_id) 
WHERE table_id IS NOT NULL;

-- ============================================================================
-- KDS_TICKETS TABLE INDEXES
-- ============================================================================

-- Index for order_id lookups (used in backfill optimization)
-- Used by: /api/kds/backfill-all (batched ticket existence check)
CREATE INDEX IF NOT EXISTS idx_kds_tickets_order_id 
ON kds_tickets(order_id);

-- Composite index for venue station tickets
-- Used by: KDS station views
CREATE INDEX IF NOT EXISTS idx_kds_tickets_venue_station 
ON kds_tickets(venue_id, station_id, status, created_at DESC);

-- ============================================================================
-- MENU ITEMS TABLE INDEXES
-- ============================================================================

-- Index for venue menu items (using is_available instead of is_active)
CREATE INDEX IF NOT EXISTS idx_menu_items_venue_available 
ON menu_items(venue_id, is_available) 
WHERE is_available = true;

-- Index for venue menu items (general lookup)
CREATE INDEX IF NOT EXISTS idx_menu_items_venue 
ON menu_items(venue_id);

-- ============================================================================
-- STAFF TABLE INDEXES
-- ============================================================================

-- Index for venue staff lookup (using 'active' column, not 'is_active')
CREATE INDEX IF NOT EXISTS idx_staff_venue_active 
ON staff(venue_id, active) 
WHERE active = true;

-- Index for venue staff lookup (general)
CREATE INDEX IF NOT EXISTS idx_staff_venue 
ON staff(venue_id);

-- ============================================================================
-- ANALYZE TABLES
-- ============================================================================

-- Update table statistics for query planner
ANALYZE orders;
ANALYZE tables;
ANALYZE table_sessions;
ANALYZE reservations;
ANALYZE kds_tickets;
ANALYZE menu_items;
ANALYZE staff;

-- ============================================================================
-- NOTES
-- ============================================================================

-- These indexes are designed to support:
-- 1. Dashboard queries (orders, counts, stats)
-- 2. Live orders queries
-- 3. POS queries
-- 4. Table management queries
-- 5. Reservation queries
-- 6. KDS ticket queries (with batched lookups)

-- Index maintenance:
-- - PostgreSQL automatically maintains indexes
-- - Monitor index usage with: SELECT * FROM pg_stat_user_indexes;
-- - Rebuild if needed: REINDEX INDEX idx_name;
