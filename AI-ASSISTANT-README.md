# Servio AI Assistant

A platform-wide AI assistant that helps restaurant operators manage their operations through natural language commands.

## Overview

The Servio AI Assistant allows authenticated users to perform complex operations across the platform using natural language. It features:

- **Natural Language Planning**: Uses GPT-4o to understand intent and generate safe execution plans
- **Preview Before Execute**: All actions show a preview diff before making changes
- **Context-Aware**: Provides relevant suggestions based on the current page
- **Multi-Tool Execution**: Can chain multiple actions together
- **Safety Guardrails**: Built-in limits and validations to prevent mistakes
- **Full Audit Trail**: Every action is logged for transparency

## Architecture

```
User Prompt
    ↓
[Planning] → LLM understands intent + generates tool plan
    ↓
[Context Builder] → Gathers relevant data (menu, inventory, orders, etc.)
    ↓
[Preview] → Shows what will change (with before/after diffs)
    ↓
[User Confirms]
    ↓
[Execute] → Runs tools with guardrails & validation
    ↓
[Audit Log] → Records action + result
```

## Features

### 1. Menu & Pricing
- Update prices with constraints (±20% max change)
- Toggle item availability based on criteria
- Translate menus to multiple languages
- Generate special menus (prix-fixe, seasonal, etc.)

### 2. Orders & KDS
- Mark orders as served or completed
- Find overdue tickets by station
- Analyze prep time bottlenecks
- Suggest workflow optimizations

### 3. Inventory & Costing
- Adjust stock levels (receive, waste, count)
- Set par levels based on historical usage
- Generate purchase orders (CSV/JSON/PDF)
- Auto-86 items when ingredients hit zero

### 4. Analytics & Revenue
- Get insights on top sellers and revenue drivers
- Export data in multiple formats
- Compare performance across time periods
- Estimate pricing elasticity

### 5. Discounts & Promotions
- Create time-based or conditional discounts
- Set happy hour pricing
- Feature seasonal promotions

## Tech Stack

- **LLM**: OpenAI GPT-4o with structured outputs
- **Validation**: Zod schemas for all tool parameters
- **RAG**: Context builders with 1-minute cache
- **Security**: RLS policies, RBAC, guardrails
- **Audit**: Comprehensive logging of all actions

## Database Schema

### `ai_action_audit`
Logs all AI assistant actions (both preview and executed).

- `user_prompt`: What the user asked
- `intent`: High-level intent (e.g., "menu.update_prices")
- `tool_name`: Specific tool executed
- `params`: Tool parameters (JSONB)
- `preview`: Whether this was a preview or execution
- `executed`: Whether the action was carried out
- `result`: Execution result (JSONB)
- `error`: Error message if failed

### `ai_automations`
Scheduled or triggered actions (e.g., daily digests, auto-restock alerts).

- `trigger_type`: cron, event, or threshold
- `cron_schedule`: Cron expression (e.g., "0 20 * * *")
- `tool_name`: Tool to execute
- `params`: Tool parameters
- `enabled`: Whether automation is active

### `ai_context_cache`
Caches frequently-accessed context to speed up planning.

- `context_type`: menu_summary, inventory_summary, etc.
- `context_data`: Cached data (JSONB)
- `expires_at`: TTL (default: 1 minute)

### `ai_tool_definitions`
Registry of available tools with schemas and permissions.

- `tool_name`: Unique identifier
- `category`: menu, inventory, orders, analytics, etc.
- `params_schema`: JSON schema for validation
- `required_permission`: RBAC permission needed
- `required_tier`: Minimum venue tier
- `guardrails`: Rate limits, max items, etc.

## API Endpoints

### POST `/api/ai-assistant/plan`
Generates an execution plan from a user prompt.

**Request:**
```json
{
  "prompt": "Increase all coffee prices by 5%",
  "venueId": "uuid",
  "context": {
    "page": "menu"
  }
}
```

**Response:**
```json
{
  "success": true,
  "plan": {
    "intent": "Update menu prices for coffee items",
    "tools": [
      {
        "name": "menu.update_prices",
        "params": {
          "items": [
            { "id": "uuid", "newPrice": 4.20 }
          ],
          "preview": true
        }
      }
    ],
    "reasoning": "Price increases are within 20% guardrail...",
    "warnings": []
  },
  "auditId": "uuid"
}
```

### POST `/api/ai-assistant/execute`
Executes or previews a tool.

**Request:**
```json
{
  "venueId": "uuid",
  "toolName": "menu.update_prices",
  "params": {
    "items": [...]
  },
  "preview": true
}
```

**Response (preview):**
```json
{
  "success": true,
  "preview": {
    "toolName": "menu.update_prices",
    "before": [...],
    "after": [...],
    "impact": {
      "itemsAffected": 5,
      "estimatedRevenue": 12.50,
      "description": "5 items will be updated..."
    }
  }
}
```

### GET `/api/ai-assistant/activity`
Fetches recent AI assistant actions.

**Query Params:**
- `venueId`: UUID of venue
- `limit`: Number of records (default: 20)

## UI Components

### `<AssistantCommandPalette>`
Global command palette (⌘K / Ctrl-K) for AI assistance.

**Usage:**
```tsx
import { AssistantCommandPalette } from "@/components/ai/assistant-command-palette";

<AssistantCommandPalette
  venueId={venueId}
  page="menu"
  suggestions={["Increase prices by 5%", ...]}
/>
```

### `<ContextualAssistant>`
Page-specific assistant drawer with contextual suggestions.

**Usage:**
```tsx
import { ContextualAssistant } from "@/components/ai/contextual-assistant";

<ContextualAssistant
  venueId={venueId}
  page="inventory"
  dataSummary={inventorySummary}
/>
```

### `<AIActivityLog>`
Shows recent AI assistant actions for transparency.

**Usage:**
```tsx
import { AIActivityLog } from "@/components/ai/activity-log";

<AIActivityLog venueId={venueId} limit={20} />
```

## Available Tools

### Menu Tools
- `menu.update_prices`: Update item prices (max ±20%)
- `menu.toggle_availability`: Show/hide items
- `menu.translate`: Translate menu to another language

### Inventory Tools
- `inventory.adjust_stock`: Adjust stock levels
- `inventory.set_par_levels`: Set par levels based on usage
- `inventory.generate_purchase_order`: Generate PO for low stock

### Order Tools
- `orders.mark_served`: Mark order as served
- `orders.complete`: Complete an order

### Analytics Tools
- `analytics.get_insights`: Get business insights
- `analytics.export`: Export data (CSV/JSON/PDF)

### Discount Tools
- `discounts.create`: Create time-based discounts

### KDS Tools
- `kds.get_overdue`: Get overdue tickets by station
- `kds.suggest_optimization`: Suggest workflow improvements

## Guardrails & Safety

### Price Changes
- Max ±20% change unless user is manager
- Prices must round appropriately
- Preview required before execution

### Bulk Operations
- Max 50 items per price update
- Max 100 items per availability toggle
- Max 50 ingredients per stock adjustment

### Discounts
- Max 30% discount unless manager approval
- Time windows must be valid
- Scope must be properly defined

### Role Restrictions
- **Staff**: Cannot create discounts, export data, or change par levels
- **Manager**: Full access to operational tools
- **Owner**: Full access to all tools

### Tier Restrictions
- **Starter**: Menu and basic analytics only
- **Professional**: Adds inventory management
- **Premium**: All features enabled

## Example Use Cases

### 1. "Increase all coffee prices by 5%, round to .95"

**Plan:**
- Finds all items in "Coffee" category
- Calculates new prices (x1.05)
- Rounds to nearest .95
- Shows preview with before/after prices

**Guardrails:**
- Validates 5% is within ±20% limit
- Ensures rounding is sensible
- Requires confirmation before applying

### 2. "Create purchase order for tomorrow"

**Plan:**
- Fetches inventory with `on_hand < reorder_level`
- Calculates quantities to reach `par_level`
- Generates CSV/JSON export

**Guardrails:**
- Validates inventory is enabled for venue tier
- Checks user has inventory:read permission
- Logs export for audit

### 3. "Mark order #307 as served"

**Plan:**
- Finds order by number
- Validates it's in "ready" status
- Updates status to "served"
- Optionally notifies FOH

**Guardrails:**
- Ensures order exists and belongs to venue
- Validates status transition is valid
- Updates timestamps appropriately

## Environment Variables

Add to your `.env` file:

```bash
OPENAI_API_KEY=sk-...
```

## Database Migration

Run the migration to set up the AI assistant schema:

```bash
psql $DATABASE_URL -f migrations/ai-assistant-schema.sql
```

This creates:
- `ai_action_audit` table
- `ai_automations` table
- `ai_context_cache` table
- `ai_tool_definitions` table (with default tools)
- `ai_user_preferences` table
- RLS policies
- Triggers and functions

## Integration Guide

### 1. Add Command Palette to Layout

Add to your main layout (after authentication):

```tsx
// app/dashboard/layout.tsx
import { AssistantCommandPalette } from "@/components/ai/assistant-command-palette";

export default function DashboardLayout({ children }) {
  return (
    <>
      {children}
      <AssistantCommandPalette venueId={venueId} />
    </>
  );
}
```

### 2. Add Contextual Assistant to Pages

Add to specific pages (e.g., inventory):

```tsx
// app/dashboard/[venueId]/inventory/page.tsx
import { ContextualAssistant } from "@/components/ai/contextual-assistant";

export default function InventoryPage() {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="col-span-2">
        {/* Main inventory content */}
      </div>
      <div>
        <ContextualAssistant
          venueId={venueId}
          page="inventory"
          dataSummary={inventorySummary}
        />
      </div>
    </div>
  );
}
```

### 3. Add Activity Log to Settings

Add to settings page:

```tsx
// app/dashboard/[venueId]/settings/page.tsx
import { AIActivityLog } from "@/components/ai/activity-log";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Other settings sections */}
      <AIActivityLog venueId={venueId} />
    </div>
  );
}
```

## Cost Considerations

**GPT-4o Pricing (as of 2024):**
- Input: $0.0025 per 1K tokens
- Output: $0.01 per 1K tokens

**Typical Request:**
- Context: ~2K tokens
- User prompt: ~50 tokens
- Response: ~200 tokens
- **Cost per request: ~$0.003**

**Optimization:**
- Context caching (1-minute TTL) reduces repeated data fetches
- Structured outputs reduce token usage vs. free-form
- Summaries instead of full data dumps

## Future Enhancements

### Phase 1 (Current)
- ✅ Read-only insights
- ✅ Preview-only actions
- ✅ Global command palette
- ✅ Page-specific assistants

### Phase 2 (Planned)
- [ ] Scheduled automations (daily digests, auto-restock)
- [ ] Multi-tool workflows (e.g., adjust inventory + notify supplier)
- [ ] Price testing with rollback
- [ ] Advanced analytics (elasticity, forecasting)

### Phase 3 (Future)
- [ ] Multi-venue support
- [ ] Customer marketing integration (posts, email drafts)
- [ ] Voice interface
- [ ] Mobile app integration

## Security & Privacy

- All prompts and actions are logged for audit
- RLS policies ensure users can only access their venue's data
- Guardrails prevent accidental destructive actions
- No PII is sent to OpenAI (only aggregated summaries)
- API keys are stored securely in environment variables

## Troubleshooting

### "Planning failed"
- Check `OPENAI_API_KEY` is set correctly
- Verify OpenAI account has credits
- Check console for detailed error

### "Unauthorized"
- Ensure user is authenticated
- Verify user has access to the venue (`user_venue_roles`)

### "Guardrail violation"
- Check if price change exceeds ±20%
- Verify discount is ≤30%
- Ensure bulk operation doesn't exceed limits

### "Tool not implemented"
- Some tools are defined but not yet implemented
- Check `tool-executors.ts` for implemented tools

## Contributing

To add a new tool:

1. Define schema in `types/ai-assistant.ts`
2. Add to `TOOL_SCHEMAS` and export type
3. Implement executor in `lib/ai/tool-executors.ts`
4. Add to tool router in `executeTool()`
5. Insert tool definition in migration (optional)
6. Update this README

## Support

For issues or questions:
- Check the activity log for error details
- Review audit table for execution history
- Enable debug logging: `localStorage.setItem('debug_ai', 'true')`

---

**Built with ❤️ for Servio MVP**

