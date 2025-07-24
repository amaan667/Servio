-- Drop existing tables if they exist
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS venues CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS menu_cache CASCADE;

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create venues table
CREATE TABLE venues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    business_type VARCHAR(100) NOT NULL DEFAULT 'Restaurant',
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create menu_items table
CREATE TABLE menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id VARCHAR(100) NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    category VARCHAR(100) NOT NULL,
    available BOOLEAN DEFAULT true,
    position INTEGER,
    category_position INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create orders table
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number SERIAL UNIQUE NOT NULL,
    venue_id VARCHAR(100) NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
    table_number INTEGER NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending',
    total_amount DECIMAL(10,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create order_items table
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create menu_cache table for persistent caching
CREATE TABLE menu_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hash VARCHAR(255) UNIQUE NOT NULL,
    items JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_venues_venue_id ON venues(venue_id);
CREATE INDEX idx_venues_owner_id ON venues(owner_id);
CREATE INDEX idx_menu_items_venue_id ON menu_items(venue_id);
CREATE INDEX idx_menu_items_category ON menu_items(category);
CREATE INDEX idx_orders_venue_id ON orders(venue_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_menu_cache_hash ON menu_cache(hash);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for venues
CREATE POLICY "Venue owners can manage their venues" ON venues FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Anyone can view venues" ON venues FOR SELECT USING (true);
CREATE POLICY "Service role can manage venues" ON venues FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for menu_items
CREATE POLICY "Venue owners can manage menu items" ON menu_items FOR ALL USING (
    EXISTS (SELECT 1 FROM venues WHERE venues.venue_id = menu_items.venue_id AND venues.owner_id = auth.uid())
);
CREATE POLICY "Anyone can view available menu items" ON menu_items FOR SELECT USING (available = true);
CREATE POLICY "Service role can manage menu items" ON menu_items FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for orders
CREATE POLICY "Venue owners can view their orders" ON orders FOR SELECT USING (
    EXISTS (SELECT 1 FROM venues WHERE venues.venue_id = orders.venue_id AND venues.owner_id = auth.uid())
);
CREATE POLICY "Anyone can create orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Venue owners can update their orders" ON orders FOR UPDATE USING (
    EXISTS (SELECT 1 FROM venues WHERE venues.venue_id = orders.venue_id AND venues.owner_id = auth.uid())
);
CREATE POLICY "Service role can manage orders" ON orders FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for order_items
CREATE POLICY "Venue owners can view order items" ON order_items FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM orders 
        JOIN venues ON venues.venue_id = orders.venue_id 
        WHERE orders.id = order_items.order_id AND venues.owner_id = auth.uid()
    )
);
CREATE POLICY "Anyone can create order items" ON order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can manage order items" ON order_items FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for menu_cache
CREATE POLICY "Anyone can view menu cache" ON menu_cache FOR SELECT USING (true);
CREATE POLICY "Anyone can insert into menu cache" ON menu_cache FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can manage menu cache" ON menu_cache FOR ALL USING (auth.role() = 'service_role');

-- Insert demo data
INSERT INTO users (id, email, password_hash, full_name) VALUES 
('550e8400-e29b-41d4-a716-446655440000', 'demo@servio.com', '$2b$10$dummy.hash.for.demo.purposes.only', 'Demo User');

INSERT INTO venues (id, venue_id, name, business_type, owner_id, address, phone, email) VALUES 
('550e8400-e29b-41d4-a716-446655440001', 'demo-cafe', 'The Corner Bistro', 'Bistro', '550e8400-e29b-41d4-a716-446655440000', '123 Main Street, City', '+1-555-0123', 'hello@cornerbistro.com'),
('550e8400-e29b-41d4-a716-446655440002', 'pizza-palace', 'Pizza Palace', 'Pizzeria', '550e8400-e29b-41d4-a716-446655440000', '456 Oak Avenue, City', '+1-555-0456', 'orders@pizzapalace.com');

INSERT INTO menu_items (id, venue_id, name, description, price, category, available) VALUES 
-- Demo Cafe Menu
('550e8400-e29b-41d4-a716-446655440010', 'demo-cafe', 'Classic Burger', 'Beef patty with lettuce, tomato, and our special sauce', 12.99, 'Mains', true),
('550e8400-e29b-41d4-a716-446655440011', 'demo-cafe', 'Caesar Salad', 'Fresh romaine lettuce with parmesan and croutons', 9.99, 'Salads', true),
('550e8400-e29b-41d4-a716-446655440012', 'demo-cafe', 'Fish & Chips', 'Beer-battered cod with crispy fries', 14.99, 'Mains', true),
('550e8400-e29b-41d4-a716-446655440013', 'demo-cafe', 'Cappuccino', 'Rich espresso with steamed milk foam', 4.50, 'Beverages', true),
('550e8400-e29b-41d4-a716-446655440014', 'demo-cafe', 'Chocolate Cake', 'Decadent chocolate layer cake', 6.99, 'Desserts', true),

-- Pizza Palace Menu
('550e8400-e29b-41d4-a716-446655440020', 'pizza-palace', 'Margherita Pizza', 'Fresh mozzarella, tomato sauce, and basil', 16.99, 'Pizzas', true),
('550e8400-e29b-41d4-a716-446655440021', 'pizza-palace', 'Pepperoni Pizza', 'Classic pepperoni with mozzarella cheese', 18.99, 'Pizzas', true),
('550e8400-e29b-41d4-a716-446655440022', 'pizza-palace', 'Garlic Bread', 'Crispy bread with garlic butter and herbs', 7.99, 'Appetizers', true),
('550e8400-e29b-41d4-a716-446655440023', 'pizza-palace', 'Italian Soda', 'Refreshing flavored soda', 3.99, 'Beverages', true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_venues_updated_at BEFORE UPDATE ON venues FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON menu_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_menu_cache_updated_at BEFORE UPDATE ON menu_cache FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
