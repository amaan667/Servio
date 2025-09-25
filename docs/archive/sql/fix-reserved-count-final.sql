-- FINAL FIX for Reserved Table Count Issue
-- The issue was a stale table session with RESERVED status when no active reservations existed

-- 1. Check for any table sessions with RESERVED status but no active reservations
SELECT 
    '=== CHECKING FOR STALE RESERVED SESSIONS ===' as step,
    ts.id,
    ts.table_id,
    ts.status,
    ts.created_at,
    t.label as table_label
FROM table_sessions ts
JOIN tables t ON ts.table_id = t.id
WHERE ts.status = 'RESERVED'
  AND ts.venue_id = 'venue-1e02af4d';

-- 2. Check for active reservations
SELECT 
    '=== CHECKING ACTIVE RESERVATIONS ===' as step,
    COUNT(*) as active_reservation_count
FROM reservations 
WHERE venue_id = 'venue-1e02af4d' 
  AND status = 'BOOKED'
  AND end_at > NOW();

-- 3. Fix: Update any table sessions with RESERVED status to FREE when no active reservations exist
UPDATE table_sessions 
SET status = 'FREE', updated_at = NOW()
WHERE status = 'RESERVED'
  AND venue_id = 'venue-1e02af4d'
  AND NOT EXISTS (
    SELECT 1 FROM reservations 
    WHERE venue_id = 'venue-1e02af4d' 
      AND status = 'BOOKED'
      AND end_at > NOW()
  );

-- 4. Verify the fix
SELECT 
    '=== VERIFICATION: TABLE RUNTIME STATE ===' as step,
    table_id,
    label,
    primary_status,
    reservation_status
FROM table_runtime_state 
WHERE venue_id = 'venue-1e02af4d'
ORDER BY label;

-- 5. Check final counts
SELECT 
    '=== FINAL COUNTS ===' as step,
    COUNT(*) as total_tables,
    COUNT(CASE WHEN primary_status = 'FREE' THEN 1 END) as free_tables,
    COUNT(CASE WHEN primary_status = 'OCCUPIED' THEN 1 END) as occupied_tables,
    COUNT(CASE WHEN reservation_status = 'RESERVED_NOW' OR reservation_status = 'RESERVED_LATER' THEN 1 END) as reserved_tables
FROM table_runtime_state 
WHERE venue_id = 'venue-1e02af4d';
