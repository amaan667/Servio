-- Add missing menu_cache table
CREATE TABLE IF NOT EXISTS menu_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hash VARCHAR(255) UNIQUE NOT NULL,
    items JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for menu_cache
CREATE INDEX IF NOT EXISTS idx_menu_cache_hash ON menu_cache(hash);

-- Enable RLS for menu_cache
ALTER TABLE menu_cache ENABLE ROW LEVEL SECURITY;

-- Add service role policies for all tables
CREATE POLICY IF NOT EXISTS "Service role can manage venues" ON venues FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY IF NOT EXISTS "Service role can manage menu items" ON menu_items FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY IF NOT EXISTS "Service role can manage orders" ON orders FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY IF NOT EXISTS "Service role can manage order items" ON order_items FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY IF NOT EXISTS "Service role can manage menu cache" ON menu_cache FOR ALL USING (auth.role() = 'service_role');

-- Add general policies for menu_cache
CREATE POLICY IF NOT EXISTS "Anyone can view menu cache" ON menu_cache FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Anyone can insert into menu cache" ON menu_cache FOR INSERT WITH CHECK (true);

-- Create trigger for menu_cache updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER IF NOT EXISTS update_menu_cache_updated_at 
    BEFORE UPDATE ON menu_cache 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column(); 