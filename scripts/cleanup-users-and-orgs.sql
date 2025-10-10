-- Cleanup Users and Implement Organization Logic
-- This script removes all users except amaantanveer667@gmail.com and sets up proper organization

-- First, let's see what we're working with
SELECT 'Current users:' as info;
SELECT id, email, created_at FROM auth.users ORDER BY created_at;

SELECT 'Current organizations:' as info;
SELECT id, name, owner_id, subscription_tier, subscription_status FROM organizations;

SELECT 'Current venues:' as info;
SELECT venue_id, name, owner_id, organization_id FROM venues;

-- Step 1: Find the user we want to keep
SELECT 'Target user:' as info;
SELECT id, email FROM auth.users WHERE email = 'amaantanveer667@gmail.com';

-- Step 2: Clean up related data for users we're removing
-- Delete orders from other users
DELETE FROM orders WHERE venue_id IN (
  SELECT venue_id FROM venues WHERE owner_id NOT IN (
    SELECT id FROM auth.users WHERE email = 'amaantanveer667@gmail.com'
  )
);

-- Delete menu items from other users
DELETE FROM menu_items WHERE venue_id IN (
  SELECT venue_id FROM venues WHERE owner_id NOT IN (
    SELECT id FROM auth.users WHERE email = 'amaantanveer667@gmail.com'
  )
);

-- Delete tables from other users
DELETE FROM tables WHERE venue_id IN (
  SELECT venue_id FROM venues WHERE owner_id NOT IN (
    SELECT id FROM auth.users WHERE email = 'amaantanveer667@gmail.com'
  )
);

-- Delete user venue roles from other users
DELETE FROM user_venue_roles WHERE user_id NOT IN (
  SELECT id FROM auth.users WHERE email = 'amaantanveer667@gmail.com'
);

-- Delete venues from other users
DELETE FROM venues WHERE owner_id NOT IN (
  SELECT id FROM auth.users WHERE email = 'amaantanveer667@gmail.com'
);

-- Delete organizations from other users
DELETE FROM organizations WHERE owner_id NOT IN (
  SELECT id FROM auth.users WHERE email = 'amaantanveer667@gmail.com'
);

-- Step 3: Delete other users from auth.users
DELETE FROM auth.users WHERE email != 'amaantanveer667@gmail.com';

-- Step 4: Set up proper organization for the remaining user
-- First, get the remaining user's ID
DO $$
DECLARE
    target_user_id UUID;
    existing_org_id UUID;
BEGIN
    -- Get the target user ID
    SELECT id INTO target_user_id FROM auth.users WHERE email = 'amaantanveer667@gmail.com';
    
    -- Check if organization already exists
    SELECT id INTO existing_org_id FROM organizations WHERE owner_id = target_user_id;
    
    IF existing_org_id IS NULL THEN
        -- Create organization for the user
        INSERT INTO organizations (
            id,
            name,
            slug,
            owner_id,
            subscription_tier,
            subscription_status,
            is_grandfathered,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            'Servio Demo Organization',
            'servio-demo-org',
            target_user_id,
            'basic',
            'active',
            false,
            NOW(),
            NOW()
        );
        
        RAISE NOTICE 'Created new organization for user %', target_user_id;
    ELSE
        RAISE NOTICE 'Organization already exists: %', existing_org_id;
    END IF;
END $$;

-- Step 5: Update venues to reference the organization
UPDATE venues SET organization_id = (
    SELECT id FROM organizations WHERE owner_id = (
        SELECT id FROM auth.users WHERE email = 'amaantanveer667@gmail.com'
    )
) WHERE owner_id = (
    SELECT id FROM auth.users WHERE email = 'amaantanveer667@gmail.com'
);

-- Step 6: Create user venue roles for the remaining user
INSERT INTO user_venue_roles (user_id, venue_id, organization_id, role, permissions)
SELECT 
    u.id as user_id,
    v.venue_id,
    o.id as organization_id,
    'owner' as role,
    '{"all": true}'::jsonb as permissions
FROM auth.users u
CROSS JOIN venues v
CROSS JOIN organizations o
WHERE u.email = 'amaantanveer667@gmail.com'
AND v.owner_id = u.id
AND o.owner_id = u.id
ON CONFLICT (user_id, venue_id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    role = 'owner';

-- Final verification
SELECT 'Final state:' as info;
SELECT 'Users:' as type, COUNT(*) as count FROM auth.users
UNION ALL
SELECT 'Organizations:' as type, COUNT(*) as count FROM organizations
UNION ALL
SELECT 'Venues:' as type, COUNT(*) as count FROM venues
UNION ALL
SELECT 'User Venue Roles:' as type, COUNT(*) as count FROM user_venue_roles;

SELECT 'Remaining user details:' as info;
SELECT u.email, o.name as org_name, o.subscription_tier, o.subscription_status
FROM auth.users u
LEFT JOIN organizations o ON o.owner_id = u.id
WHERE u.email = 'amaantanveer667@gmail.com';
