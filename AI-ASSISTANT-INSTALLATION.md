# AI Assistant - Installation Guide

This guide will walk you through installing and integrating the Servio AI Assistant into your application.

## Prerequisites

- Node.js 18+ 
- PostgreSQL/Supabase database
- OpenAI API key
- Servio MVP project setup

## Step 1: Database Setup

Run the AI assistant migration to create required tables:

```bash
# Using psql
psql $DATABASE_URL -f migrations/ai-assistant-schema.sql

# Or using Supabase CLI
supabase db push migrations/ai-assistant-schema.sql
```

This creates:
- `ai_action_audit` - Audit log for all AI actions
- `ai_automations` - Scheduled/triggered automations
- `ai_context_cache` - Performance cache for context
- `ai_tool_definitions` - Tool registry
- `ai_user_preferences` - User-specific preferences

## Step 2: Environment Variables

Add your OpenAI API key to `.env`:

```bash
OPENAI_API_KEY=sk-proj-...
```

**Get your API key:**
1. Go to https://platform.openai.com/api-keys
2. Create a new secret key
3. Copy and paste into `.env`

## Step 3: Install Dependencies

The AI assistant requires these packages (likely already installed):

```bash
npm install openai zod date-fns
```

## Step 4: Global Command Palette

Add the command palette to your main dashboard layout so it's available everywhere:

```tsx
// app/dashboard/[venueId]/layout.tsx

import { AssistantCommandPalette } from "@/components/ai/assistant-command-palette";

export default function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { venueId: string };
}) {
  return (
    <div>
      {children}
      
      {/* AI Assistant - Global Command Palette */}
      <AssistantCommandPalette venueId={params.venueId} />
    </div>
  );
}
```

Now users can press `⌘K` (Mac) or `Ctrl-K` (Windows/Linux) or click the floating ✨ AI button in the bottom-right corner to open the AI assistant!

## Step 5: Add Contextual Assistants (Optional)

Add contextual assistants to specific pages for page-specific suggestions.

### Example: Inventory Page

```tsx
// app/dashboard/[venueId]/inventory/page.tsx

import { ContextualAssistant } from "@/components/ai/contextual-assistant";
import { getInventorySummary } from "@/lib/ai/context-builders";

export default async function InventoryPage({
  params,
}: {
  params: { venueId: string };
}) {
  // Fetch inventory summary for context
  const inventorySummary = await getInventorySummary(params.venueId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Main inventory content */}
      <div className="lg:col-span-3">
        <h1>Inventory Management</h1>
        {/* Your existing inventory components */}
      </div>

      {/* AI Assistant Sidebar */}
      <div className="lg:col-span-1">
        <ContextualAssistant
          venueId={params.venueId}
          page="inventory"
          dataSummary={inventorySummary}
        />
      </div>
    </div>
  );
}
```

### Example: Menu Management Page

```tsx
// app/dashboard/[venueId]/menu/page.tsx

import { ContextualAssistant } from "@/components/ai/contextual-assistant";
import { getMenuSummary } from "@/lib/ai/context-builders";

export default async function MenuPage({
  params,
}: {
  params: { venueId: string };
}) {
  const menuSummary = await getMenuSummary(params.venueId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-3">
        <h1>Menu Management</h1>
        {/* Your existing menu components */}
      </div>

      <div className="lg:col-span-1">
        <ContextualAssistant
          venueId={params.venueId}
          page="menu"
          dataSummary={menuSummary}
        />
      </div>
    </div>
  );
}
```

### Example: KDS Page

```tsx
// app/dashboard/[venueId]/kds/page.tsx

import { ContextualAssistant } from "@/components/ai/contextual-assistant";
import { getOrdersSummary } from "@/lib/ai/context-builders";

export default async function KDSPage({
  params,
}: {
  params: { venueId: string };
}) {
  const ordersSummary = await getOrdersSummary(params.venueId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-3">
        <h1>Kitchen Display System</h1>
        {/* Your existing KDS components */}
      </div>

      <div className="lg:col-span-1">
        <ContextualAssistant
          venueId={params.venueId}
          page="kds"
          dataSummary={ordersSummary}
        />
      </div>
    </div>
  );
}
```

## Step 6: Add Activity Log to Settings (Optional)

Show users their AI assistant history in the settings page:

```tsx
// app/dashboard/[venueId]/settings/page.tsx

import { AIActivityLog } from "@/components/ai/activity-log";

export default function SettingsPage({
  params,
}: {
  params: { venueId: string };
}) {
  return (
    <div className="space-y-8">
      {/* Other settings sections */}
      
      <section>
        <h2 className="text-2xl font-bold mb-4">AI Assistant</h2>
        <AIActivityLog venueId={params.venueId} limit={50} />
      </section>
    </div>
  );
}
```

## Step 7: Test the Installation

1. **Start your dev server:**
   ```bash
   npm run dev
   ```

2. **Navigate to any dashboard page**

3. **Press `⌘K` (or `Ctrl-K`) or click the floating ✨ AI button** to open the command palette

4. **Try a simple command:**
   ```
   Show top 5 selling items
   ```

5. **Review the plan** and click "Confirm & Execute"

6. **Check the activity log** in Settings to see the audit trail

## Verification Checklist

- [ ] Database migration completed successfully
- [ ] `OPENAI_API_KEY` set in `.env`
- [ ] Command palette opens with `⌘K` / `Ctrl-K` or floating ✨ AI button
- [ ] AI can generate plans from natural language
- [ ] Preview diffs show before/after changes
- [ ] Execution works and updates database
- [ ] Activity log shows recent actions
- [ ] Contextual assistants show on specific pages (if added)

## Troubleshooting

### Command palette doesn't open
- Check that `<AssistantCommandPalette>` is in your layout
- Verify keyboard shortcut isn't conflicting with browser/OS
- Try clicking a button that triggers `setOpen(true)` instead

### "OPENAI_API_KEY is not set" error
- Verify `.env` file has the key
- Restart your dev server after adding the key
- Check the key starts with `sk-`

### Planning fails with "Network error"
- Verify your OpenAI API key is valid
- Check you have credits in your OpenAI account
- Ensure your network allows requests to `api.openai.com`

### "Unauthorized" when making requests
- Ensure user is logged in
- Verify user has a role in `user_venue_roles` for the venue
- Check Supabase RLS policies are properly configured

### Previews don't load
- Check API routes are accessible (`/api/ai-assistant/*`)
- Verify tool executors are implemented for the tool being used
- Check browser console for errors

### Database errors
- Ensure migration ran successfully
- Verify RLS policies are enabled
- Check user has proper venue access

## Next Steps

1. **Customize suggestions:** Edit `PAGE_SUGGESTIONS` in `contextual-assistant.tsx`

2. **Add new tools:** Follow the guide in `AI-ASSISTANT-README.md`

3. **Enable automations:** Set up cron jobs for scheduled tasks

4. **Configure guardrails:** Adjust limits in `DEFAULT_GUARDRAILS`

5. **Monitor costs:** Track OpenAI usage in activity logs

## Cost Management

**Estimated costs (GPT-4o):**
- Planning request: ~$0.003
- Preview request: ~$0.001
- Typical user session: ~$0.01-0.05

**Tips to reduce costs:**
1. Use context caching (already implemented)
2. Set rate limits per user/venue
3. Use cheaper models for simple tasks (planned feature)
4. Monitor usage via activity log

## Support

If you encounter issues:

1. Check the [README](./AI-ASSISTANT-README.md) for detailed documentation
2. Review the activity log for error details
3. Enable debug mode: `localStorage.setItem('debug_ai', 'true')`
4. Check database logs for Supabase errors

## Example User Flow

1. User navigates to Menu page
2. Sees contextual assistant with suggestions
3. Clicks "Increase all coffee prices by 5%"
4. Command palette opens with pre-filled prompt
5. Clicks "Plan" button
6. AI shows plan with reasoning
7. Previews show before/after prices
8. User reviews and clicks "Confirm & Execute"
9. Prices update, page refreshes
10. Action logged in activity log

---

**You're all set! Press ⌘K or click the floating ✨ AI button and start using the AI assistant.**

