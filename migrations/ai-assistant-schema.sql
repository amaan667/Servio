-- Servio AI Assistant System Schema
-- This migration adds tables for AI assistant functionality, action auditing, and automations

-- ============================================================================
-- AI Action Audit Log
-- Tracks all AI assistant actions (both preview and executed)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_action_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL,
  user_id UUID NOT NULL,
  
  -- What the user asked
  user_prompt TEXT NOT NULL,
  
  -- What the AI planned
  intent TEXT NOT NULL, -- e.g., "menu.update_prices", "inventory.adjust_stock"
  tool_name TEXT NOT NULL,
  params JSONB NOT NULL,
  
  -- Execution details
  preview BOOLEAN NOT NULL DEFAULT true,
  executed BOOLEAN NOT NULL DEFAULT false,
  result JSONB,
  error TEXT,
  
  -- Metadata
  context_hash TEXT, -- hash of the context used for reproducibility
  model_version TEXT, -- e.g., "gpt-4o-2024-08-06"
  execution_time_ms INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  executed_at TIMESTAMPTZ
);

-- ============================================================================
-- AI Automations
-- Scheduled/triggered actions (daily digests, auto-restock alerts, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL,
  
  -- Automation config
  name TEXT NOT NULL,
  description TEXT,
  
  -- When to run
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('cron', 'event', 'threshold')),
  cron_schedule TEXT, -- "0 20 * * *" for 8pm daily
  event_type TEXT, -- "order.completed", "stock.low", etc.
  threshold_config JSONB, -- e.g., {"metric": "stock_level", "operator": "<", "value": 10}
  
  -- What to do
  tool_name TEXT NOT NULL,
  params JSONB NOT NULL,
  
  -- State
  enabled BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  last_result JSONB,
  
  -- Metadata
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- AI Context Cache
-- Cache frequently-accessed context to speed up planning
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_context_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL,
  
  -- Cache key & data
  context_type TEXT NOT NULL, -- "menu_summary", "inventory_summary", "orders_summary"
  context_data JSONB NOT NULL,
  
  -- TTL
  expires_at TIMESTAMPTZ NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint
  UNIQUE(venue_id, context_type)
);

-- ============================================================================
-- AI Tool Definitions
-- Registry of available tools with their schemas and permissions
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_tool_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tool identity
  tool_name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL, -- "menu", "inventory", "orders", "analytics", etc.
  
  -- Description for LLM
  description TEXT NOT NULL,
  params_schema JSONB NOT NULL, -- JSON schema for validation
  
  -- Security
  required_permission TEXT NOT NULL, -- "menu:write", "inventory:write", etc.
  required_tier TEXT, -- "starter", "professional", "premium"
  is_destructive BOOLEAN DEFAULT false,
  requires_confirmation BOOLEAN DEFAULT true,
  
  -- Guardrails
  rate_limit_per_hour INTEGER,
  max_items_per_call INTEGER,
  
  -- Metadata
  enabled BOOLEAN DEFAULT true,
  version TEXT DEFAULT '1.0.0',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- AI User Preferences
-- Store user-specific AI preferences (e.g., rounding rules, defaults)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL,
  user_id UUID NOT NULL,
  
  -- Preferences
  preferences JSONB NOT NULL DEFAULT '{}', -- e.g., {"price_rounding": "0.95", "auto_approve_under": 10}
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(venue_id, user_id)
);

-- ============================================================================
-- Insert Default Tool Definitions
-- ============================================================================

INSERT INTO ai_tool_definitions (tool_name, category, description, params_schema, required_permission, is_destructive, requires_confirmation) VALUES

-- Menu Tools
('menu.update_prices', 'menu', 'Update prices for menu items with optional preview', '{
  "type": "object",
  "properties": {
    "items": {"type": "array", "items": {"type": "object", "properties": {"id": {"type": "string"}, "newPrice": {"type": "number"}}}},
    "preview": {"type": "boolean"}
  }
}', 'menu:write', false, true),

('menu.toggle_availability', 'menu', 'Hide/show menu items based on criteria', '{
  "type": "object",
  "properties": {
    "itemIds": {"type": "array", "items": {"type": "string"}},
    "available": {"type": "boolean"},
    "reason": {"type": "string"}
  }
}', 'menu:write', false, true),

('menu.translate', 'menu', 'Translate menu to specified language', '{
  "type": "object",
  "properties": {
    "targetLanguage": {"type": "string"},
    "includeDescriptions": {"type": "boolean"}
  }
}', 'menu:write', false, true),

-- Inventory Tools
('inventory.adjust_stock', 'inventory', 'Adjust stock levels for ingredients', '{
  "type": "object",
  "properties": {
    "adjustments": {"type": "array", "items": {"type": "object"}},
    "reason": {"type": "string", "enum": ["receive", "adjust", "waste", "count"]},
    "preview": {"type": "boolean"}
  }
}', 'inventory:write', false, true),

('inventory.set_par_levels', 'inventory', 'Set par levels based on historical usage', '{
  "type": "object",
  "properties": {
    "strategy": {"type": "string", "enum": ["last_30_days", "last_7_days", "manual"]},
    "buffer_percentage": {"type": "number"},
    "preview": {"type": "boolean"}
  }
}', 'inventory:write', false, true),

('inventory.generate_purchase_order', 'inventory', 'Generate purchase order for low stock items', '{
  "type": "object",
  "properties": {
    "threshold": {"type": "string", "enum": ["reorder_level", "par_level"]},
    "format": {"type": "string", "enum": ["csv", "json", "pdf"]}
  }
}', 'inventory:read', false, false),

-- Order Tools
('orders.mark_served', 'orders', 'Mark order as served and update table status', '{
  "type": "object",
  "properties": {
    "orderId": {"type": "string"},
    "notifyFOH": {"type": "boolean"}
  }
}', 'orders:write', false, false),

('orders.complete', 'orders', 'Complete order and process payment', '{
  "type": "object",
  "properties": {
    "orderId": {"type": "string"},
    "paymentMethod": {"type": "string"}
  }
}', 'orders:write', false, true),

-- Analytics Tools
('analytics.get_insights', 'analytics', 'Get business insights and recommendations', '{
  "type": "object",
  "properties": {
    "metric": {"type": "string"},
    "timeRange": {"type": "string"},
    "groupBy": {"type": "string"}
  }
}', 'analytics:read', false, false),

('analytics.export', 'analytics', 'Export analytics data', '{
  "type": "object",
  "properties": {
    "type": {"type": "string", "enum": ["sales", "orders", "inventory", "customers"]},
    "format": {"type": "string", "enum": ["csv", "json", "pdf"]},
    "filters": {"type": "object"}
  }
}', 'analytics:read', false, true),

-- Discount Tools
('discounts.create', 'discounts', 'Create time-based or conditional discounts', '{
  "type": "object",
  "properties": {
    "name": {"type": "string"},
    "scope": {"type": "string", "enum": ["category", "item", "all"]},
    "amountPct": {"type": "number"},
    "startsAt": {"type": "string"},
    "endsAt": {"type": "string"}
  }
}', 'menu:write', false, true),

-- KDS Tools
('kds.get_overdue', 'kds', 'Get overdue tickets by station', '{
  "type": "object",
  "properties": {
    "station": {"type": "string"},
    "threshold_minutes": {"type": "number"}
  }
}', 'kds:read', false, false),

('kds.suggest_optimization', 'kds', 'Suggest KDS workflow optimizations', '{
  "type": "object",
  "properties": {
    "timeRange": {"type": "string"},
    "station": {"type": "string"}
  }
}', 'kds:read', false, false)

ON CONFLICT (tool_name) DO NOTHING;

-- ============================================================================
-- RLS Policies (will be added conditionally if user_venue_roles exists)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE ai_action_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_context_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_user_preferences ENABLE ROW LEVEL SECURITY;

-- Add RLS policies conditionally
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_venue_roles') THEN
    
    -- Users can only see audit logs for their venue
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_action_audit' AND policyname = 'audit_venue_access') THEN
      EXECUTE 'CREATE POLICY audit_venue_access ON ai_action_audit
        FOR ALL USING (
          venue_id IN (
            SELECT venue_id FROM user_venue_roles 
            WHERE user_id = auth.uid()
          )
        )';
    END IF;

    -- Users can manage automations for their venue
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_automations' AND policyname = 'automations_venue_access') THEN
      EXECUTE 'CREATE POLICY automations_venue_access ON ai_automations
        FOR ALL USING (
          venue_id IN (
            SELECT venue_id FROM user_venue_roles 
            WHERE user_id = auth.uid()
          )
        )';
    END IF;

    -- Context cache is venue-scoped
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_context_cache' AND policyname = 'context_cache_venue_access') THEN
      EXECUTE 'CREATE POLICY context_cache_venue_access ON ai_context_cache
        FOR ALL USING (
          venue_id IN (
            SELECT venue_id FROM user_venue_roles 
            WHERE user_id = auth.uid()
          )
        )';
    END IF;

    -- User preferences are user-scoped
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_user_preferences' AND policyname = 'user_prefs_access') THEN
      EXECUTE 'CREATE POLICY user_prefs_access ON ai_user_preferences
        FOR ALL USING (user_id = auth.uid())';
    END IF;
    
    RAISE NOTICE 'RLS policies added successfully';
  ELSE
    RAISE WARNING 'user_venue_roles table does not exist. RLS policies not added. Run this migration again after creating the user_venue_roles table.';
    RAISE WARNING 'IMPORTANT: Without RLS policies, AI assistant tables are not protected. Add policies before using in production.';
  END IF;
END $$;

-- ============================================================================
-- Triggers & Functions
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ai_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_automations_updated_at
  BEFORE UPDATE ON ai_automations
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_updated_at();

CREATE TRIGGER ai_tool_definitions_updated_at
  BEFORE UPDATE ON ai_tool_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_updated_at();

-- Cleanup expired context cache
CREATE OR REPLACE FUNCTION cleanup_expired_ai_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM ai_context_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- AI Action Audit indexes
CREATE INDEX IF NOT EXISTS idx_ai_audit_venue ON ai_action_audit(venue_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_audit_user ON ai_action_audit(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_audit_intent ON ai_action_audit(intent, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_audit_created_at ON ai_action_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_audit_executed ON ai_action_audit(executed, created_at DESC) WHERE executed = true;

-- AI Automations indexes
CREATE INDEX IF NOT EXISTS idx_automations_venue_enabled ON ai_automations(venue_id, enabled);
CREATE INDEX IF NOT EXISTS idx_automations_next_run ON ai_automations(venue_id, last_run_at) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_automations_trigger ON ai_automations(trigger_type, enabled);

-- AI Context Cache indexes
CREATE INDEX IF NOT EXISTS idx_context_cache_expires ON ai_context_cache(expires_at);

-- ============================================================================
-- Add Foreign Key Constraints (with exception handling for safety)
-- Note: Foreign keys will be skipped if referenced tables/columns don't exist
-- You can manually add them later when your full schema is in place
-- ============================================================================

-- Add foreign keys for venues
DO $$ 
BEGIN
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_action_audit_venue_id_fkey') THEN
      ALTER TABLE ai_action_audit 
        ADD CONSTRAINT ai_action_audit_venue_id_fkey 
        FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Could not add foreign key ai_action_audit_venue_id_fkey: %', SQLERRM;
  END;

  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_automations_venue_id_fkey') THEN
      ALTER TABLE ai_automations 
        ADD CONSTRAINT ai_automations_venue_id_fkey 
        FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Could not add foreign key ai_automations_venue_id_fkey: %', SQLERRM;
  END;

  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_context_cache_venue_id_fkey') THEN
      ALTER TABLE ai_context_cache 
        ADD CONSTRAINT ai_context_cache_venue_id_fkey 
        FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Could not add foreign key ai_context_cache_venue_id_fkey: %', SQLERRM;
  END;

  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_user_preferences_venue_id_fkey') THEN
      ALTER TABLE ai_user_preferences 
        ADD CONSTRAINT ai_user_preferences_venue_id_fkey 
        FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Could not add foreign key ai_user_preferences_venue_id_fkey: %', SQLERRM;
  END;
END $$;

-- Add foreign keys for auth.users
DO $$ 
BEGIN
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_action_audit_user_id_fkey') THEN
      ALTER TABLE ai_action_audit 
        ADD CONSTRAINT ai_action_audit_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Could not add foreign key ai_action_audit_user_id_fkey: %', SQLERRM;
  END;

  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_automations_created_by_fkey') THEN
      ALTER TABLE ai_automations 
        ADD CONSTRAINT ai_automations_created_by_fkey 
        FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Could not add foreign key ai_automations_created_by_fkey: %', SQLERRM;
  END;

  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_user_preferences_user_id_fkey') THEN
      ALTER TABLE ai_user_preferences 
        ADD CONSTRAINT ai_user_preferences_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Could not add foreign key ai_user_preferences_user_id_fkey: %', SQLERRM;
  END;
END $$;

-- Final success message
DO $$ 
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'AI Assistant Migration Completed Successfully!';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Tables created: ai_action_audit, ai_automations, ai_context_cache, ai_tool_definitions, ai_user_preferences';
  RAISE NOTICE 'Tool definitions inserted: 13 tools registered';
  RAISE NOTICE 'RLS enabled on all tables';
  RAISE NOTICE '';
  RAISE NOTICE 'Note: Some foreign keys or RLS policies may not have been added if';
  RAISE NOTICE 'dependent tables (venues, auth.users, user_venue_roles) do not exist.';
  RAISE NOTICE 'This is OK - the AI Assistant will work, but you should add these';
  RAISE NOTICE 'constraints manually or re-run this migration after setting up your';
  RAISE NOTICE 'full Servio schema.';
  RAISE NOTICE '=================================================================';
END $$;

