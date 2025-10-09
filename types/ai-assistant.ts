// Servio AI Assistant Types

import { z } from "zod";

// ============================================================================
// Tool Parameter Schemas (Zod for runtime validation)
// ============================================================================

// Menu Tools
export const MenuUpdatePricesSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid(),
      newPrice: z.number().positive(),
    })
  ),
  preview: z.boolean().default(true),
});

export const MenuToggleAvailabilitySchema = z.object({
  itemIds: z.array(z.string().uuid()),
  available: z.boolean(),
  reason: z.string().optional(),
});

export const MenuCreateItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  categoryId: z.string().uuid(),
  available: z.boolean().default(true),
  imageUrl: z.string().url().optional(),
  allergens: z.array(z.string()).optional(),
});

export const MenuDeleteItemSchema = z.object({
  itemId: z.string().uuid(),
  reason: z.string().optional(),
});

export const MenuTranslateSchema = z.object({
  targetLanguage: z.enum(["es", "ar", "fr", "de", "it", "pt", "zh", "ja"]),
  includeDescriptions: z.boolean().default(true),
});

// Inventory Tools
export const InventoryAdjustStockSchema = z.object({
  adjustments: z.array(
    z.object({
      ingredientId: z.string().uuid(),
      delta: z.number(),
      notes: z.string().optional(),
    })
  ),
  reason: z.enum(["receive", "adjust", "waste", "count"]),
  preview: z.boolean().default(true),
});

export const InventorySetParLevelsSchema = z.object({
  strategy: z.enum(["last_30_days", "last_7_days", "manual"]),
  bufferPercentage: z.number().min(0).max(100).default(20),
  preview: z.boolean().default(true),
});

export const InventoryGeneratePurchaseOrderSchema = z.object({
  threshold: z.enum(["reorder_level", "par_level"]),
  format: z.enum(["csv", "json", "pdf"]),
});

// Order Tools
export const OrdersMarkServedSchema = z.object({
  orderId: z.string().uuid(),
  notifyFOH: z.boolean().default(true),
});

export const OrdersCompleteSchema = z.object({
  orderId: z.string().uuid(),
  paymentMethod: z.string().optional(),
});

// Analytics Tools
export const AnalyticsGetInsightsSchema = z.object({
  metric: z.string(),
  timeRange: z.enum(["today", "week", "month", "quarter", "year", "custom"]),
  groupBy: z.enum(["day", "week", "month", "category", "item"]).optional(),
  customRange: z
    .object({
      start: z.string(),
      end: z.string(),
    })
    .optional(),
});

export const AnalyticsExportSchema = z.object({
  type: z.enum(["sales", "orders", "inventory", "customers"]),
  format: z.enum(["csv", "json", "pdf"]),
  filters: z.record(z.any()).optional(),
});

export const AnalyticsGetStatsSchema = z.object({
  metric: z.enum([
    "revenue", 
    "orders_count", 
    "avg_order_value", 
    "top_items", 
    "peak_hours",
    "customer_count",
    "table_turnover",
    "menu_performance"
  ]),
  timeRange: z.enum(["today", "yesterday", "week", "month", "quarter", "year"]),
  groupBy: z.enum(["hour", "day", "week", "month", "category", "item"]).optional(),
});

export const AnalyticsCreateReportSchema = z.object({
  name: z.string().min(1),
  metrics: z.array(z.string()),
  timeRange: z.enum(["today", "week", "month", "quarter", "year"]),
  format: z.enum(["pdf", "csv", "json"]),
  schedule: z.enum(["once", "daily", "weekly", "monthly"]).optional(),
});

// Discount Tools
export const DiscountsCreateSchema = z.object({
  name: z.string().min(1),
  scope: z.enum(["category", "item", "all"]),
  scopeId: z.string().uuid().optional(), // category or item id
  amountPct: z.number().min(0).max(100),
  startsAt: z.string(),
  endsAt: z.string().optional(),
});

// KDS Tools
export const KDSGetOverdueSchema = z.object({
  station: z.string().optional(),
  thresholdMinutes: z.number().positive().default(10),
});

export const KDSSuggestOptimizationSchema = z.object({
  timeRange: z.enum(["today", "week", "month"]),
  station: z.string().optional(),
});

// Navigation Tools
export const NavigationGoToPageSchema = z.object({
  page: z.enum([
    "dashboard",
    "menu",
    "inventory", 
    "orders",
    "live-orders",
    "kds",
    "kitchen-display",
    "qr-codes",
    "generate-qr",
    "analytics",
    "settings",
    "staff",
    "tables",
    "feedback"
  ]),
  venueId: z.string().optional(),
});

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
// TypeScript Types
// ============================================================================

export type MenuUpdatePricesParams = z.infer<typeof MenuUpdatePricesSchema>;
export type MenuToggleAvailabilityParams = z.infer<
  typeof MenuToggleAvailabilitySchema
>;
export type MenuCreateItemParams = z.infer<typeof MenuCreateItemSchema>;
export type MenuDeleteItemParams = z.infer<typeof MenuDeleteItemSchema>;
export type MenuTranslateParams = z.infer<typeof MenuTranslateSchema>;
export type InventoryAdjustStockParams = z.infer<
  typeof InventoryAdjustStockSchema
>;
export type InventorySetParLevelsParams = z.infer<
  typeof InventorySetParLevelsSchema
>;
export type InventoryGeneratePurchaseOrderParams = z.infer<
  typeof InventoryGeneratePurchaseOrderSchema
>;
export type OrdersMarkServedParams = z.infer<typeof OrdersMarkServedSchema>;
export type OrdersCompleteParams = z.infer<typeof OrdersCompleteSchema>;
export type AnalyticsGetInsightsParams = z.infer<
  typeof AnalyticsGetInsightsSchema
>;
export type AnalyticsExportParams = z.infer<typeof AnalyticsExportSchema>;
export type AnalyticsGetStatsParams = z.infer<typeof AnalyticsGetStatsSchema>;
export type AnalyticsCreateReportParams = z.infer<typeof AnalyticsCreateReportSchema>;
export type DiscountsCreateParams = z.infer<typeof DiscountsCreateSchema>;
export type KDSGetOverdueParams = z.infer<typeof KDSGetOverdueSchema>;
export type KDSSuggestOptimizationParams = z.infer<
  typeof KDSSuggestOptimizationSchema
>;
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
  features: {
    kdsEnabled: boolean;
    inventoryEnabled: boolean;
    analyticsEnabled: boolean;
  };
}

export interface AIToolCall {
  name: ToolName;
  params: any; // Will be validated against schema
  preview: boolean;
}

export interface AIPlanResponse {
  intent: string;
  tools: AIToolCall[];
  reasoning: string;
  warnings?: string[];
}

export interface AIPreviewDiff {
  toolName: ToolName;
  before: any;
  after: any;
  impact: {
    itemsAffected: number;
    estimatedRevenue?: number;
    estimatedCost?: number;
    description: string;
  };
}

export interface AIExecutionResult {
  success: boolean;
  toolName: ToolName;
  result?: any;
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
  params: any;
  preview: boolean;
  executed: boolean;
  result?: any;
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
  thresholdConfig?: any;
  toolName: ToolName;
  params: any;
  enabled: boolean;
  lastRunAt?: string;
  lastResult?: any;
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
  "menu.translate": {},
  "inventory.adjust_stock": {
    maxBulkOperationSize: 50,
  },
  "inventory.set_par_levels": {
    requiresManagerApproval: true,
  },
  "inventory.generate_purchase_order": {},
  "orders.mark_served": {},
  "orders.complete": {},
  "analytics.get_insights": {},
  "analytics.export": {
    requiresManagerApproval: true,
  },
  "discounts.create": {
    maxDiscountPercent: 30,
  },
  "kds.get_overdue": {},
  "kds.suggest_optimization": {},
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
    public details?: any
  ) {
    super(message);
    this.name = "AIAssistantError";
  }
}

