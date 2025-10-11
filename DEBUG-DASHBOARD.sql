-- DEBUG: Check why dashboard redirects to complete-profile
-- Run this to see what's happening

SELECT 
  'USER CHECK' as section,
  u.id as user_id,
  u.email,
  u.created_at as user_created
FROM auth.users u
WHERE u.email = 'amaantanveer667@gmail.com';

SELECT 
  'VENUE ACCESS CHECK' as section,
  uvr.venue_id,
  uvr.role,
  uvr.created_at as access_created,
  u.email
FROM user_venue_roles uvr
JOIN auth.users u ON u.id = uvr.user_id
WHERE u.email = 'amaantanveer667@gmail.com';

SELECT 
  'VENUE DETAILS CHECK' as section,
  v.venue_id,
  v.name,
  v.owner_id,
  v.created_at
FROM venues v
WHERE v.venue_id = 'venue-1e02af4d';
