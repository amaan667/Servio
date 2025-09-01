-- =====================================================
-- SERVIO MVP DATABASE SCHEMA
-- =====================================================
-- This file documents the expected Supabase database structure
-- for the menu upload and customer ordering system.

-- =====================================================
-- VENUES TABLE
-- =====================================================
-- Stores restaurant/venue information
CREATE TABLE IF NOT EXISTS venues (
  venue_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  logo_url TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  business_type TEXT DEFAULT 'Restaurant',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient owner-based queries
CREATE INDEX IF NOT EXISTS idx_venues_owner_id ON venues(owner_id);

-- =====================================================
-- MENU_ITEMS TABLE
-- =====================================================
-- Stores individual menu items for each venue
CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
  category TEXT,
  image_url TEXT,
    available BOOLEAN DEFAULT true,
  prep_time INTEGER, -- in minutes
  rating DECIMAL(3,2), -- 0.00 to 5.00
  allergens TEXT[], -- array of allergen strings
  dietary_info TEXT[], -- array of dietary info (vegan, gluten-free, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient venue-based queries
CREATE INDEX IF NOT EXISTS idx_menu_items_venue_id ON menu_items(venue_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(available);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category);

-- =====================================================
-- ORDERS TABLE
-- =====================================================
-- Stores customer orders
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  table_number INTEGER,
    total_amount DECIMAL(10,2) NOT NULL,
  order_status TEXT DEFAULT 'PLACED' CHECK (order_status IN ('PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'OUT_FOR_DELIVERY', 'SERVING', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'EXPIRED')),
  payment_method TEXT,
  payment_status TEXT DEFAULT 'UNPAID' CHECK (payment_status IN ('UNPAID', 'IN_PROGRESS', 'PAID', 'REFUNDED')),
  scheduled_for TIMESTAMP WITH TIME ZONE,
  prep_lead_minutes INTEGER DEFAULT 30,
  items JSONB NOT NULL, -- Array of order items with quantities and special instructions
  special_instructions TEXT,
  estimated_prep_time INTEGER, -- in minutes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for order management
CREATE INDEX IF NOT EXISTS idx_orders_venue_id ON orders(venue_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_scheduled_for ON orders(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone);

-- =====================================================
-- MENU_UPLOAD_LOGS TABLE
-- =====================================================
-- Tracks menu upload and extraction history
CREATE TABLE IF NOT EXISTS menu_upload_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  extraction_status TEXT DEFAULT 'processing' CHECK (extraction_status IN ('processing', 'success', 'failed')),
  items_extracted INTEGER DEFAULT 0,
  items_valid INTEGER DEFAULT 0,
  items_filtered INTEGER DEFAULT 0,
  ocr_text TEXT,
  chunk_errors JSONB,
  processing_time_ms INTEGER,
  error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for upload tracking
CREATE INDEX IF NOT EXISTS idx_menu_upload_logs_venue_id ON menu_upload_logs(venue_id);
CREATE INDEX IF NOT EXISTS idx_menu_upload_logs_status ON menu_upload_logs(extraction_status);
CREATE INDEX IF NOT EXISTS idx_menu_upload_logs_created_at ON menu_upload_logs(created_at);

-- =====================================================
-- USERS TABLE (for future authentication)
-- =====================================================
-- Stores user accounts for venue management
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'venue_manager' CHECK (role IN ('admin', 'venue_manager', 'staff')),
  venue_id TEXT REFERENCES venues(venue_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for user management
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_venue_id ON users(venue_id);

-- =====================================================
-- SAMPLE DATA INSERTION
-- =====================================================

-- Insert demo venue
INSERT INTO venues (venue_id, name, description) 
VALUES ('demo-cafe', 'Demo Cafe', 'A demonstration restaurant for testing the Servio MVP')
ON CONFLICT (venue_id) DO NOTHING;

-- Insert sample menu items for demo venue
INSERT INTO menu_items (venue_id, name, description, price, category, available, prep_time, rating) VALUES
('demo-cafe', 'Virgin Margarita', 'Lime, lemon & orange juice served chilled.', 3.00, 'Beverages', true, 5, 4.5),
('demo-cafe', 'Mountain Of 50 Prawns', '50 succulent medium Prawns with rice.', 47.50, 'Weekly Specials', true, 20, 4.8),
('demo-cafe', 'Coca-Cola', 'Classic Coca-Cola served chilled.', 2.50, 'Beverages', true, 2, 4.0),
('demo-cafe', 'Margherita Pizza', 'Fresh mozzarella, tomato sauce, and basil.', 12.99, 'Pizza', true, 15, 4.6),
('demo-cafe', 'Caesar Salad', 'Romaine lettuce, parmesan cheese, croutons with caesar dressing.', 8.99, 'Salads', true, 8, 4.3)
ON CONFLICT DO NOTHING;

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_upload_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Venues: Allow read access to all, write access to authenticated users
CREATE POLICY "Venues are viewable by everyone" ON venues FOR SELECT USING (true);
CREATE POLICY "Venues are insertable by authenticated users" ON venues FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Menu items: Allow read access to all, write access to venue managers
CREATE POLICY "Menu items are viewable by everyone" ON menu_items FOR SELECT USING (true);
CREATE POLICY "Menu items are insertable by venue managers" ON menu_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Menu items are updatable by venue managers" ON menu_items FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Menu items are deletable by venue managers" ON menu_items FOR DELETE USING (auth.role() = 'authenticated');

-- Orders: Allow read/write access to venue managers, read access to customers
CREATE POLICY "Orders are viewable by venue managers" ON orders FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Orders are insertable by customers" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Orders are updatable by venue managers" ON orders FOR UPDATE USING (auth.role() = 'authenticated');

-- Menu upload logs: Allow read/write access to venue managers only
CREATE POLICY "Upload logs are viewable by venue managers" ON menu_upload_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Upload logs are insertable by venue managers" ON menu_upload_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Users: Allow read/write access to admins only
CREATE POLICY "Users are viewable by admins" ON users FOR SELECT USING (auth.role() = 'authenticated' AND auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "Users are insertable by admins" ON users FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.jwt() ->> 'role' = 'admin');

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_venues_updated_at BEFORE UPDATE ON venues FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON menu_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ENVIRONMENT VARIABLES REQUIRED
-- =====================================================
/*
The following environment variables are required for the system to function:

Database (Supabase):
- NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
- NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

Google Cloud Services:
- GOOGLE_CREDENTIALS_B64=base64_encoded_service_account_json
- GCS_BUCKET_NAME=your_gcs_bucket_name

OpenAI:
- OPENAI_API_KEY=your_openai_api_key

Optional (for future enhancements):
- STRIPE_SECRET_KEY=your_stripe_secret_key
- STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
*/

-- =====================================================
-- USAGE NOTES
-- =====================================================
/*
1. VENUE MANAGEMENT:
   - Each restaurant/venue has a unique venue_id
   - Menu items are linked to venues via venue_id
   - Orders are linked to venues via venue_id

2. MENU UPLOAD FLOW:
   - PDF upload → OCR extraction → GPT-4o processing → Database storage
   - Upload logs track extraction success/failure
   - Filtered items are stored in menu_items table

3. ORDER FLOW:
   - Customer selects items → Cart management → Payment → Order submission
   - Orders stored with JSONB items array for flexibility
   - Status tracking from pending to delivered

4. SECURITY:
   - RLS policies control access based on authentication
   - Public read access for menu items
   - Authenticated write access for venue managers

5. SCALABILITY:
   - Indexes on frequently queried columns
   - JSONB for flexible order item storage
   - Timestamp tracking for audit trails
*/
