-- Migration: Initialize migrations tracking table
-- Created: 2025-01-01

-- This migration ensures the migrations table exists for tracking executed migrations
CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) UNIQUE NOT NULL,
  timestamp VARCHAR(14) NOT NULL,
  description TEXT,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_migrations_filename ON migrations(filename);
CREATE INDEX IF NOT EXISTS idx_migrations_timestamp ON migrations(timestamp);

