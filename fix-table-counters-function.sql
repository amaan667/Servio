-- Fix the api_table_counters function to correctly count table states
-- This function should return accurate counts for table management dashboard

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS api_table_counters(text);

-- Create the corrected api_table_counters function
CREATE OR REPLACE FUNCTION api_table_counters(p_venue_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result json;
    total_count integer;
    free_count integer;
    occupied_count integer;
    reserved_now_count integer;
    reserved_later_count integer;
    unassigned_reservations_count integer;
BEGIN 
    -- Get total tables count
    SELECT COUNT(*) INTO total_count
    FROM table_runtime_state
    WHERE venue_id = p_venue_id;
    
    -- Get free tables count (primary_status = 'FREE')
    SELECT COUNT(*) INTO free_count
    FROM table_runtime_state
    WHERE venue_id = p_venue_id 
    AND primary_status = 'FREE';
    
    -- Get occupied tables count (primary_status = 'OCCUPIED')
    SELECT COUNT(*) INTO occupied_count
    FROM table_runtime_state
    WHERE venue_id = p_venue_id 
    AND primary_status = 'OCCUPIED';
    
    -- Get reserved now count (reservation_status = 'RESERVED_NOW')
    SELECT COUNT(*) INTO reserved_now_count
    FROM table_runtime_state
    WHERE venue_id = p_venue_id 
    AND reservation_status = 'RESERVED_NOW';
    
    -- Get reserved later count (reservation_status = 'RESERVED_LATER')
    SELECT COUNT(*) INTO reserved_later_count
    FROM table_runtime_state
    WHERE venue_id = p_venue_id 
    AND reservation_status = 'RESERVED_LATER';
    
    -- Get unassigned reservations count from unassigned_reservations view
    SELECT COUNT(*) INTO unassigned_reservations_count
    FROM unassigned_reservations
    WHERE venue_id = p_venue_id;
    
    -- Build the result JSON
    result := json_build_object(
        'total_tables', total_count,
        'available', free_count,
        'occupied', occupied_count,
        'reserved_now', reserved_now_count,
        'reserved_later', reserved_later_count,
        'unassigned_reservations', unassigned_reservations_count
    );
    
    RETURN result;
END;
$$;

-- Test the function with the venue from the screenshot
SELECT 'Testing api_table_counters function:' as info;
SELECT api_table_counters('venue-1e02af4d') as result;

-- Also show the raw table data for comparison
SELECT 'Raw table_runtime_state data for venue-1e02af4d:' as info;
SELECT 
    table_id,
    label,
    primary_status,
    reservation_status,
    opened_at
FROM table_runtime_state
WHERE venue_id = 'venue-1e02af4d'
ORDER BY label;

-- Show counts by status for verification
SELECT 'Counts by primary_status:' as info;
SELECT 
    primary_status,
    COUNT(*) as count
FROM table_runtime_state
WHERE venue_id = 'venue-1e02af4d'
GROUP BY primary_status
ORDER BY primary_status;

SELECT 'Counts by reservation_status:' as info;
SELECT 
    reservation_status,
    COUNT(*) as count
FROM table_runtime_state
WHERE venue_id = 'venue-1e02af4d'
GROUP BY reservation_status
ORDER BY reservation_status;
