-- ============================================================================
-- MIGRATE COLUMN NAMES TO MATCH CODE
-- ============================================================================
-- This script renames old column names to new ones
-- Safe to run multiple times - checks before renaming
-- ============================================================================

-- ============================================================================
-- 1. VENUES TABLE: owner_id → owner_user_id
-- ============================================================================

DO $$
BEGIN
  -- Check if owner_id exists and owner_user_id doesn't
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'venues' AND column_name = 'owner_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'venues' AND column_name = 'owner_user_id'
  ) THEN
    -- Rename owner_id to owner_user_id
    ALTER TABLE venues RENAME COLUMN owner_id TO owner_user_id;
    RAISE NOTICE '✓ Renamed venues.owner_id to owner_user_id';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'venues' AND column_name = 'owner_user_id'
  ) THEN
    RAISE NOTICE '✓ venues.owner_user_id already exists';
  ELSE
    -- Neither exists, add owner_user_id
    ALTER TABLE venues ADD COLUMN owner_user_id UUID REFERENCES auth.users(id);
    RAISE NOTICE '✓ Added venues.owner_user_id column';
  END IF;
END $$;

-- ============================================================================
-- 2. VENUES TABLE: name → venue_name
-- ============================================================================

DO $$
BEGIN
  -- Check if name exists and venue_name doesn't
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'venues' AND column_name = 'name'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'venues' AND column_name = 'venue_name'
  ) THEN
    -- Rename name to venue_name
    ALTER TABLE venues RENAME COLUMN name TO venue_name;
    RAISE NOTICE '✓ Renamed venues.name to venue_name';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'venues' AND column_name = 'venue_name'
  ) THEN
    RAISE NOTICE '✓ venues.venue_name already exists';
  ELSE
    -- Neither exists, add venue_name
    ALTER TABLE venues ADD COLUMN venue_name TEXT NOT NULL DEFAULT 'My Venue';
    RAISE NOTICE '✓ Added venues.venue_name column';
  END IF;
END $$;

-- ============================================================================
-- 3. MENU_ITEMS TABLE: available → is_available
-- ============================================================================

DO $$
BEGIN
  -- Check if available exists and is_available doesn't
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'menu_items' AND column_name = 'available'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'menu_items' AND column_name = 'is_available'
  ) THEN
    -- Rename available to is_available
    ALTER TABLE menu_items RENAME COLUMN available TO is_available;
    RAISE NOTICE '✓ Renamed menu_items.available to is_available';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'menu_items' AND column_name = 'is_available'
  ) THEN
    RAISE NOTICE '✓ menu_items.is_available already exists';
  ELSE
    -- Neither exists, add is_available
    ALTER TABLE menu_items ADD COLUMN is_available BOOLEAN DEFAULT true;
    RAISE NOTICE '✓ Added menu_items.is_available column';
  END IF;
END $$;

-- ============================================================================
-- 4. ORGANIZATIONS TABLE: owner_id → created_by (if applicable)
-- ============================================================================

DO $$
BEGIN
  -- Check if organizations table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations') THEN
    -- Organizations might use created_by instead, check current state
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'organizations' AND column_name = 'owner_id'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'organizations' AND column_name = 'created_by'
    ) THEN
      -- Has owner_id but not created_by, rename it
      ALTER TABLE organizations RENAME COLUMN owner_id TO created_by;
      RAISE NOTICE '✓ Renamed organizations.owner_id to created_by';
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'organizations' AND column_name = 'created_by'
    ) THEN
      RAISE NOTICE '✓ organizations.created_by already exists';
    END IF;
  ELSE
    RAISE NOTICE 'ℹ organizations table does not exist';
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  venues_owner_user_id BOOLEAN;
  venues_venue_name BOOLEAN;
  menu_items_is_available BOOLEAN;
BEGIN
  -- Check if all columns exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'venues' AND column_name = 'owner_user_id'
  ) INTO venues_owner_user_id;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'venues' AND column_name = 'venue_name'
  ) INTO venues_venue_name;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'menu_items' AND column_name = 'is_available'
  ) INTO menu_items_is_available;
  
  RAISE NOTICE '';
  RAISE NOTICE '=== MIGRATION VERIFICATION ===';
  RAISE NOTICE 'venues.owner_user_id: %', CASE WHEN venues_owner_user_id THEN '✓ EXISTS' ELSE '✗ MISSING' END;
  RAISE NOTICE 'venues.venue_name: %', CASE WHEN venues_venue_name THEN '✓ EXISTS' ELSE '✗ MISSING' END;
  RAISE NOTICE 'menu_items.is_available: %', CASE WHEN menu_items_is_available THEN '✓ EXISTS' ELSE '✗ MISSING' END;
  RAISE NOTICE '';
  
  IF venues_owner_user_id AND venues_venue_name AND menu_items_is_available THEN
    RAISE NOTICE '✓ All column migrations completed successfully!';
    RAISE NOTICE 'You can now run fix-rls-policies.sql';
  ELSE
    RAISE NOTICE '✗ Some columns are still missing - check errors above';
  END IF;
END $$;

