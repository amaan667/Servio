# AI Assistant Strict Schema Fix

## Summary
Fixed the OpenAI JSON Schema error by implementing strict, enumerated Zod schemas with a discriminated union for all tool parameters. This eliminates the `400 Invalid schema for response_format 'assistant_plan'` error.

## Changes Made

### 1. **All Tool Parameter Schemas Made Strict** (`types/ai-assistant.ts`)
- Added `.strict()` to all 18 tool parameter schemas
- Added `.strict()` to nested objects within arrays
- Replaced `z.record(z.any())` with `z.object({}).strict()` for flexible fields
- Ensures `additionalProperties: false` in generated JSON Schema

**Tools Updated:**
- Menu Tools: `update_prices`, `toggle_availability`, `create_item`, `delete_item`, `translate`
- Inventory Tools: `adjust_stock`, `set_par_levels`, `generate_purchase_order`
- Order Tools: `mark_served`, `complete`
- Analytics Tools: `get_insights`, `get_stats`, `export`, `create_report`
- Discount Tools: `create`
- KDS Tools: `get_overdue`, `suggest_optimization`
- Navigation Tools: `go_to_page`

### 2. **Discriminated Union for Tool Calls** (`types/ai-assistant.ts`)
Created `ToolCallSchema` as a discriminated union with `name` as the discriminator:

```typescript
export const ToolCallSchema = z.discriminatedUnion("name", [
  z.object({
    name: z.literal("menu.update_prices"),
    params: MenuUpdatePricesSchema,
    preview: z.boolean(),
  }).strict(),
  // ... 17 more tools
]);
```

Each tool call is now a strict object with:
- `name`: Literal string (e.g., `"menu.update_prices"`)
- `params`: Specific typed schema for that tool
- `preview`: Boolean flag

### 3. **Main Assistant Plan Schema** (`types/ai-assistant.ts`)
```typescript
export const AssistantPlanSchema = z.object({
  intent: z.string(),
  tools: z.array(ToolCallSchema),
  reasoning: z.string(),
  warnings: z.array(z.string()).nullable(),
}).strict();
```

### 4. **Updated LLM Service** (`lib/ai/assistant-llm.ts`)
- Removed local schema definitions
- Imported `AssistantPlanSchema` from types
- Updated `planAssistantAction` to use strict schema
- Removed manual validation loop (now handled by discriminated union)
- Added better error logging for Zod validation failures

### 5. **Strict Mode Enabled**
The `zodResponseFormat` function automatically generates JSON Schema with:
- `type: "json_schema"`
- `strict: true` 
- `additionalProperties: false` on all objects

## How It Works

1. **User sends prompt** → API endpoint receives it
2. **Context gathered** → Menu, inventory, orders, analytics summaries
3. **LLM call with strict schema** → OpenAI validates against discriminated union
4. **Response parsed** → `zodResponseFormat` automatically validates
5. **Type-safe execution** → Each tool receives correctly typed params

## Benefits

✅ **No more 400 errors** - All schemas comply with OpenAI's strict mode requirements  
✅ **Type safety** - Discriminated union ensures correct params for each tool  
✅ **Runtime validation** - Zod validates at runtime, catches invalid tool calls  
✅ **Better errors** - Clear validation errors when model produces invalid output  
✅ **Maintainability** - Single source of truth for tool schemas  

## Testing

To test the fix:

1. **Navigate to AI Assistant** in your dashboard
2. **Enter any prompt**, e.g., "Show me today's revenue"
3. **Verify no 400 error** - Should generate plan successfully
4. **Check response structure** - Should match AssistantPlanSchema

Example valid response:
```json
{
  "intent": "Get revenue statistics for today",
  "tools": [
    {
      "name": "analytics.get_stats",
      "params": {
        "metric": "revenue",
        "timeRange": "today"
      },
      "preview": false
    }
  ],
  "reasoning": "User wants revenue data, using analytics tool",
  "warnings": null
}
```

## Schema Structure

Each tool in the discriminated union has:
- Explicit `name` literal
- Strict `params` object (no extra properties allowed)
- Boolean `preview` flag

Example:
```typescript
z.object({
  name: z.literal("menu.update_prices"),
  params: z.object({
    items: z.array(z.object({
      id: z.string().uuid(),
      newPrice: z.number().positive(),
    }).strict()),
    preview: z.boolean().default(true),
  }).strict(),
  preview: z.boolean(),
}).strict()
```

## Key Files Changed

- `types/ai-assistant.ts` - Added `.strict()` to all schemas, created discriminated union
- `lib/ai/assistant-llm.ts` - Updated to use imported strict schemas, improved error handling

## Commit Message
```
fix(ai): strict tool params for assistant_plan schema (no additionalProperties true)

- Added .strict() to all 18 tool parameter schemas
- Created discriminated union ToolCallSchema with explicit params
- Updated AssistantPlanSchema to use strict union
- Removed flexible z.record patterns
- zodResponseFormat now generates compliant JSON Schema
- No more 400 errors from OpenAI API
```

## Next Steps

If you need to add new tools:

1. **Create strict param schema** in `types/ai-assistant.ts`
2. **Add to TOOL_SCHEMAS registry**
3. **Add to ToolCallSchema discriminated union** with literal name
4. **Implement executor** in `lib/ai/tool-executors.ts`
5. **Update system prompt** in `assistant-llm.ts` if needed

All new tools MUST use `.strict()` on all objects to maintain compliance.

