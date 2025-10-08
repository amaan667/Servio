-- Migration: Add new settings columns to venues table
-- Run this SQL in your Supabase SQL Editor

-- Add timezone column
ALTER TABLE venues ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/London';

-- Add venue_type column
ALTER TABLE venues ADD COLUMN IF NOT EXISTS venue_type TEXT DEFAULT 'restaurant';

-- Add service_type column  
ALTER TABLE venues ADD COLUMN IF NOT EXISTS service_type TEXT DEFAULT 'table_service';

-- Add operating_hours column (JSON format for storing hours per day)
ALTER TABLE venues ADD COLUMN IF NOT EXISTS operating_hours JSONB;

-- Add coordinates for map preview (latitude, longitude)
ALTER TABLE venues ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE venues ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Add comment to document the structure
COMMENT ON COLUMN venues.operating_hours IS 'JSON object with keys monday-sunday, each containing {open: "HH:MM", close: "HH:MM", closed: boolean}';
COMMENT ON COLUMN venues.timezone IS 'IANA timezone identifier (e.g., Europe/London, America/New_York)';
COMMENT ON COLUMN venues.venue_type IS 'Type of venue: cafe, restaurant, dessert_lounge, food_truck, bar_pub, other';
COMMENT ON COLUMN venues.service_type IS 'Type of service: table_service, counter_pickup, both';

