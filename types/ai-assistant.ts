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
    targetLanguage: z.enum(["en", "es", "ar", "fr", "de", "it", "pt", "zh", "ja"]),
    includeDescriptions: z.boolean().default(true),
  })
  .strict();

// ============================================================================
// Revenue Optimization Tools
// ============================================================================

export const RevenueAnalyzeMenuPerformanceSchema = z
  .object({
    timeRange: z.enum(["today", "week", "month", "quarter"]).default("week"),
    sortBy: z.enum(["revenue", "profit", "popularity", "margin"]).default("revenue"),
    limit: z.number().positive().default(10),
  })
  .strict();

export const RevenueSuggestPriceOptimizationSchema = z
  .object({
    itemId: z.string().uuid().nullable().default(null),
    strategy: z.enum(["demand_based", "competitor_based", "margin_based", "all"]).default("all"),
    targetMargin: z.number().min(0).max(100).nullable().default(null),
  })
  .strict();

export const RevenueIdentifyUpsellSchema = z
  .object({
    minConfidence: z.number().min(0).max(100).default(70),
    timeRange: z.enum(["week", "month", "quarter"]).default("month"),
  })
  .strict();

export const RevenueCalculateMarginsSchema = z
  .object({
    itemIds: z.array(z.string().uuid()).nullable().default(null), // null = all items
    includeWaste: z.boolean().default(true),
  })
  .strict();

export const RevenueForecastSchema = z
  .object({
    horizon: z.enum(["day", "week", "month"]).default("week"),
    confidence: z.enum(["low", "medium", "high"]).default("medium"),
  })
  .strict();

export const RevenueIdentifyUnderperformersSchema = z
  .object({
    threshold: z.number().min(0).max(100).default(20), // Items below 20th percentile
    timeRange: z.enum(["week", "month", "quarter"]).default("month"),
    minSampleSize: z.number().positive().default(10),
  })
  .strict();

// ============================================================================
// Operational Efficiency Tools
// ============================================================================

export const OpsAnalyzeKitchenBottlenecksSchema = z
  .object({
    timeRange: z.enum(["today", "week", "month"]).default("week"),
    station: z.string().nullable().default(null),
  })
  .strict();

export const OpsOptimizeStaffScheduleSchema = z
  .object({
    targetDate: z.string(), // ISO date
    considerPeakHours: z.boolean().default(true),
    laborBudget: z.number().positive().nullable().default(null),
  })
  .strict();

export const OpsReduceWasteSchema = z
  .object({
    timeRange: z.enum(["week", "month", "quarter"]).default("month"),
    category: z.string().nullable().default(null),
  })
  .strict();

export const OpsImproveTurnoverSchema = z
  .object({
    timeRange: z.enum(["today", "week", "month"]).default("week"),
    targetTurnover: z.number().positive().nullable().default(null),
  })
  .strict();

export const OpsTrackAccuracySchema = z
  .object({
    timeRange: z.enum(["today", "week", "month"]).default("week"),
    errorType: z.enum(["wrong_item", "missing_item", "wrong_quantity", "all"]).default("all"),
  })
  .strict();

// ============================================================================
// Customer Insights Tools
// ============================================================================

export const CustomerAnalyzeFeedbackSchema = z
  .object({
    timeRange: z.enum(["week", "month", "quarter", "year"]).default("month"),
    sentiment: z.enum(["positive", "negative", "neutral", "all"]).default("all"),
    minRating: z.number().min(1).max(5).nullable().default(null),
  })
  .strict();

export const CustomerPopularCombosSchema = z
  .object({
    timeRange: z.enum(["week", "month", "quarter"]).default("month"),
    minSupport: z.number().min(0).max(100).default(10), // % of orders
  })
  .strict();

export const CustomerRepeatAnalysisSchema = z
  .object({
    timeRange: z.enum(["month", "quarter", "year"]).default("quarter"),
    identifyBy: z.enum(["phone", "email", "both"]).default("phone"),
  })
  .strict();

export const CustomerDemandForecastSchema = z
  .object({
    itemId: z.string().uuid().nullable().default(null),
    horizon: z.enum(["day", "week", "month"]).default("day"),
    includeWeather: z.boolean().default(false),
  })
  .strict();

export const CustomerWaitTimesSchema = z
  .object({
    timeRange: z.enum(["today", "week", "month"]).default("week"),
    serviceType: z.enum(["table", "counter", "delivery", "all"]).default("all"),
  })
  .strict();

// ============================================================================
// Inventory & Cost Control Tools
// ============================================================================

export const InventoryPredictNeedsSchema = z
  .object({
    horizon: z.enum(["day", "week", "month"]).default("week"),
    considerSeasonality: z.boolean().default(true),
    safetyStock: z.number().min(0).max(100).default(20), // %
  })
  .strict();

export const InventoryWastePatternsSchema = z
  .object({
    timeRange: z.enum(["week", "month", "quarter"]).default("month"),
    category: z.string().nullable().default(null),
    minValue: z.number().min(0).nullable().default(null), // Min waste value to report
  })
  .strict();

export const InventorySuggestParLevelsSchema = z
  .object({
    strategy: z.enum(["historical", "forecast", "hybrid"]).default("hybrid"),
    confidenceLevel: z.number().min(0).max(100).default(95),
  })
  .strict();

export const InventoryCostPerDishSchema = z
  .object({
    itemIds: z.array(z.string().uuid()).nullable().default(null),
    includeLabor: z.boolean().default(false),
    includeOverhead: z.boolean().default(false),
  })
  .strict();

export const InventorySupplierTrackingSchema = z
  .object({
    supplierId: z.string().uuid().nullable().default(null),
    timeRange: z.enum(["month", "quarter", "year"]).default("quarter"),
    alertOnIncrease: z.number().min(0).max(100).default(10), // Alert if >10% increase
  })
  .strict();

// ============================================================================
// Marketing & Growth Tools
// ============================================================================

export const MarketingSuggestPromotionsSchema = z
  .object({
    goal: z.enum(["increase_revenue", "reduce_waste", "boost_slow_items", "acquire_customers"]),
    budget: z.number().positive().nullable().default(null),
    duration: z.enum(["day", "week", "month"]).default("week"),
  })
  .strict();

export const MarketingRecommendItemsSchema = z
  .object({
    basedOn: z.enum(["trends", "gaps", "seasonality", "customer_requests", "all"]).default("all"),
    category: z.string().nullable().default(null),
    targetMargin: z.number().min(0).max(100).nullable().default(null),
  })
  .strict();

export const MarketingSeasonalIdeasSchema = z
  .object({
    season: z.enum(["spring", "summer", "autumn", "winter", "current"]).default("current"),
    includeLocalEvents: z.boolean().default(true),
  })
  .strict();

export const MarketingCompetitorInsightsSchema = z
  .object({
    location: z.string().nullable().default(null), // lat,lng or address
    radius: z.number().positive().default(1), // miles/km
    focus: z.enum(["pricing", "menu", "reviews", "all"]).default("all"),
  })
  .strict();

export const MarketingLoyaltyAnalysisSchema = z
  .object({
    timeRange: z.enum(["month", "quarter", "year"]).default("quarter"),
    segmentBy: z.enum(["frequency", "value", "recency", "all"]).default("all"),
  })
  .strict();

// ============================================================================
// Smart Automation Tools
// ============================================================================

export const AutoBulkMenuUpdateSchema = z
  .object({
    operation: z.enum([
      "price_increase",
      "price_decrease",
      "toggle_availability",
      "update_category",
    ]),
    filter: z
      .object({
        category: z.string().nullable().default(null),
        priceRange: z
          .object({
            min: z.number().nullable().default(null),
            max: z.number().nullable().default(null),
          })
          .nullable()
          .default(null),
      })
      .strict(),
    value: z.union([z.number(), z.string(), z.boolean()]), // Depends on operation
    preview: z.boolean().default(true),
  })
  .strict();

export const AutoReorderInventorySchema = z
  .object({
    mode: z.enum(["auto", "suggest"]).default("suggest"),
    threshold: z.enum(["par_level", "reorder_point"]).default("reorder_point"),
    autoApprove: z.boolean().default(false),
  })
  .strict();

export const AutoGenerateReportSchema = z
  .object({
    reportType: z.enum(["daily_summary", "weekly_performance", "monthly_financials", "custom"]),
    sections: z
      .array(z.enum(["revenue", "costs", "inventory", "customer", "operations"]))
      .default(["revenue", "costs"]),
    format: z.enum(["pdf", "excel", "email"]).default("pdf"),
    schedule: z.enum(["now", "daily", "weekly", "monthly"]).default("now"),
  })
  .strict();

export const AutoScheduleMenuChangesSchema = z
  .object({
    changes: z.array(
      z
        .object({
          itemId: z.string().uuid(),
          action: z.enum(["enable", "disable", "update_price"]),
          value: z.union([z.boolean(), z.number()]).nullable().default(null),
          startTime: z.string(), // ISO datetime
          endTime: z.string().nullable().default(null),
        })
        .strict()
    ),
    recurring: z.enum(["once", "daily", "weekly", "weekdays", "weekends"]).default("once"),
  })
  .strict();

export const AutoTranslateFeedbackSchema = z
  .object({
    feedbackIds: z.array(z.string().uuid()).nullable().default(null), // null = all untranslated
    targetLanguage: z.string().default("en"),
  })
  .strict();

export const AutoDynamicPricingSchema = z
  .object({
    enable: z.boolean(),
    strategy: z.enum(["time_based", "demand_based", "inventory_based", "hybrid"]),
    maxAdjustment: z.number().min(0).max(50).default(20), // Max % change
    itemIds: z.array(z.string().uuid()).nullable().default(null),
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
      "qr",
      "qr-codes",
      "analytics",
      "settings",
      "staff",
      "tables",
      "feedback",
    ]),
    venueId: z.string().nullable().default(null),
    itemId: z
      .string()
      .uuid()
      .nullable()
      .default(null)
      .describe("Menu item ID for item-specific navigation"),
    itemName: z.string().nullable().default(null).describe("Menu item name for context"),
    action: z
      .enum(["view", "edit", "upload_image"])
      .nullable()
      .default(null)
      .describe("Specific action to perform on the item"),
    table: z
      .string()
      .nullable()
      .default(null)
      .describe("Table name for QR code generation (e.g., 'Table 6')"),
    counter: z
      .string()
      .nullable()
      .default(null)
      .describe("Counter name for QR code generation (e.g., 'Counter 1')"),
    bulkPrefix: z
      .string()
      .nullable()
      .default(null)
      .describe("Prefix for bulk QR code generation (e.g., 'Table', 'VIP', 'Counter')"),
    bulkCount: z
      .number()
      .nullable()
      .default(null)
      .describe("Number of QR codes to generate in bulk (1-100)"),
    bulkType: z
      .enum(["table", "counter"])
      .nullable()
      .default(null)
      .describe("Type for bulk generation: 'table' or 'counter'"),
  })
  .strict();

// ============================================================================
// QR Code Tools
// ============================================================================

export const QRGenerateTableSchema = z
  .object({
    tableLabel: z.string().min(1),
  })
  .strict();

export const QRGenerateBulkSchema = z
  .object({
    startNumber: z.number().int().min(1),
    endNumber: z.number().int().min(1),
    prefix: z.string().optional().describe("Prefix for QR code labels (e.g., 'Table', 'VIP', 'Counter'). Defaults to 'Table'"),
    type: z.enum(["table", "counter"]).optional().describe("Type of QR codes to generate. Defaults to 'table'"),
  })
  .strict();

export const QRGenerateCounterSchema = z
  .object({
    counterLabel: z.string().min(1),
  })
  .strict();

export const QRListAllSchema = z.object({}).strict();

export const QRExportPDFSchema = z.object({}).strict();

// ============================================================================
// Extended Menu Tools
// ============================================================================

export const MenuQueryNoImagesSchema = z.object({}).strict();

export const MenuUploadImageSchema = z
  .object({
    itemName: z.string().min(1),
    imageUrl: z.string().min(1),
  })
  .strict();

export const MenuTranslateExtendedSchema = z
  .object({
    targetLanguage: z.string().min(2),
    categories: z.array(z.string()).nullable().default(null),
  })
  .strict();

// ============================================================================
// Extended Order Tools
// ============================================================================

export const OrderUpdateStatusSchema = z
  .object({
    orderId: z.string().uuid(),
    newStatus: z.string().min(1),
  })
  .strict();

export const OrdersGetKitchenSchema = z.object({}).strict();

export const OrdersGetOverdueSchema = z
  .object({
    thresholdMinutes: z.number().int().positive().default(20),
  })
  .strict();

export const OrdersGetPendingSchema = z.object({}).strict();

export const OrdersGetTodayStatsSchema = z.object({}).strict();

// ============================================================================
// Table Management Tools
// ============================================================================

export const TableGetAvailabilitySchema = z.object({}).strict();

export const TableCreateSchema = z
  .object({
    tableLabel: z.string().min(1),
    seats: z.number().int().positive().default(4),
  })
  .strict();

export const TableMergeSchema = z
  .object({
    tableIds: z.array(z.string().uuid()).min(2),
    mergedLabel: z.string().nullable().default(null),
  })
  .strict();

export const TableGetActiveOrdersSchema = z.object({}).strict();

export const TableGetRevenueSchema = z.object({}).strict();

// ============================================================================
// Staff Management Tools
// ============================================================================

export const StaffListSchema = z.object({}).strict();

export const StaffInviteSchema = z
  .object({
    email: z.string().email(),
    role: z.enum(["manager", "server"]),
    name: z.string().nullable().default(null),
  })
  .strict();

export const StaffGetRolesSchema = z.object({}).strict();

export const StaffGetScheduleSchema = z.object({}).strict();

export const StaffGetPerformanceSchema = z
  .object({
    timeRange: z.enum(["week", "month"]).default("week"),
  })
  .strict();

// ============================================================================
// Extended KDS Tools
// ============================================================================

export const KDSGetStationTicketsSchema = z
  .object({
    stationName: z.string().min(1),
  })
  .strict();

export const KDSBulkUpdateSchema = z
  .object({
    fromStatus: z.string().min(1),
    toStatus: z.string().min(1),
    stationName: z.string().nullable().default(null),
  })
  .strict();

export const KDSGetOverdueExtendedSchema = z
  .object({
    thresholdMinutes: z.number().int().positive().default(15),
  })
  .strict();

export const KDSGetPrepTimesSchema = z.object({}).strict();

// ============================================================================
// Extended Inventory Tools
// ============================================================================

export const InventoryAdjustStockExtendedSchema = z
  .object({
    itemName: z.string().min(1),
    adjustment: z.number().int(),
    reason: z.string().nullable().default(null),
  })
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
  // QR Code Tools
  z
    .object({
      name: z.literal("qr.generate_table"),
      params: QRGenerateTableSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("qr.generate_bulk"),
      params: QRGenerateBulkSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("qr.generate_counter"),
      params: QRGenerateCounterSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("qr.list_all"),
      params: QRListAllSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("qr.export_pdf"),
      params: QRExportPDFSchema,
      preview: z.boolean(),
    })
    .strict(),
  // Extended Menu Tools
  z
    .object({
      name: z.literal("menu.query_no_images"),
      params: MenuQueryNoImagesSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("menu.upload_image"),
      params: MenuUploadImageSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("menu.translate_extended"),
      params: MenuTranslateExtendedSchema,
      preview: z.boolean(),
    })
    .strict(),
  // Extended Order Tools
  z
    .object({
      name: z.literal("orders.update_status"),
      params: OrderUpdateStatusSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("orders.get_kitchen"),
      params: OrdersGetKitchenSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("orders.get_overdue"),
      params: OrdersGetOverdueSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("orders.get_pending"),
      params: OrdersGetPendingSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("orders.get_today_stats"),
      params: OrdersGetTodayStatsSchema,
      preview: z.boolean(),
    })
    .strict(),
  // Table Management Tools
  z
    .object({
      name: z.literal("tables.get_availability"),
      params: TableGetAvailabilitySchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("tables.create"),
      params: TableCreateSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("tables.merge"),
      params: TableMergeSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("tables.get_active_orders"),
      params: TableGetActiveOrdersSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("tables.get_revenue"),
      params: TableGetRevenueSchema,
      preview: z.boolean(),
    })
    .strict(),
  // Staff Management Tools
  z
    .object({
      name: z.literal("staff.list"),
      params: StaffListSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("staff.invite"),
      params: StaffInviteSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("staff.get_roles"),
      params: StaffGetRolesSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("staff.get_schedule"),
      params: StaffGetScheduleSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("staff.get_performance"),
      params: StaffGetPerformanceSchema,
      preview: z.boolean(),
    })
    .strict(),
  // Extended KDS Tools
  z
    .object({
      name: z.literal("kds.get_station_tickets"),
      params: KDSGetStationTicketsSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("kds.bulk_update"),
      params: KDSBulkUpdateSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("kds.get_overdue_extended"),
      params: KDSGetOverdueExtendedSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("kds.get_prep_times"),
      params: KDSGetPrepTimesSchema,
      preview: z.boolean(),
    })
    .strict(),
  // Extended Inventory Tools
  z
    .object({
      name: z.literal("inventory.adjust_stock_extended"),
      params: InventoryAdjustStockExtendedSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("inventory.get_low_stock"),
      params: InventoryGetLowStockSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("inventory.generate_po"),
      params: InventoryGeneratePOSchema,
      preview: z.boolean(),
    })
    .strict(),
  z
    .object({
      name: z.literal("inventory.get_levels"),
      params: InventoryGetLevelsSchema,
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
  itemsWithImages: number;
  itemsWithoutImages: number;
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
  last7Days: {
    revenue: number;
    orders: number;
    avgOrderValue: number;
  };
  last30Days: {
    revenue: number;
    orders: number;
    avgOrderValue: number;
  };
  thisWeek: {
    revenue: number;
    orders: number;
    avgOrderValue: number;
  };
  thisMonth: {
    revenue: number;
    orders: number;
    avgOrderValue: number;
  };
  trending: {
    topItems: Array<{ name: string; count: number; revenue: number }>;
    categoryPerformance: Record<string, { revenue: number; orders: number; itemCount: number }>;
  };
  growth: {
    revenueGrowth: number; // Percentage change from previous period
    ordersGrowth: number;
  };
  timeAnalysis: {
    byDayOfWeek: Array<{ day: string; revenue: number; orders: number; avgOrderValue: number }>;
    byHour: Array<{ hour: number; revenue: number; orders: number }>;
    peakHours: Array<{ hour: number; orderCount: number }>;
    busiestDay: string;
  };
  paymentMethods: Record<string, { count: number; revenue: number }>;
  orderPatterns: {
    avgItemsPerOrder: number;
    takeawayVsDineIn: { takeaway: number; dineIn: number };
    avgPreparationTime?: number;
  };
  itemPerformance: {
    neverOrdered: string[];
    rarelyOrdered: Array<{ name: string; count: number }>;
    topByRevenue: Array<{ name: string; revenue: number; count: number }>;
  };
  tableMetrics?: {
    avgTurnoverTime: number;
    totalSessions: number;
    revenueByTable: Array<{ tableNumber: number; revenue: number; sessions: number }>;
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
  // REVENUE & ANALYTICS GUARDRAILS
  "revenue.analyze_menu_performance": {
    /* Empty */
  },
  "revenue.suggest_price_optimization": {
    maxPriceChangePercent: 20,
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
    maxDiscountPercent: 30,
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
    maxBulkOperationSize: 100,
    requiresManagerApproval: true,
  },
  "auto.reorder_inventory": {
    requiresManagerApproval: true,
  },
  "auto.generate_report": {
    /* Empty */
  },
  "auto.schedule_menu_changes": {
    requiresManagerApproval: true,
  },
  "auto.translate_feedback": {
    /* Empty */
  },
  "auto.dynamic_pricing": {
    maxPriceChangePercent: 15,
    requiresManagerApproval: true,
  },
  // QR CODE GUARDRAILS
  "qr.generate_table": {
    /* Empty */
  },
  "qr.generate_bulk": {
    maxBulkOperationSize: 100,
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
    requiresManagerApproval: true,
  },
  "tables.merge": {
    requiresManagerApproval: true,
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
    requiresManagerApproval: true,
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
    maxBulkOperationSize: 50,
  },
  "kds.get_overdue_extended": {
    /* Empty */
  },
  "kds.get_prep_times": {
    /* Empty */
  },
  // EXTENDED INVENTORY GUARDRAILS
  "inventory.adjust_stock_extended": {
    maxBulkOperationSize: 50,
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
