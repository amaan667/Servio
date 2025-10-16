-- Fix the auto_assign_venue_owner trigger to use correct column name
-- The trigger was using OLD.owner_id but the column is actually owner_user_id

-- Drop the old trigger and function
DROP TRIGGER IF EXISTS auto_assign_venue_owner_trigger ON venues;
DROP FUNCTION IF EXISTS auto_assign_venue_owner();

-- Create the corrected function
CREATE OR REPLACE FUNCTION auto_assign_venue_owner()
RETURNS TRIGGER AS $$
BEGIN
  -- Automatically create a user_venue_role entry for the venue owner
  INSERT INTO user_venue_roles (user_id, venue_id, role, created_at)
  VALUES (NEW.owner_user_id, NEW.venue_id, 'owner', NOW())
  ON CONFLICT (venue_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER auto_assign_venue_owner_trigger
AFTER INSERT ON venues
FOR EACH ROW
EXECUTE FUNCTION auto_assign_venue_owner();

-- Verify the trigger was created
SELECT 'Trigger fixed successfully!' as result;
SELECT trigger_name, event_manipulation, event_object_table 
FROM information_schema.triggers 
WHERE trigger_name = 'auto_assign_venue_owner_trigger';
