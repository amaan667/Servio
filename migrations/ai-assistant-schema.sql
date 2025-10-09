-- Servio AI Assistant System Schema
-- This migration adds tables for AI assistant functionality, action auditing, and automations

-- ============================================================================
-- AI Action Audit Log
-- Tracks all AI assistant actions (both preview and executed)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_action_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
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
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  
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
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- AI Context Cache
-- Cache frequently-accessed context to speed up planning
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_context_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  
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
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
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
-- RLS Policies
-- ============================================================================

ALTER TABLE ai_action_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_context_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only see audit logs for their venue
CREATE POLICY audit_venue_access ON ai_action_audit
  FOR ALL USING (
    venue_id IN (
      SELECT venue_id FROM user_venue_roles 
      WHERE user_id = auth.uid()
    )
  );

-- Users can manage automations for their venue
CREATE POLICY automations_venue_access ON ai_automations
  FOR ALL USING (
    venue_id IN (
      SELECT venue_id FROM user_venue_roles 
      WHERE user_id = auth.uid()
    )
  );

-- Context cache is venue-scoped
CREATE POLICY context_cache_venue_access ON ai_context_cache
  FOR ALL USING (
    venue_id IN (
      SELECT venue_id FROM user_venue_roles 
      WHERE user_id = auth.uid()
    )
  );

-- User preferences are user-scoped
CREATE POLICY user_prefs_access ON ai_user_preferences
  FOR ALL USING (user_id = auth.uid());

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

