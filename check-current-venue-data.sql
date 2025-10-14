-- Check current venue details for venue-1e02af4d
SELECT 
    venue_id,
    venue_name,
    business_type,
    venue_address,
    phone,
    email,
    timezone,
    venue_type,
    service_type,
    operating_hours,
    latitude,
    longitude,
    owner_user_id,
    organization_id,
    created_at,
    updated_at
FROM venues 
WHERE venue_id = 'venue-1e02af4d';

-- Check if there are any venues at all
SELECT 
    venue_id,
    venue_name,
    business_type,
    owner_user_id,
    created_at
FROM venues 
ORDER BY created_at DESC
LIMIT 5;

-- Check what columns exist in venues table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'venues' 
ORDER BY ordinal_position;
