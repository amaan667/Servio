-- Create trigger to automatically provision new users
-- This trigger will call provision_first_login when a new user is created

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS trigger_provision_new_user ON auth.users;

-- Create the trigger
CREATE TRIGGER trigger_provision_new_user
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.provision_first_login(NEW.id);

-- Also create a trigger to create a profile for new users
DROP TRIGGER IF EXISTS trigger_create_profile ON auth.users;

CREATE OR REPLACE FUNCTION public.create_profile_for_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'User'),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_create_profile
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.create_profile_for_user();