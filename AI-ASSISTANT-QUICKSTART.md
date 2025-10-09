# AI Assistant - Quick Start Guide

## 🚀 Installation (5 minutes)

```bash
# 1. Set your OpenAI API key
echo "OPENAI_API_KEY=sk-proj-your-key" >> .env

# 2. Run setup script
./scripts/setup-ai-assistant.sh

# 3. Start dev server
npm run dev
```

That's it! Press `⌘K` (or `Ctrl-K`) to start using the AI assistant.

## 💡 What Can It Do?

### Menu & Pricing
```
"Increase all coffee prices by 5%"
"Hide items with less than 3 sales this week"
"Translate menu to Spanish"
```

### Inventory
```
"Show low stock items"
"Create purchase order for tomorrow"
"Set par levels based on last 30 days"
"Adjust stock for ingredient #123 by +50"
```

### Orders
```
"Mark order #307 as served"
"Show tables with unpaid checks over 15 minutes"
"Complete order for table 5"
```

### Analytics
```
"Which 5 items drive 80% of revenue?"
"Show yesterday's performance"
"Export sales data as CSV"
```

### KDS
```
"Show overdue tickets on Fryer station"
"Summarize lunch rush performance"
```

### Discounts
```
"Create happy hour: 4-6pm, 10% off drinks"
"Add weekend brunch discount of 15%"
```

## 🎨 UI Components

### Global Command Palette
```tsx
import { AssistantCommandPalette } from "@/components/ai/assistant-command-palette";

<AssistantCommandPalette venueId={venueId} />
```

### Contextual Assistant (Sidebar)
```tsx
import { ContextualAssistant } from "@/components/ai/contextual-assistant";

<ContextualAssistant
  venueId={venueId}
  page="inventory"  // or "menu", "kds", "orders", "analytics"
  dataSummary={data}
/>
```

### Activity Log
```tsx
import { AIActivityLog } from "@/components/ai/activity-log";

<AIActivityLog venueId={venueId} limit={20} />
```

## 🔒 Safety Features

- **Preview First**: All actions show before/after preview
- **Guardrails**: 
  - Price changes limited to ±20%
  - Discounts capped at 30%
  - Bulk operations limited to 50-100 items
- **RBAC**: Staff cannot export data or create discounts
- **Audit Trail**: Every action is logged with timestamp, user, and result

## 📊 Architecture

```
User Prompt → Planning (LLM) → Preview → User Confirms → Execute → Audit
```

**Tech:**
- OpenAI GPT-4o with structured outputs
- Zod validation for all parameters
- Supabase RLS for security
- 1-minute context caching for speed

## 💰 Cost

~$0.003 per planning request
~$0.01-0.05 per user session

**Optimization:**
- Context caching reduces redundant API calls
- Structured outputs minimize token usage
- Summaries instead of full data dumps

## 🛠️ Adding New Tools

1. **Define schema** in `types/ai-assistant.ts`:
```ts
export const MyToolSchema = z.object({
  param1: z.string(),
  param2: z.number(),
});
```

2. **Add to registry**:
```ts
export const TOOL_SCHEMAS = {
  // ...
  "my.tool": MyToolSchema,
};
```

3. **Implement executor** in `lib/ai/tool-executors.ts`:
```ts
export async function executeMyTool(
  params: MyToolParams,
  venueId: string,
  userId: string,
  preview: boolean
) {
  // Implementation
}
```

4. **Add to router**:
```ts
case "my.tool":
  return executeMyTool(params, venueId, userId, preview);
```

## 🧪 Testing

### Manual Testing
1. Open dashboard
2. Press `⌘K`
3. Type: "Show top 5 selling items"
4. Review plan and preview
5. Confirm execution
6. Check activity log

### API Testing
```bash
# Plan endpoint
curl -X POST http://localhost:3000/api/ai-assistant/plan \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Increase coffee prices by 5%",
    "venueId": "uuid"
  }'

# Execute endpoint (preview)
curl -X POST http://localhost:3000/api/ai-assistant/execute \
  -H "Content-Type: application/json" \
  -d '{
    "venueId": "uuid",
    "toolName": "menu.update_prices",
    "params": {...},
    "preview": true
  }'
```

## 🐛 Debugging

Enable debug mode:
```js
localStorage.setItem('debug_ai', 'true');
```

Check logs:
```sql
-- Recent activity
SELECT * FROM ai_action_audit 
WHERE venue_id = 'your-venue-id' 
ORDER BY created_at DESC 
LIMIT 10;

-- Failed actions
SELECT * FROM ai_action_audit 
WHERE error IS NOT NULL 
ORDER BY created_at DESC;

-- Tool usage stats
SELECT tool_name, COUNT(*), AVG(execution_time_ms) 
FROM ai_action_audit 
GROUP BY tool_name;
```

## 📁 File Structure

```
migrations/
  └── ai-assistant-schema.sql          # Database tables

types/
  └── ai-assistant.ts                  # TypeScript types & schemas

lib/ai/
  ├── assistant-llm.ts                 # OpenAI integration
  ├── context-builders.ts              # RAG data gathering
  └── tool-executors.ts                # Tool implementations

app/api/ai-assistant/
  ├── plan/route.ts                    # Planning endpoint
  ├── execute/route.ts                 # Execution endpoint
  └── activity/route.ts                # Activity log endpoint

components/ai/
  ├── assistant-command-palette.tsx    # ⌘K global palette
  ├── contextual-assistant.tsx         # Page-specific drawer
  └── activity-log.tsx                 # Audit trail viewer
```

## 🔗 Useful Links

- [Full Documentation](./AI-ASSISTANT-README.md)
- [Installation Guide](./AI-ASSISTANT-INSTALLATION.md)
- [OpenAI API Keys](https://platform.openai.com/api-keys)

## ⚡ Pro Tips

1. **Use contextual assistants** on specific pages for better suggestions
2. **Review activity log** regularly to understand usage patterns
3. **Set up automations** for recurring tasks (daily digests, auto-restock)
4. **Customize suggestions** in `PAGE_SUGGESTIONS` for your workflow
5. **Monitor costs** via OpenAI dashboard and activity logs

---

**Press ⌘K and start building with AI! 🚀**

