-- =====================================================
-- EXTENDED CATALOG SCHEMA FOR CLEAR & UPLOAD PDF
-- =====================================================
-- This script creates the extended catalog structure needed for
-- proper menu management with options, variants, and aliases

-- =====================================================
-- 1. CREATE CATEGORIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for categories
CREATE INDEX IF NOT EXISTS idx_categories_venue_id ON categories(venue_id);
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order);

-- =====================================================
-- 2. UPDATE MENU_ITEMS TABLE (add missing columns)
-- =====================================================
-- Add missing columns to existing menu_items table
ALTER TABLE menu_items 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS subtitle TEXT,
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'GBP',
ADD COLUMN IF NOT EXISTS price_cents INTEGER GENERATED ALWAYS AS (price * 100) STORED;

-- Add index for category_id
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id);

-- =====================================================
-- 3. CREATE OPTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  group_name TEXT NOT NULL, -- e.g., "Milk", "Syrup", "Size"
  is_required BOOLEAN DEFAULT false,
  max_choices INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for options
CREATE INDEX IF NOT EXISTS idx_options_venue_id ON options(venue_id);
CREATE INDEX IF NOT EXISTS idx_options_item_id ON options(item_id);
CREATE INDEX IF NOT EXISTS idx_options_group_name ON options(group_name);

-- =====================================================
-- 4. CREATE OPTION_CHOICES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS option_choices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES options(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g., "Oat Milk", "Salted Caramel"
  price_add_cents INTEGER DEFAULT 0, -- additional cost in cents
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for option_choices
CREATE INDEX IF NOT EXISTS idx_option_choices_venue_id ON option_choices(venue_id);
CREATE INDEX IF NOT EXISTS idx_option_choices_option_id ON option_choices(option_id);

-- =====================================================
-- 5. CREATE ITEM_ALIASES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS item_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  alias TEXT NOT NULL, -- alternative name for the item
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for item_aliases
CREATE INDEX IF NOT EXISTS idx_item_aliases_venue_id ON item_aliases(venue_id);
CREATE INDEX IF NOT EXISTS idx_item_aliases_item_id ON item_aliases(item_id);
CREATE INDEX IF NOT EXISTS idx_item_aliases_alias ON item_aliases(alias);

-- =====================================================
-- 6. CREATE ITEM_IMAGES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS item_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt_text TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for item_images
CREATE INDEX IF NOT EXISTS idx_item_images_venue_id ON item_images(venue_id);
CREATE INDEX IF NOT EXISTS idx_item_images_item_id ON item_images(item_id);

-- =====================================================
-- 7. ENABLE ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE options ENABLE ROW LEVEL SECURITY;
ALTER TABLE option_choices ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_images ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 8. CREATE RLS POLICIES
-- =====================================================

-- Categories policies
CREATE POLICY "Categories are viewable by everyone" ON categories FOR SELECT USING (true);
CREATE POLICY "Categories are manageable by venue owners" ON categories 
  FOR ALL USING (
    venue_id IN (
      SELECT venue_id FROM venues WHERE owner_id = auth.uid()
    )
  );

-- Options policies
CREATE POLICY "Options are viewable by everyone" ON options FOR SELECT USING (true);
CREATE POLICY "Options are manageable by venue owners" ON options 
  FOR ALL USING (
    venue_id IN (
      SELECT venue_id FROM venues WHERE owner_id = auth.uid()
    )
  );

-- Option choices policies
CREATE POLICY "Option choices are viewable by everyone" ON option_choices FOR SELECT USING (true);
CREATE POLICY "Option choices are manageable by venue owners" ON option_choices 
  FOR ALL USING (
    venue_id IN (
      SELECT venue_id FROM venues WHERE owner_id = auth.uid()
    )
  );

-- Item aliases policies
CREATE POLICY "Item aliases are viewable by everyone" ON item_aliases FOR SELECT USING (true);
CREATE POLICY "Item aliases are manageable by venue owners" ON item_aliases 
  FOR ALL USING (
    venue_id IN (
      SELECT venue_id FROM venues WHERE owner_id = auth.uid()
    )
  );

-- Item images policies
CREATE POLICY "Item images are viewable by everyone" ON item_images FOR SELECT USING (true);
CREATE POLICY "Item images are manageable by venue owners" ON item_images 
  FOR ALL USING (
    venue_id IN (
      SELECT venue_id FROM venues WHERE owner_id = auth.uid()
    )
  );

-- =====================================================
-- 9. CREATE TRIGGERS FOR UPDATED_AT
-- =====================================================
CREATE TRIGGER update_categories_updated_at 
  BEFORE UPDATE ON categories 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_options_updated_at 
  BEFORE UPDATE ON options 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_option_choices_updated_at 
  BEFORE UPDATE ON option_choices 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 10. CREATE UNIQUE CONSTRAINTS
-- =====================================================
-- Prevent duplicate category names per venue
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_venue_name_unique 
  ON categories(venue_id, LOWER(name));

-- Prevent duplicate aliases per item
CREATE UNIQUE INDEX IF NOT EXISTS idx_item_aliases_item_alias_unique 
  ON item_aliases(item_id, LOWER(alias));

-- =====================================================
-- 11. MIGRATION: POPULATE CATEGORIES FROM EXISTING DATA
-- =====================================================
-- Create categories from existing menu_items categories
INSERT INTO categories (venue_id, name, sort_order)
SELECT DISTINCT 
  venue_id, 
  COALESCE(category, 'Uncategorized') as name,
  ROW_NUMBER() OVER (PARTITION BY venue_id ORDER BY category) as sort_order
FROM menu_items 
WHERE category IS NOT NULL
ON CONFLICT (venue_id, LOWER(name)) DO NOTHING;

-- Update menu_items to reference categories
UPDATE menu_items 
SET category_id = c.id
FROM categories c
WHERE menu_items.venue_id = c.venue_id 
  AND COALESCE(menu_items.category, 'Uncategorized') = c.name;

-- =====================================================
-- 12. VALIDATION QUERIES
-- =====================================================
-- Verify the schema is set up correctly
DO $$
BEGIN
  -- Check that all tables exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'categories') THEN
    RAISE EXCEPTION 'Categories table not created';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'options') THEN
    RAISE EXCEPTION 'Options table not created';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'option_choices') THEN
    RAISE EXCEPTION 'Option choices table not created';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'item_aliases') THEN
    RAISE EXCEPTION 'Item aliases table not created';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'item_images') THEN
    RAISE EXCEPTION 'Item images table not created';
  END IF;
  
  RAISE NOTICE 'All catalog tables created successfully';
END $$;
