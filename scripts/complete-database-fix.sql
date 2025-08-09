-- Complete Database Schema Fix for Servio
-- This script ensures all required tables and columns exist

-- 1. Fix venues table structure
DROP TABLE IF EXISTS venues CASCADE;
CREATE TABLE venues (
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

-- 2. Fix menu_items table
DROP TABLE IF EXISTS menu_items CASCADE;
CREATE TABLE menu_items (
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

-- Indexes for menu_items
CREATE INDEX IF NOT EXISTS idx_menu_items_venue_id ON menu_items(venue_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(available);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category);

-- 3. Fix orders table
DROP TABLE IF EXISTS orders CASCADE;
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  table_number INTEGER,
  total_amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled')),
  payment_method TEXT,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  items JSONB NOT NULL, -- Array of order items with quantities and special instructions
  notes TEXT,
  estimated_prep_time INTEGER, -- in minutes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for orders
CREATE INDEX IF NOT EXISTS idx_orders_venue_id ON orders(venue_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone);

-- 4. Create order_items table for better order management
DROP TABLE IF EXISTS order_items CASCADE;
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  special_instructions TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for order_items
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON order_items(menu_item_id);

-- 5. Create menu_upload_logs table
DROP TABLE IF EXISTS menu_upload_logs CASCADE;
CREATE TABLE menu_upload_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  extraction_status TEXT DEFAULT 'processing' CHECK (extraction_status IN ('processing', 'success', 'failed')),
  items_extracted INTEGER DEFAULT 0,
  items_valid INTEGER DEFAULT 0,
  error_details TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for menu_upload_logs
CREATE INDEX IF NOT EXISTS idx_menu_upload_logs_venue_id ON menu_upload_logs(venue_id);
CREATE INDEX IF NOT EXISTS idx_menu_upload_logs_status ON menu_upload_logs(extraction_status);

-- Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Database schema has been completely reset and fixed!';
    RAISE NOTICE 'All tables created with proper structure and relationships.';
END $$;
