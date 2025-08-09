-- Create profiles table with RLS
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

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "profiles self access"
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "profiles self upsert"
    ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles self update"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id);

-- Create function to handle first-time login provisioning
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

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
