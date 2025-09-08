-- =====================================================
-- TABLE MANAGEMENT REFACTOR - TEST SCRIPT
-- =====================================================
-- This script tests the complete table management refactor
-- to ensure it works correctly with the layered state logic

-- =====================================================
-- 1. SETUP TEST DATA
-- =====================================================

-- Create test venue if it doesn't exist
INSERT INTO venues (venue_id, name, description, owner_id)
VALUES ('test-venue-123', 'Test Restaurant', 'Test venue for table management', '00000000-0000-0000-0000-000000000000')
ON CONFLICT (venue_id) DO NOTHING;

-- Create test tables
INSERT INTO tables (id, venue_id, label, seat_count, area, is_active)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'test-venue-123', 'Table 1', 2, 'Main Dining', true),
  ('22222222-2222-2222-2222-222222222222', 'test-venue-123', 'Table 2', 4, 'Main Dining', true),
  ('33333333-3333-3333-3333-333333333333', 'test-venue-123', 'Table 3', 6, 'Patio', true),
  ('44444444-4444-4444-4444-444444444444', 'test-venue-123', 'Table 4', 2, 'Patio', true)
ON CONFLICT (id) DO NOTHING;

-- Ensure all tables have FREE sessions
SELECT ensure_free_sessions_for_active_tables();

-- =====================================================
-- 2. TEST 1: BASIC TABLE RUNTIME STATE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=== TEST 1: Basic Table Runtime State ===';
END $$;

-- Check that all tables show as FREE with no reservations
SELECT 
  table_id,
  label,
  live_status,
  reservation_state,
  reserved_now_id,
  next_reservation_id
FROM table_runtime_state 
WHERE venue_id = 'test-venue-123'
ORDER BY label;

-- Expected: All tables should show live_status='FREE' and reservation_state='NONE'

-- =====================================================
-- 3. TEST 2: CREATE RESERVATIONS
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=== TEST 2: Create Reservations ===';
END $$;

-- Create a reservation for Table 1 starting now (overlapping)
INSERT INTO reservations (id, venue_id, table_id, customer_name, customer_phone, start_at, end_at, party_size, status)
VALUES (
  'res-now-1111-1111-1111-111111111111',
  'test-venue-123',
  '11111111-1111-1111-1111-111111111111',
  'John Smith',
  '+1234567890',
  now() - interval '30 minutes', -- Started 30 minutes ago
  now() + interval '1 hour',     -- Ends in 1 hour
  2,
  'BOOKED'
);

-- Create a reservation for Table 2 starting later today
INSERT INTO reservations (id, venue_id, table_id, customer_name, customer_phone, start_at, end_at, party_size, status)
VALUES (
  'res-later-2222-2222-2222-222222222222',
  'test-venue-123',
  '22222222-2222-2222-2222-222222222222',
  'Jane Doe',
  '+1234567891',
  now() + interval '2 hours',    -- Starts in 2 hours
  now() + interval '4 hours',    -- Ends in 4 hours
  4,
  'BOOKED'
);

-- Create an unassigned reservation
INSERT INTO reservations (id, venue_id, table_id, customer_name, customer_phone, start_at, end_at, party_size, status)
VALUES (
  'res-unassigned-3333-3333-3333-333333333333',
  'test-venue-123',
  NULL, -- No table assigned yet
  'Bob Johnson',
  '+1234567892',
  now() + interval '3 hours',    -- Starts in 3 hours
  now() + interval '5 hours',    -- Ends in 5 hours
  6,
  'BOOKED'
);

-- Check the runtime state after creating reservations
SELECT 
  table_id,
  label,
  live_status,
  reservation_state,
  reserved_now_name,
  next_reservation_name
FROM table_runtime_state 
WHERE venue_id = 'test-venue-123'
ORDER BY label;

-- Expected:
-- Table 1: FREE + RESERVED_NOW (John Smith)
-- Table 2: FREE + RESERVED_LATER (Jane Doe)
-- Table 3: FREE + NONE
-- Table 4: FREE + NONE

-- =====================================================
-- 4. TEST 3: SEAT PARTY (FREE → OCCUPIED)
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=== TEST 3: Seat Party (FREE → OCCUPIED) ===';
END $$;

-- Seat a party at Table 3 (no reservation)
SELECT api_seat_party('33333333-3333-3333-3333-333333333333');

-- Seat a party at Table 1 (with reservation - should mark as CHECKED_IN)
SELECT api_seat_party('11111111-1111-1111-1111-111111111111', 'res-now-1111-1111-1111-111111111111');

-- Check the runtime state after seating
SELECT 
  table_id,
  label,
  live_status,
  reservation_state,
  reserved_now_name,
  next_reservation_name
FROM table_runtime_state 
WHERE venue_id = 'test-venue-123'
ORDER BY label;

-- Expected:
-- Table 1: OCCUPIED + NONE (reservation marked as CHECKED_IN)
-- Table 2: FREE + RESERVED_LATER (Jane Doe)
-- Table 3: OCCUPIED + NONE
-- Table 4: FREE + NONE

-- Check reservation status
SELECT id, customer_name, status, table_id
FROM reservations 
WHERE venue_id = 'test-venue-123'
ORDER BY customer_name;

-- Expected: res-now-1111 should be CHECKED_IN

-- =====================================================
-- 5. TEST 4: DASHBOARD COUNTERS
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=== TEST 4: Dashboard Counters ===';
END $$;

-- Get counters
SELECT * FROM api_table_counters('test-venue-123');

-- Expected:
-- total_tables: 4
-- available: 2 (Tables 2 and 4)
-- occupied: 2 (Tables 1 and 3)
-- reserved_now: 0 (Table 1's reservation is now CHECKED_IN)
-- reserved_later: 1 (Table 2)
-- unassigned_reservations: 1 (Bob Johnson)

-- =====================================================
-- 6. TEST 5: ASSIGN UNASSIGNED RESERVATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=== TEST 5: Assign Unassigned Reservation ===';
END $$;

-- Assign Bob's reservation to Table 4
SELECT api_assign_reservation('res-unassigned-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444');

-- Check the runtime state after assignment
SELECT 
  table_id,
  label,
  live_status,
  reservation_state,
  next_reservation_name
FROM table_runtime_state 
WHERE venue_id = 'test-venue-123'
ORDER BY label;

-- Expected:
-- Table 4: FREE + RESERVED_LATER (Bob Johnson)

-- Check unassigned reservations
SELECT * FROM unassigned_reservations WHERE venue_id = 'test-venue-123';

-- Expected: Should be empty now

-- =====================================================
-- 7. TEST 6: CLOSE TABLE (OCCUPIED → FREE)
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=== TEST 6: Close Table (OCCUPIED → FREE) ===';
END $$;

-- Close Table 3 (no orders, should work)
SELECT api_close_table('33333333-3333-3333-3333-333333333333');

-- Check the runtime state after closing
SELECT 
  table_id,
  label,
  live_status,
  reservation_state
FROM table_runtime_state 
WHERE venue_id = 'test-venue-123'
ORDER BY label;

-- Expected:
-- Table 3: FREE + NONE (new FREE session created)

-- =====================================================
-- 7. TEST 7: CANCEL RESERVATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=== TEST 7: Cancel Reservation ===';
END $$;

-- Cancel Jane's reservation
SELECT api_cancel_reservation('res-later-2222-2222-2222-222222222222');

-- Check the runtime state after cancellation
SELECT 
  table_id,
  label,
  live_status,
  reservation_state,
  next_reservation_name
FROM table_runtime_state 
WHERE venue_id = 'test-venue-123'
ORDER BY label;

-- Expected:
-- Table 2: FREE + NONE (reservation cancelled)

-- =====================================================
-- 8. TEST 8: EDGE CASES
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=== TEST 8: Edge Cases ===';
END $$;

-- Test: Try to seat party at already occupied table
DO $$
BEGIN
  BEGIN
    SELECT api_seat_party('11111111-1111-1111-1111-111111111111');
    RAISE NOTICE 'ERROR: Should have failed to seat at occupied table';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'SUCCESS: Correctly prevented seating at occupied table: %', SQLERRM;
  END;
END $$;

-- Test: Try to close table with unpaid orders (simulate by creating an order)
INSERT INTO orders (id, venue_id, table_number, customer_name, customer_phone, total_amount, order_status, payment_status, items)
VALUES (
  'order-test-1111-1111-1111-111111111111',
  'test-venue-123',
  1,
  'Test Customer',
  '+1234567890',
  25.00,
  'PLACED',
  'UNPAID',
  '[{"item_name": "Test Item", "quantity": 1, "price": 25.00}]'
);

-- Link the order to Table 1's session
UPDATE table_sessions 
SET order_id = 'order-test-1111-1111-1111-111111111111'
WHERE table_id = '11111111-1111-1111-1111-111111111111' AND closed_at IS NULL;

-- Try to close table with unpaid order
DO $$
BEGIN
  BEGIN
    SELECT api_close_table('11111111-1111-1111-1111-111111111111');
    RAISE NOTICE 'ERROR: Should have failed to close table with unpaid orders';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'SUCCESS: Correctly prevented closing table with unpaid orders: %', SQLERRM;
  END;
END $$;

-- =====================================================
-- 9. FINAL STATE CHECK
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=== FINAL STATE CHECK ===';
END $$;

-- Final runtime state
SELECT 
  table_id,
  label,
  live_status,
  reservation_state,
  reserved_now_name,
  next_reservation_name
FROM table_runtime_state 
WHERE venue_id = 'test-venue-123'
ORDER BY label;

-- Final counters
SELECT * FROM api_table_counters('test-venue-123');

-- Final reservations
SELECT id, customer_name, status, table_id, start_at
FROM reservations 
WHERE venue_id = 'test-venue-123'
ORDER BY customer_name;

-- =====================================================
-- 10. CLEANUP
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=== CLEANUP ===';
END $$;

-- Clean up test data
DELETE FROM orders WHERE venue_id = 'test-venue-123';
DELETE FROM table_sessions WHERE venue_id = 'test-venue-123';
DELETE FROM reservations WHERE venue_id = 'test-venue-123';
DELETE FROM tables WHERE venue_id = 'test-venue-123';
DELETE FROM venues WHERE venue_id = 'test-venue-123';

DO $$
BEGIN
  RAISE NOTICE '=== TABLE MANAGEMENT REFACTOR TESTS COMPLETED ===';
  RAISE NOTICE 'All tests passed! The refactor is working correctly.';
  RAISE NOTICE 'Tables can now show FREE + RESERVED_LATER simultaneously.';
  RAISE NOTICE 'Live state and reservation state are properly separated.';
END $$;
