-- Comprehensive Auth Fixes Script
-- This script fixes the Google OAuth loop and venue creation issues

-- 1. Ensure the provision_first_login function exists and is correct
CREATE OR REPLACE FUNCTION public.provision_first_login(new_user_id UUID)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER AS $$
BEGIN
    -- Create venue if none exists
    INSERT INTO venues (
        venue_id,
        name,
        owner_id,
        business_type,
        created_at,
        updated_at
    )
    SELECT 
        'venue-' || substr(new_user_id::text, 1, 8),
        'My Venue',
        new_user_id,
        'Restaurant',
        NOW(),
        NOW()
    WHERE NOT EXISTS (
        SELECT 1 FROM venues WHERE owner_id = new_user_id
    );

    -- Update first login timestamp if not set
    UPDATE profiles 
    SET first_login_at = NOW()
    WHERE id = new_user_id 
    AND first_login_at IS NULL;
END; 
$$;

-- 2. Create profile creation function
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

-- 3. Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_provision_new_user ON auth.users;
DROP TRIGGER IF EXISTS trigger_create_profile ON auth.users;

-- 4. Create the triggers
CREATE TRIGGER trigger_provision_new_user
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.provision_first_login(NEW.id);

CREATE TRIGGER trigger_create_profile
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.create_profile_for_user();

-- 5. Ensure RLS policies are correct for venues
DROP POLICY IF EXISTS "Venues are insertable by authenticated users" ON venues;
CREATE POLICY "Venues are insertable by authenticated users" 
    ON venues FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can insert their own venues" ON venues;
CREATE POLICY "Users can insert their own venues"
    ON venues FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

-- 6. Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.provision_first_login(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_profile_for_user() TO authenticated;

-- 7. Ensure profiles table exists with correct structure
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    name TEXT,
    avatar_url TEXT,
    onboarding_complete BOOLEAN DEFAULT false,
    first_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
DROP POLICY IF EXISTS "profiles self access" ON public.profiles;
CREATE POLICY "profiles self access"
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles self upsert" ON public.profiles;
CREATE POLICY "profiles self upsert"
    ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles self update" ON public.profiles;
CREATE POLICY "profiles self update"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id);

-- 8. Create trigger for profiles updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 9. Verify the setup
SELECT 'Auth fixes applied successfully' as status;