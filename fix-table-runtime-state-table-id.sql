-- Fix the table_runtime_state view to include table_id field for consistency with TableRuntimeState interface

-- 1. Drop the existing view
DROP VIEW IF EXISTS table_runtime_state;

-- 2. Create the corrected view with table_id field and proper reservation data
CREATE VIEW table_runtime_state AS
SELECT 
    t.id,
    t.id as table_id,  -- Add table_id field for consistency with frontend interface
    t.venue_id,
    t.label,
    t.seat_count,
    t.area,
    t.is_active,
    t.created_at,
    t.updated_at,
    t.qr_version,
    ts.id as session_id,
    -- Map status to primary_status for interface compatibility
    CASE 
        WHEN ts.status = 'FREE' THEN 'FREE'
        WHEN ts.status = 'OCCUPIED' THEN 'OCCUPIED'
        ELSE 'FREE'
    END as primary_status,
    ts.opened_at,
    NULL::TEXT as server_id,  -- server_id doesn't exist in table_sessions
    -- Determine reservation status based on actual reservations
    CASE 
        WHEN rn.id IS NOT NULL THEN 'RESERVED_NOW'
        WHEN rl.id IS NOT NULL THEN 'RESERVED_LATER'
        ELSE 'NONE'
    END as reservation_status,
    NULL::UUID as order_id,  -- order_id doesn't exist in table_sessions
    ts.closed_at,
    NULL::NUMERIC as total_amount,  -- total_amount doesn't exist in table_sessions
    NULL::TEXT as customer_name,  -- customer_name doesn't exist in table_sessions
    NULL::TEXT as order_status,  -- order_status doesn't exist in table_sessions
    NULL::TEXT as payment_status,  -- payment_status doesn't exist in table_sessions
    NULL::TIMESTAMPTZ as order_updated_at,  -- order_updated_at doesn't exist in table_sessions
    NULL::TIMESTAMPTZ as reservation_time,  -- reservation_time doesn't exist in table_sessions
    NULL::INTEGER as reservation_duration_minutes,  -- reservation_duration_minutes doesn't exist in table_sessions
    NULL::TIMESTAMPTZ as reservation_end_time,  -- reservation_end_time doesn't exist in table_sessions
    NULL::TIMESTAMPTZ as reservation_created_at,  -- reservation_created_at doesn't exist in table_sessions
    COALESCE(ts.opened_at, t.created_at) as most_recent_activity,
    -- Reserved now data
    rn.id as reserved_now_id,
    rn.start_at as reserved_now_start,
    rn.end_at as reserved_now_end,
    rn.customer_name as reserved_now_name,
    rn.customer_phone as reserved_now_phone,
    rn.party_size as reserved_now_party_size,
    -- Reserved later data
    rl.id as next_reservation_id,
    rl.start_at as next_reservation_start,
    rl.end_at as next_reservation_end,
    rl.customer_name as next_reservation_name,
    rl.customer_phone as next_reservation_phone,
    rl.party_size as next_reservation_party_size
FROM tables t
LEFT JOIN table_sessions ts ON t.id = ts.table_id AND ts.closed_at IS NULL
-- Join with reservations for "now" (current time window)
LEFT JOIN reservations rn ON t.id = rn.table_id 
    AND rn.status = 'BOOKED'
    AND rn.start_at <= NOW() 
    AND rn.end_at > NOW()
-- Join with reservations for "later" (future reservations)
LEFT JOIN reservations rl ON t.id = rl.table_id 
    AND rl.status = 'BOOKED'
    AND rl.start_at > NOW()
    AND rl.id != COALESCE(rn.id, '00000000-0000-0000-0000-000000000000'::uuid)
WHERE t.is_active = true;

-- 3. Test the corrected view
SELECT 'Testing corrected view with table_id:' as info;
SELECT 
    id,
    table_id,
    venue_id,
    label,
    seat_count,
    is_active
FROM table_runtime_state
WHERE venue_id = 'venue-1e02af4d'
ORDER BY label ASC
LIMIT 5;

-- 4. Show the view structure
SELECT 'View structure after fix:' as info;
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'table_runtime_state'
  AND table_schema = 'public'
ORDER BY ordinal_position;
