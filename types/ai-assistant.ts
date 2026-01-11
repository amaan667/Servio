// Servio AI Assistant Types

import { z } from "zod";

// ============================================================================
// Tool Parameter Schemas (Zod for runtime validation)
// ============================================================================

// Menu Tools
export const MenuUpdatePricesSchema = z
  .object({

        .strict()
    ),

  .strict();

export const MenuToggleAvailabilitySchema = z
  .object({

  .strict();

export const MenuCreateItemSchema = z
  .object({

    imageUrl: z.string().nullable().default(null), // Removed .url() - not supported by OpenAI strict mode

  .strict();

export const MenuDeleteItemSchema = z
  .object({

  .strict();

export const MenuTranslateSchema = z
  .object({
    targetLanguage: z.enum(["en", "es", "ar", "fr", "de", "it", "pt", "zh", "ja"]),

  .strict();

// ============================================================================
// Revenue Optimization Tools
// ============================================================================

export const RevenueAnalyzeMenuPerformanceSchema = z
  .object({
    timeRange: z.enum(["today", "week", "month", "quarter"]).default("week"),
    sortBy: z.enum(["revenue", "profit", "popularity", "margin"]).default("revenue"),

  .strict();

export const RevenueSuggestPriceOptimizationSchema = z
  .object({

    strategy: z.enum(["demand_based", "competitor_based", "margin_based", "all"]).default("all"),

  .strict();

export const RevenueIdentifyUpsellSchema = z
  .object({

    timeRange: z.enum(["week", "month", "quarter"]).default("month"),

  .strict();

export const RevenueCalculateMarginsSchema = z
  .object({
    itemIds: z.array(z.string().uuid()).nullable().default(null), // null = all items

  .strict();

export const RevenueForecastSchema = z
  .object({
    horizon: z.enum(["day", "week", "month"]).default("week"),
    confidence: z.enum(["low", "medium", "high"]).default("medium"),

  .strict();

export const RevenueIdentifyUnderperformersSchema = z
  .object({
    threshold: z.number().min(0).max(100).default(20), // Items below 20th percentile
    timeRange: z.enum(["week", "month", "quarter"]).default("month"),

  .strict();

// ============================================================================
// Operational Efficiency Tools
// ============================================================================

export const OpsAnalyzeKitchenBottlenecksSchema = z
  .object({
    timeRange: z.enum(["today", "week", "month"]).default("week"),

  .strict();

export const OpsOptimizeStaffScheduleSchema = z
  .object({
    targetDate: z.string(), // ISO date

  .strict();

export const OpsReduceWasteSchema = z
  .object({
    timeRange: z.enum(["week", "month", "quarter"]).default("month"),

  .strict();

export const OpsImproveTurnoverSchema = z
  .object({
    timeRange: z.enum(["today", "week", "month"]).default("week"),

  .strict();

export const OpsTrackAccuracySchema = z
  .object({
    timeRange: z.enum(["today", "week", "month"]).default("week"),
    errorType: z.enum(["wrong_item", "missing_item", "wrong_quantity", "all"]).default("all"),

  .strict();

// ============================================================================
// Customer Insights Tools
// ============================================================================

export const CustomerAnalyzeFeedbackSchema = z
  .object({
    timeRange: z.enum(["week", "month", "quarter", "year"]).default("month"),
    sentiment: z.enum(["positive", "negative", "neutral", "all"]).default("all"),

  .strict();

export const CustomerPopularCombosSchema = z
  .object({
    timeRange: z.enum(["week", "month", "quarter"]).default("month"),
    minSupport: z.number().min(0).max(100).default(10), // % of orders

  .strict();

export const CustomerRepeatAnalysisSchema = z
  .object({
    timeRange: z.enum(["month", "quarter", "year"]).default("quarter"),
    identifyBy: z.enum(["phone", "email", "both"]).default("phone"),

  .strict();

export const CustomerDemandForecastSchema = z
  .object({

    horizon: z.enum(["day", "week", "month"]).default("day"),

  .strict();

export const CustomerWaitTimesSchema = z
  .object({
    timeRange: z.enum(["today", "week", "month"]).default("week"),
    serviceType: z.enum(["table", "counter", "delivery", "all"]).default("all"),

  .strict();

// ============================================================================
// Inventory & Cost Control Tools
// ============================================================================

export const InventoryPredictNeedsSchema = z
  .object({
    horizon: z.enum(["day", "week", "month"]).default("week"),

    safetyStock: z.number().min(0).max(100).default(20), // %

  .strict();

export const InventoryWastePatternsSchema = z
  .object({
    timeRange: z.enum(["week", "month", "quarter"]).default("month"),

    minValue: z.number().min(0).nullable().default(null), // Min waste value to report

  .strict();

export const InventorySuggestParLevelsSchema = z
  .object({
    strategy: z.enum(["historical", "forecast", "hybrid"]).default("hybrid"),

  .strict();

export const InventoryCostPerDishSchema = z
  .object({

  .strict();

export const InventorySupplierTrackingSchema = z
  .object({

    timeRange: z.enum(["month", "quarter", "year"]).default("quarter"),
    alertOnIncrease: z.number().min(0).max(100).default(10), // Alert if >10% increase

  .strict();

// ============================================================================
// Marketing & Growth Tools
// ============================================================================

export const MarketingSuggestPromotionsSchema = z
  .object({
    goal: z.enum(["increase_revenue", "reduce_waste", "boost_slow_items", "acquire_customers"]),

    duration: z.enum(["day", "week", "month"]).default("week"),

  .strict();

export const MarketingRecommendItemsSchema = z
  .object({
    basedOn: z.enum(["trends", "gaps", "seasonality", "customer_requests", "all"]).default("all"),

  .strict();

export const MarketingSeasonalIdeasSchema = z
  .object({
    season: z.enum(["spring", "summer", "autumn", "winter", "current"]).default("current"),

  .strict();

export const MarketingCompetitorInsightsSchema = z
  .object({
    location: z.string().nullable().default(null), // lat,lng or address
    radius: z.number().positive().default(1), // miles/km
    focus: z.enum(["pricing", "menu", "reviews", "all"]).default("all"),

  .strict();

export const MarketingLoyaltyAnalysisSchema = z
  .object({
    timeRange: z.enum(["month", "quarter", "year"]).default("quarter"),
    segmentBy: z.enum(["frequency", "value", "recency", "all"]).default("all"),

  .strict();

// ============================================================================
// Smart Automation Tools
// ============================================================================

export const AutoBulkMenuUpdateSchema = z
  .object({

      "price_decrease",
      "toggle_availability",
      "update_category",
    ]),

          .nullable()
          .default(null),

      .strict(),
    value: z.union([z.number(), z.string(), z.boolean()]), // Depends on operation

  .strict();

export const AutoReorderInventorySchema = z
  .object({
    mode: z.enum(["auto", "suggest"]).default("suggest"),
    threshold: z.enum(["par_level", "reorder_point"]).default("reorder_point"),

  .strict();

export const AutoGenerateReportSchema = z
  .object({
    reportType: z.enum(["daily_summary", "weekly_performance", "monthly_financials", "custom"]),

      .array(z.enum(["revenue", "costs", "inventory", "customer", "operations"]))
      .default(["revenue", "costs"]),
    format: z.enum(["pdf", "excel", "email"]).default("pdf"),
    schedule: z.enum(["now", "daily", "weekly", "monthly"]).default("now"),

  .strict();

export const AutoScheduleMenuChangesSchema = z
  .object({

          action: z.enum(["enable", "disable", "update_price"]),
          value: z.union([z.boolean(), z.number()]).nullable().default(null),
          startTime: z.string(), // ISO datetime

        .strict()
    ),
    recurring: z.enum(["once", "daily", "weekly", "weekdays", "weekends"]).default("once"),

  .strict();

export const AutoTranslateFeedbackSchema = z
  .object({
    feedbackIds: z.array(z.string().uuid()).nullable().default(null), // null = all untranslated

  .strict();

export const AutoDynamicPricingSchema = z
  .object({

    strategy: z.enum(["time_based", "demand_based", "inventory_based", "hybrid"]),
    maxAdjustment: z.number().min(0).max(50).default(20), // Max % change

  .strict();

// Inventory Tools
export const InventoryAdjustStockSchema = z
  .object({

        .strict()
    ),
    reason: z.enum(["receive", "adjust", "waste", "count"]),

  .strict();

export const InventorySetParLevelsSchema = z
  .object({
    strategy: z.enum(["last_30_days", "last_7_days", "manual"]),

  .strict();

export const InventoryGeneratePurchaseOrderSchema = z
  .object({
    threshold: z.enum(["reorder_level", "par_level"]),
    format: z.enum(["csv", "json", "pdf"]),

  .strict();

// Order Tools
export const OrdersMarkServedSchema = z
  .object({

  .strict();

export const OrdersCompleteSchema = z
  .object({

  .strict();

// Analytics Tools
export const AnalyticsGetInsightsSchema = z
  .object({

    timeRange: z.enum(["today", "week", "month", "quarter", "year", "custom"]),
    groupBy: z.enum(["day", "week", "month", "category", "item"]).nullable().default(null),

      .strict()
      .nullable()
      .default(null),
    itemId: z.string().uuid().nullable().default(null), // Filter by specific item
    itemName: z.string().nullable().default(null), // Item name for context in response

  .strict();

export const AnalyticsExportSchema = z
  .object({
    type: z.enum(["sales", "orders", "inventory", "customers"]),
    format: z.enum(["csv", "json", "pdf"]),

      .default(null), // No more z.record - strict empty object for flexible filters

  .strict();

export const AnalyticsGetStatsSchema = z
  .object({

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

  .strict();

export const AnalyticsCreateReportSchema = z
  .object({

    timeRange: z.enum(["today", "week", "month", "quarter", "year"]),
    format: z.enum(["pdf", "csv", "json"]),
    schedule: z.enum(["once", "daily", "weekly", "monthly"]).default("once"),

  .strict();

// Discount Tools
export const DiscountsCreateSchema = z
  .object({

    scope: z.enum(["category", "item", "all"]),
    scopeId: z.string().uuid().nullable().default(null), // category or item id

  .strict();

// KDS Tools
export const KDSGetOverdueSchema = z
  .object({

  .strict();

export const KDSSuggestOptimizationSchema = z
  .object({
    timeRange: z.enum(["today", "week", "month"]),

  .strict();

// Navigation Tools
export const NavigationGoToPageSchema = z
  .object({

      "menu",
      "inventory",
      "orders",
      "live-orders",
      "kds",
      "kitchen-display",
      "qr",
      "qr-codes",
      "analytics",
      "settings",
      "staff",
      "tables",
      "feedback",
    ]),

      .enum(["view", "edit", "upload_image"])
      .nullable()
      .default(null)
      .describe("Specific action to perform on the item"),

      .describe("Table name for QR code generation (e.g., 'Table 6')"),

      .describe("Counter name for QR code generation (e.g., 'Counter 1')"),

      .describe("Prefix for bulk QR code generation (e.g., 'Table', 'VIP', 'Counter')"),

      .enum(["table", "counter"])
      .nullable()
      .default(null)
      .describe("Type for bulk generation: 'table' or 'counter'"),

  .strict();

// ============================================================================
// QR Code Tools
// ============================================================================

export const QRGenerateTableSchema = z
  .object({

  .strict();

export const QRGenerateBulkSchema = z
  .object({

    prefix: z.string().nullable().default(null).describe("Prefix for QR code labels (e.g., 'Table', 'VIP', 'Counter'). Defaults to 'Table'"),
    type: z.enum(["table", "counter"]).nullable().default(null).describe("Type of QR codes to generate. Defaults to 'table'"),

  .strict();

export const QRGenerateCounterSchema = z
  .object({

  .strict();

export const QRListAllSchema = z.object({}).strict();

export const QRExportPDFSchema = z.object({}).strict();

// ============================================================================
// Extended Menu Tools
// ============================================================================

export const MenuQueryNoImagesSchema = z.object({}).strict();

export const MenuUploadImageSchema = z
  .object({

  .strict();

export const MenuTranslateExtendedSchema = z
  .object({

  .strict();

// ============================================================================
// Extended Order Tools
// ============================================================================

export const OrderUpdateStatusSchema = z
  .object({

  .strict();

export const OrdersGetKitchenSchema = z.object({}).strict();

export const OrdersGetOverdueSchema = z
  .object({

  .strict();

export const OrdersGetPendingSchema = z.object({}).strict();

export const OrdersGetTodayStatsSchema = z.object({}).strict();

// ============================================================================
// Table Management Tools
// ============================================================================

export const TableGetAvailabilitySchema = z.object({}).strict();

export const TableCreateSchema = z
  .object({

  .strict();

export const TableMergeSchema = z
  .object({

  .strict();

export const TableGetActiveOrdersSchema = z.object({}).strict();

export const TableGetRevenueSchema = z.object({}).strict();

// ============================================================================
// Staff Management Tools
// ============================================================================

export const StaffListSchema = z.object({}).strict();

export const StaffInviteSchema = z
  .object({

    role: z.enum(["manager", "server"]),

  .strict();

export const StaffGetRolesSchema = z.object({}).strict();

export const StaffGetScheduleSchema = z.object({}).strict();

export const StaffGetPerformanceSchema = z
  .object({
    timeRange: z.enum(["week", "month"]).default("week"),

  .strict();

// ============================================================================
// Extended KDS Tools
// ============================================================================

export const KDSGetStationTicketsSchema = z
  .object({

  .strict();

export const KDSBulkUpdateSchema = z
  .object({

  .strict();

export const KDSGetOverdueExtendedSchema = z
  .object({

  .strict();

export const KDSGetPrepTimesSchema = z.object({}).strict();

// ============================================================================
// Extended Inventory Tools
// ============================================================================

export const InventoryAdjustStockExtendedSchema = z
  .object({

  .strict();

export const InventoryGetLowStockSchema = z.object({}).strict();

export const InventoryGeneratePOSchema = z.object({}).strict();

export const InventoryGetLevelsSchema = z.object({}).strict();

// ============================================================================
// Tool Registry
// ============================================================================

export const TOOL_SCHEMAS = {
  // Menu Tools
  "menu.update_prices": MenuUpdatePricesSchema,
  "menu.toggle_availability": MenuToggleAvailabilitySchema,
  "menu.create_item": MenuCreateItemSchema,
  "menu.delete_item": MenuDeleteItemSchema,
  "menu.translate": MenuTranslateSchema,

  // Revenue Optimization Tools
  "revenue.analyze_menu_performance": RevenueAnalyzeMenuPerformanceSchema,
  "revenue.suggest_price_optimization": RevenueSuggestPriceOptimizationSchema,
  "revenue.identify_upsell": RevenueIdentifyUpsellSchema,
  "revenue.calculate_margins": RevenueCalculateMarginsSchema,
  "revenue.forecast": RevenueForecastSchema,
  "revenue.identify_underperformers": RevenueIdentifyUnderperformersSchema,

  // Operational Efficiency Tools
  "ops.analyze_kitchen_bottlenecks": OpsAnalyzeKitchenBottlenecksSchema,
  "ops.optimize_staff_schedule": OpsOptimizeStaffScheduleSchema,
  "ops.reduce_waste": OpsReduceWasteSchema,
  "ops.improve_turnover": OpsImproveTurnoverSchema,
  "ops.track_accuracy": OpsTrackAccuracySchema,

  // Customer Insights Tools
  "customer.analyze_feedback": CustomerAnalyzeFeedbackSchema,
  "customer.popular_combos": CustomerPopularCombosSchema,
  "customer.repeat_analysis": CustomerRepeatAnalysisSchema,
  "customer.demand_forecast": CustomerDemandForecastSchema,
  "customer.wait_times": CustomerWaitTimesSchema,

  // Inventory & Cost Control Tools
  "inventory.adjust_stock": InventoryAdjustStockSchema,
  "inventory.set_par_levels": InventorySetParLevelsSchema,
  "inventory.generate_purchase_order": InventoryGeneratePurchaseOrderSchema,
  "inventory.predict_needs": InventoryPredictNeedsSchema,
  "inventory.waste_patterns": InventoryWastePatternsSchema,
  "inventory.suggest_par_levels": InventorySuggestParLevelsSchema,
  "inventory.cost_per_dish": InventoryCostPerDishSchema,
  "inventory.supplier_tracking": InventorySupplierTrackingSchema,

  // Marketing & Growth Tools
  "marketing.suggest_promotions": MarketingSuggestPromotionsSchema,
  "marketing.recommend_items": MarketingRecommendItemsSchema,
  "marketing.seasonal_ideas": MarketingSeasonalIdeasSchema,
  "marketing.competitor_insights": MarketingCompetitorInsightsSchema,
  "marketing.loyalty_analysis": MarketingLoyaltyAnalysisSchema,

  // Smart Automation Tools
  "auto.bulk_menu_update": AutoBulkMenuUpdateSchema,
  "auto.reorder_inventory": AutoReorderInventorySchema,
  "auto.generate_report": AutoGenerateReportSchema,
  "auto.schedule_menu_changes": AutoScheduleMenuChangesSchema,
  "auto.translate_feedback": AutoTranslateFeedbackSchema,
  "auto.dynamic_pricing": AutoDynamicPricingSchema,

  // Orders Tools
  "orders.mark_served": OrdersMarkServedSchema,
  "orders.complete": OrdersCompleteSchema,

  // Analytics Tools
  "analytics.get_insights": AnalyticsGetInsightsSchema,
  "analytics.get_stats": AnalyticsGetStatsSchema,
  "analytics.export": AnalyticsExportSchema,
  "analytics.create_report": AnalyticsCreateReportSchema,

  // Discount Tools
  "discounts.create": DiscountsCreateSchema,

  // KDS Tools
  "kds.get_overdue": KDSGetOverdueSchema,
  "kds.suggest_optimization": KDSSuggestOptimizationSchema,

  // Navigation Tools
  "navigation.go_to_page": NavigationGoToPageSchema,

  // QR Code Tools
  "qr.generate_table": QRGenerateTableSchema,
  "qr.generate_bulk": QRGenerateBulkSchema,
  "qr.generate_counter": QRGenerateCounterSchema,
  "qr.list_all": QRListAllSchema,
  "qr.export_pdf": QRExportPDFSchema,

  // Extended Menu Tools
  "menu.query_no_images": MenuQueryNoImagesSchema,
  "menu.upload_image": MenuUploadImageSchema,
  "menu.translate_extended": MenuTranslateExtendedSchema,

  // Extended Order Tools
  "orders.update_status": OrderUpdateStatusSchema,
  "orders.get_kitchen": OrdersGetKitchenSchema,
  "orders.get_overdue": OrdersGetOverdueSchema,
  "orders.get_pending": OrdersGetPendingSchema,
  "orders.get_today_stats": OrdersGetTodayStatsSchema,

  // Table Management Tools
  "tables.get_availability": TableGetAvailabilitySchema,
  "tables.create": TableCreateSchema,
  "tables.merge": TableMergeSchema,
  "tables.get_active_orders": TableGetActiveOrdersSchema,
  "tables.get_revenue": TableGetRevenueSchema,

  // Staff Management Tools
  "staff.list": StaffListSchema,
  "staff.invite": StaffInviteSchema,
  "staff.get_roles": StaffGetRolesSchema,
  "staff.get_schedule": StaffGetScheduleSchema,
  "staff.get_performance": StaffGetPerformanceSchema,

  // Extended KDS Tools
  "kds.get_station_tickets": KDSGetStationTicketsSchema,
  "kds.bulk_update": KDSBulkUpdateSchema,
  "kds.get_overdue_extended": KDSGetOverdueExtendedSchema,
  "kds.get_prep_times": KDSGetPrepTimesSchema,

  // Extended Inventory Tools
  "inventory.adjust_stock_extended": InventoryAdjustStockExtendedSchema,
  "inventory.get_low_stock": InventoryGetLowStockSchema,
  "inventory.generate_po": InventoryGeneratePOSchema,
  "inventory.get_levels": InventoryGetLevelsSchema,
} as const;

export type ToolName = keyof typeof TOOL_SCHEMAS;

// ============================================================================
// Discriminated Union for Tool Calls (Strict Schema for OpenAI)
// ============================================================================

export const ToolCallSchema = z.discriminatedUnion("name", [
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  // QR Code Tools
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  // Extended Menu Tools
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  // Extended Order Tools
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  // Table Management Tools
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  // Staff Management Tools
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  // Extended KDS Tools
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  // Extended Inventory Tools
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
  z
    .object({

    .strict(),
]);

// Main Assistant Plan Schema
export const AssistantPlanSchema = z
  .object({

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

  operatingHours: Record<string, { open: string; close: string; closed: boolean }> | null;

  };
}

export interface AIToolCall {

  params: Record<string, unknown>; // Will be validated against schema

}

export interface AIPlanResponse {

}

export interface AIPreviewDiff {

  };
}

export interface AIExecutionResult {

}

// ============================================================================
// Context Summaries (RAG Data)
// ============================================================================

export interface MenuSummary {

  }>;

  }>;

  }>;

  priceRange: { min: number; max: number };

}

export interface InventorySummary {

  }>;

}

export interface OrdersSummary {

  }>;

  }>;
}

export interface AnalyticsSummary {

  };

  };

  };

  };

  };

    topItems: Array<{ name: string; count: number; revenue: number }>;
    categoryPerformance: Record<string, { revenue: number; orders: number; itemCount: number }>;
  };

  };

    byDayOfWeek: Array<{ day: string; revenue: number; orders: number; avgOrderValue: number }>;
    byHour: Array<{ hour: number; revenue: number; orders: number }>;
    peakHours: Array<{ hour: number; orderCount: number }>;

  };
  paymentMethods: Record<string, { count: number; revenue: number }>;

    takeawayVsDineIn: { takeaway: number; dineIn: number };
    avgPreparationTime?: number;
  };

    rarelyOrdered: Array<{ name: string; count: number }>;
    topByRevenue: Array<{ name: string; revenue: number; count: number }>;
  };
  tableMetrics?: {

    revenueByTable: Array<{ tableNumber: number; revenue: number; sessions: number }>;
  };
}

// ============================================================================
// Audit & Automation Types
// ============================================================================

export interface AIActionAudit {

  params: Record<string, unknown>;

}

export interface AIAutomation {

  thresholdConfig?: Record<string, unknown>;

  params: Record<string, unknown>;

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

  },
  "menu.toggle_availability": {

  },
  "menu.create_item": {

  },
  "menu.delete_item": {

  },
  "menu.translate": {
    /* Empty */
  },
  "inventory.adjust_stock": {

  },
  "inventory.set_par_levels": {

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

  },
  "analytics.create_report": {

  },
  "discounts.create": {

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
  // REVENUE & ANALYTICS GUARDRAILS
  "revenue.analyze_menu_performance": {
    /* Empty */
  },
  "revenue.suggest_price_optimization": {

  },
  "revenue.identify_upsell": {
    /* Empty */
  },
  "revenue.calculate_margins": {
    /* Empty */
  },
  "revenue.identify_underperformers": {
    /* Empty */
  },
  // REVENUE GUARDRAILS (continued)
  "revenue.forecast": {
    /* Empty */
  },
  // OPERATIONS GUARDRAILS
  "ops.analyze_kitchen_bottlenecks": {
    /* Empty */
  },
  "ops.optimize_staff_schedule": {
    /* Empty */
  },
  "ops.reduce_waste": {
    /* Empty */
  },
  "ops.improve_turnover": {
    /* Empty */
  },
  "ops.track_accuracy": {
    /* Empty */
  },
  // CUSTOMER INSIGHTS GUARDRAILS
  "customer.analyze_feedback": {
    /* Empty */
  },
  "customer.popular_combos": {
    /* Empty */
  },
  "customer.repeat_analysis": {
    /* Empty */
  },
  "customer.demand_forecast": {
    /* Empty */
  },
  "customer.wait_times": {
    /* Empty */
  },
  // INVENTORY GUARDRAILS (continued for new tools)
  "inventory.predict_needs": {
    /* Empty */
  },
  "inventory.waste_patterns": {
    /* Empty */
  },
  "inventory.suggest_par_levels": {
    /* Empty */
  },
  "inventory.cost_per_dish": {
    /* Empty */
  },
  "inventory.supplier_tracking": {
    /* Empty */
  },
  // MARKETING GUARDRAILS
  "marketing.suggest_promotions": {

  },
  "marketing.recommend_items": {
    /* Empty */
  },
  "marketing.seasonal_ideas": {
    /* Empty */
  },
  "marketing.competitor_insights": {
    /* Empty */
  },
  "marketing.loyalty_analysis": {
    /* Empty */
  },
  // AUTOMATION GUARDRAILS
  "auto.bulk_menu_update": {

  },
  "auto.reorder_inventory": {

  },
  "auto.generate_report": {
    /* Empty */
  },
  "auto.schedule_menu_changes": {

  },
  "auto.translate_feedback": {
    /* Empty */
  },
  "auto.dynamic_pricing": {

  },
  // QR CODE GUARDRAILS
  "qr.generate_table": {
    /* Empty */
  },
  "qr.generate_bulk": {

  },
  "qr.generate_counter": {
    /* Empty */
  },
  "qr.list_all": {
    /* Empty */
  },
  "qr.export_pdf": {
    /* Empty */
  },
  // EXTENDED MENU GUARDRAILS
  "menu.query_no_images": {
    /* Empty */
  },
  "menu.upload_image": {
    /* Empty */
  },
  "menu.translate_extended": {
    /* Empty */
  },
  // EXTENDED ORDER GUARDRAILS
  "orders.update_status": {
    /* Empty */
  },
  "orders.get_kitchen": {
    /* Empty */
  },
  "orders.get_overdue": {
    /* Empty */
  },
  "orders.get_pending": {
    /* Empty */
  },
  "orders.get_today_stats": {
    /* Empty */
  },
  // TABLE MANAGEMENT GUARDRAILS
  "tables.get_availability": {
    /* Empty */
  },
  "tables.create": {

  },
  "tables.merge": {

  },
  "tables.get_active_orders": {
    /* Empty */
  },
  "tables.get_revenue": {
    /* Empty */
  },
  // STAFF MANAGEMENT GUARDRAILS
  "staff.list": {
    /* Empty */
  },
  "staff.invite": {

  },
  "staff.get_roles": {
    /* Empty */
  },
  "staff.get_schedule": {
    /* Empty */
  },
  "staff.get_performance": {
    /* Empty */
  },
  // EXTENDED KDS GUARDRAILS
  "kds.get_station_tickets": {
    /* Empty */
  },
  "kds.bulk_update": {

  },
  "kds.get_overdue_extended": {
    /* Empty */
  },
  "kds.get_prep_times": {
    /* Empty */
  },
  // EXTENDED INVENTORY GUARDRAILS
  "inventory.adjust_stock_extended": {

  },
  "inventory.get_low_stock": {
    /* Empty */
  },
  "inventory.generate_po": {
    /* Empty */
  },
  "inventory.get_levels": {
    /* Empty */
  },
};

// ============================================================================
// Error Types
// ============================================================================

export class AIAssistantError extends Error {
  constructor(

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
