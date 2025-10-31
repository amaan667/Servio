// Servio AI Assistant Types

import { z } from "zod";

// ============================================================================
// Tool Parameter Schemas (Zod for runtime validation)
// ============================================================================

// Menu Tools
export const MenuUpdatePricesSchema = z
  .object({
    items: z.array(
      z
        .object({
          id: z.string().uuid(),
          newPrice: z.number().positive(),
        })
        .strict()
    ),
    preview: z.boolean().default(true),
  })
  .strict();

export const MenuToggleAvailabilitySchema = z
  .object({
    itemIds: z.array(z.string().uuid()),
    available: z.boolean(),
    reason: z.string().nullable().default(null),
  })
  .strict();

export const MenuCreateItemSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().nullable().default(null),
    price: z.number().positive(),
    categoryId: z.string().uuid(),
    available: z.boolean().default(true),
    imageUrl: z.string().nullable().default(null), // Removed .url() - not supported by OpenAI strict mode
    allergens: z.array(z.string()).default([]),
  })
  .strict();

export const MenuDeleteItemSchema = z
  .object({
    itemId: z.string().uuid(),
    reason: z.string().nullable().default(null),
  })
  .strict();

export const MenuTranslateSchema = z
  .object({
    targetLanguage: z.enum(["es", "ar", "fr", "de", "it", "pt", "zh", "ja"]),
    includeDescriptions: z.boolean().default(true),
  })
  .strict();

// Inventory Tools
export const InventoryAdjustStockSchema = z
  .object({
    adjustments: z.array(
      z
        .object({
          ingredientId: z.string().uuid(),
          delta: z.number(),
          notes: z.string().nullable().default(null),
        })
        .strict()
    ),
    reason: z.enum(["receive", "adjust", "waste", "count"]),
    preview: z.boolean().default(true),
  })
  .strict();

export const InventorySetParLevelsSchema = z
  .object({
    strategy: z.enum(["last_30_days", "last_7_days", "manual"]),
    bufferPercentage: z.number().min(0).max(100).default(20),
    preview: z.boolean().default(true),
  })
  .strict();

export const InventoryGeneratePurchaseOrderSchema = z
  .object({
    threshold: z.enum(["reorder_level", "par_level"]),
    format: z.enum(["csv", "json", "pdf"]),
  })
  .strict();

// Order Tools
export const OrdersMarkServedSchema = z
  .object({
    orderId: z.string().uuid(),
    notifyFOH: z.boolean().default(true),
  })
  .strict();

export const OrdersCompleteSchema = z
  .object({
    orderId: z.string().uuid(),
    paymentMethod: z.string().nullable().default(null),
  })
  .strict();

// Analytics Tools
export const AnalyticsGetInsightsSchema = z
  .object({
    metric: z.string(),
    timeRange: z.enum(["today", "week", "month", "quarter", "year", "custom"]),
    groupBy: z.enum(["day", "week", "month", "category", "item"]).nullable().default(null),
    customRange: z
      .object({
        start: z.string(),
        end: z.string(),
      })
      .strict()
      .nullable()
      .default(null),
    itemId: z.string().uuid().nullable().default(null), // Filter by specific item
    itemName: z.string().nullable().default(null), // Item name for context in response
  })
  .strict();

export const AnalyticsExportSchema = z
  .object({
    type: z.enum(["sales", "orders", "inventory", "customers"]),
    format: z.enum(["csv", "json", "pdf"]),
    filters: z
      .object({
        /* Empty */
      })
      .strict()
      .nullable()
      .default(null), // No more z.record - strict empty object for flexible filters
  })
  .strict();

export const AnalyticsGetStatsSchema = z
  .object({
    metric: z.enum([
      "revenue",
      "orders_count",
      "avg_order_value",
      "top_items",
      "peak_hours",
      "customer_count",
      "table_turnover",
      "menu_performance",
    ]),
    timeRange: z.enum(["today", "yesterday", "week", "month", "quarter", "year"]),
    groupBy: z.enum(["hour", "day", "week", "month", "category", "item"]).nullable().default(null),
    itemId: z.string().uuid().nullable().default(null), // Filter by specific item
    itemName: z.string().nullable().default(null), // Item name for context
  })
  .strict();

export const AnalyticsCreateReportSchema = z
  .object({
    name: z.string().min(1),
    metrics: z.array(z.string()),
    timeRange: z.enum(["today", "week", "month", "quarter", "year"]),
    format: z.enum(["pdf", "csv", "json"]),
    schedule: z.enum(["once", "daily", "weekly", "monthly"]).default("once"),
  })
  .strict();

// Discount Tools
export const DiscountsCreateSchema = z
  .object({
    name: z.string().min(1),
    scope: z.enum(["category", "item", "all"]),
    scopeId: z.string().uuid().nullable().default(null), // category or item id
    amountPct: z.number().min(0).max(100),
    startsAt: z.string(),
    endsAt: z.string().nullable().default(null),
  })
  .strict();

// KDS Tools
export const KDSGetOverdueSchema = z
  .object({
    station: z.string().nullable().default(null),
    thresholdMinutes: z.number().positive().default(10),
  })
  .strict();

export const KDSSuggestOptimizationSchema = z
  .object({
    timeRange: z.enum(["today", "week", "month"]),
    station: z.string().nullable().default(null),
  })
  .strict();

// Navigation Tools
export const NavigationGoToPageSchema = z
  .object({
    page: z.enum([
      "dashboard",
      "menu",
      "inventory",
      "orders",
      "live-orders",
      "kds",
      "kitchen-display",
      "qr-codes",
      "analytics",
      "settings",
      "staff",
      "tables",
      "feedback",
    ]),
    venueId: z.string().nullable().default(null),
  })
  .strict();

// ============================================================================
// Tool Registry
// ============================================================================

export const TOOL_SCHEMAS = {
  "menu.update_prices": MenuUpdatePricesSchema,
  "menu.toggle_availability": MenuToggleAvailabilitySchema,
  "menu.create_item": MenuCreateItemSchema,
  "menu.delete_item": MenuDeleteItemSchema,
  "menu.translate": MenuTranslateSchema,
  "inventory.adjust_stock": InventoryAdjustStockSchema,
  "inventory.set_par_levels": InventorySetParLevelsSchema,
  "inventory.generate_purchase_order": InventoryGeneratePurchaseOrderSchema,
  "orders.mark_served": OrdersMarkServedSchema,
  "orders.complete": OrdersCompleteSchema,
  "analytics.get_insights": AnalyticsGetInsightsSchema,
  "analytics.get_stats": AnalyticsGetStatsSchema,
  "analytics.export": AnalyticsExportSchema,
  "analytics.create_report": AnalyticsCreateReportSchema,
  "discounts.create": DiscountsCreateSchema,
  "kds.get_overdue": KDSGetOverdueSchema,
  "kds.suggest_optimization": KDSSuggestOptimizationSchema,
  "navigation.go_to_page": NavigationGoToPageSchema,
} as const;

export type ToolName = keyof typeof TOOL_SCHEMAS;

// ============================================================================
// Discriminated Union for Tool Calls (Strict Schema for OpenAI)
// ============================================================================

export const ToolCallSchema = z.discriminatedUnion("name", [
  z
    .object({
      name: z.literal("menu.update_prices"),
      params: MenuUpdatePricesSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("menu.toggle_availability"),
      params: MenuToggleAvailabilitySchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("menu.create_item"),
      params: MenuCreateItemSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("menu.delete_item"),
      params: MenuDeleteItemSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("menu.translate"),
      params: MenuTranslateSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("inventory.adjust_stock"),
      params: InventoryAdjustStockSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("inventory.set_par_levels"),
      params: InventorySetParLevelsSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("inventory.generate_purchase_order"),
      params: InventoryGeneratePurchaseOrderSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("orders.mark_served"),
      params: OrdersMarkServedSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("orders.complete"),
      params: OrdersCompleteSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("analytics.get_insights"),
      params: AnalyticsGetInsightsSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("analytics.get_stats"),
      params: AnalyticsGetStatsSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("analytics.export"),
      params: AnalyticsExportSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("analytics.create_report"),
      params: AnalyticsCreateReportSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("discounts.create"),
      params: DiscountsCreateSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("kds.get_overdue"),
      params: KDSGetOverdueSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("kds.suggest_optimization"),
      params: KDSSuggestOptimizationSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("navigation.go_to_page"),
      params: NavigationGoToPageSchema,
      preview: z.boolean(),
    })
    .strict(),
]);

// Main Assistant Plan Schema
export const AssistantPlanSchema = z
  .object({
    intent: z.string().describe("High-level description of what the user wants"),
    tools: z.array(ToolCallSchema).describe("Ordered list of tool calls to execute"),
    reasoning: z.string().describe("Explanation of why this plan is safe and appropriate"),
    warnings: z
      .array(z.string())
      .nullable()
      .describe("Any warnings or considerations for the user"),
  })
  .strict();

// ============================================================================
// TypeScript Types
// ============================================================================

export type MenuUpdatePricesParams = z.infer<typeof MenuUpdatePricesSchema>;
export type MenuToggleAvailabilityParams = z.infer<typeof MenuToggleAvailabilitySchema>;
export type MenuCreateItemParams = z.infer<typeof MenuCreateItemSchema>;
export type MenuDeleteItemParams = z.infer<typeof MenuDeleteItemSchema>;
export type MenuTranslateParams = z.infer<typeof MenuTranslateSchema>;
export type InventoryAdjustStockParams = z.infer<typeof InventoryAdjustStockSchema>;
export type InventorySetParLevelsParams = z.infer<typeof InventorySetParLevelsSchema>;
export type InventoryGeneratePurchaseOrderParams = z.infer<
  typeof InventoryGeneratePurchaseOrderSchema
>;
export type OrdersMarkServedParams = z.infer<typeof OrdersMarkServedSchema>;
export type OrdersCompleteParams = z.infer<typeof OrdersCompleteSchema>;
export type AnalyticsGetInsightsParams = z.infer<typeof AnalyticsGetInsightsSchema>;
export type AnalyticsExportParams = z.infer<typeof AnalyticsExportSchema>;
export type AnalyticsGetStatsParams = z.infer<typeof AnalyticsGetStatsSchema>;
export type AnalyticsCreateReportParams = z.infer<typeof AnalyticsCreateReportSchema>;
export type DiscountsCreateParams = z.infer<typeof DiscountsCreateSchema>;
export type KDSGetOverdueParams = z.infer<typeof KDSGetOverdueSchema>;
export type KDSSuggestOptimizationParams = z.infer<typeof KDSSuggestOptimizationSchema>;
export type NavigationGoToPageParams = z.infer<typeof NavigationGoToPageSchema>;

// ============================================================================
// AI Assistant Request/Response Types
// ============================================================================

export interface AIAssistantContext {
  venueId: string;
  userId: string;
  userRole: string;
  venueTier: string;
  timezone: string;
  venueName: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  operatingHours: Record<string, { open: string; close: string; closed: boolean }> | null;
  features: {
    kdsEnabled: boolean;
    inventoryEnabled: boolean;
    analyticsEnabled: boolean;
  };
}

export interface AIToolCall {
  name: ToolName;
  params: Record<string, unknown>; // Will be validated against schema
  preview: boolean;
}

export interface AIPlanResponse {
  intent: string;
  tools: AIToolCall[];
  reasoning: string;
  warnings: string[] | null;
  directAnswer?: string; // For direct answers from data summaries
}

export interface AIPreviewDiff {
  toolName: ToolName;
  before: unknown;
  after: unknown;
  impact: {
    itemsAffected: number;
    categoriesAffected?: number;
    estimatedRevenue?: number;
    estimatedCost?: number;
    description: string;
  };
}

export interface AIExecutionResult {
  success: boolean;
  toolName: ToolName;
  result?: unknown;
  error?: string;
  auditId: string;
}

// ============================================================================
// Context Summaries (RAG Data)
// ============================================================================

export interface MenuSummary {
  totalItems: number;
  categories: Array<{
    id: string;
    name: string;
    itemCount: number;
  }>;
  topSellers: Array<{
    id: string;
    name: string;
    price: number;
    sales7d: number;
    revenue7d: number;
  }>;
  allItems: Array<{
    id: string;
    name: string;
    price: number;
    categoryId: string;
    categoryName: string;
  }>;
  avgPrice: number;
  priceRange: { min: number; max: number };
}

export interface InventorySummary {
  totalIngredients: number;
  lowStock: Array<{
    id: string;
    name: string;
    onHand: number;
    reorderLevel: number;
    unit: string;
  }>;
  outOfStock: string[];
  totalValue: number;
  reorderNeeded: boolean;
}

export interface OrdersSummary {
  liveOrders: number;
  overdueTickets: Array<{
    id: string;
    orderId: string;
    station: string;
    items: string[];
    minutesOverdue: number;
  }>;
  avgPrepTime: number;
  bottlenecks: Array<{
    station: string;
    avgWaitTime: number;
    ticketCount: number;
  }>;
}

export interface AnalyticsSummary {
  today: {
    revenue: number;
    orders: number;
    avgOrderValue: number;
  };
  trending: {
    topItems: string[];
    categoryPerformance: Record<string, number>;
  };
}

// ============================================================================
// Audit & Automation Types
// ============================================================================

export interface AIActionAudit {
  id: string;
  venueId: string;
  userId: string;
  userPrompt: string;
  intent: string;
  toolName: ToolName;
  params: Record<string, unknown>;
  preview: boolean;
  executed: boolean;
  result?: unknown;
  error?: string;
  contextHash?: string;
  modelVersion: string;
  executionTimeMs?: number;
  createdAt: string;
  executedAt?: string;
}

export interface AIAutomation {
  id: string;
  venueId: string;
  name: string;
  description?: string;
  triggerType: "cron" | "event" | "threshold";
  cronSchedule?: string;
  eventType?: string;
  thresholdConfig?: Record<string, unknown>;
  toolName: ToolName;
  params: Record<string, unknown>;
  enabled: boolean;
  lastRunAt?: string;
  lastResult?: unknown;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Guardrails & Permissions
// ============================================================================

export interface ToolGuardrails {
  maxPriceChangePercent?: number;
  maxDiscountPercent?: number;
  maxBulkOperationSize?: number;
  requiresManagerApproval?: boolean;
  blockedForRoles?: string[];
  minimumTier?: string;
}

export const DEFAULT_GUARDRAILS: Record<ToolName, ToolGuardrails> = {
  "menu.update_prices": {
    maxPriceChangePercent: 20,
    maxBulkOperationSize: 50,
  },
  "menu.toggle_availability": {
    maxBulkOperationSize: 100,
  },
  "menu.create_item": {
    maxBulkOperationSize: 10,
  },
  "menu.delete_item": {
    requiresManagerApproval: true,
  },
  "menu.translate": {
    /* Empty */
  },
  "inventory.adjust_stock": {
    maxBulkOperationSize: 50,
  },
  "inventory.set_par_levels": {
    requiresManagerApproval: true,
  },
  "inventory.generate_purchase_order": {
    /* Empty */
  },
  "orders.mark_served": {
    /* Empty */
  },
  "orders.complete": {
    /* Empty */
  },
  "analytics.get_insights": {
    /* Empty */
  },
  "analytics.get_stats": {
    /* Empty */
  },
  "analytics.export": {
    requiresManagerApproval: true,
  },
  "analytics.create_report": {
    requiresManagerApproval: true,
  },
  "discounts.create": {
    maxDiscountPercent: 30,
  },
  "kds.get_overdue": {
    /* Empty */
  },
  "kds.suggest_optimization": {
    /* Empty */
  },
  "navigation.go_to_page": {
    /* Empty */
  },
};

// ============================================================================
// Error Types
// ============================================================================

export class AIAssistantError extends Error {
  constructor(
    message: string,
    public code:
      | "UNAUTHORIZED"
      | "INVALID_PARAMS"
      | "GUARDRAIL_VIOLATION"
      | "EXECUTION_FAILED"
      | "RATE_LIMITED"
      | "TIER_RESTRICTED",
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AIAssistantError";
  }
}
