/**
 * Analytics Types & Interfaces
 * Comprehensive type definitions for all analytics data structures
 */

// ========================================
// DATE RANGE & FILTER TYPES
// ========================================

export type DateRangePreset = "today" | "yesterday" | "this_week" | "last_week" | 
  "this_month" | "last_month" | "this_quarter" | "this_year" | "last_7_days" | 
  "last_30_days" | "last_90_days" | "custom";

export interface DateRange {
  start: Date;
  end: Date;
  preset?: DateRangePreset;
}

export interface AnalyticsFilters {
  dateRange: DateRange;
  venueId?: string;
  categories?: string[];
  tags?: string[];
  orderTypes?: ("dine_in" | "takeaway" | "delivery")[];
  paymentMethods?: ("card" | "cash" | "other")[];
  staffIds?: string[];
  customerSegments?: string[];
}

// ========================================
// REVENUE ANALYTICS TYPES
// ========================================

export interface RevenueDataPoint {
  date: string;
  revenue: number;
  orders: number;
  averageOrderValue: number;
}

export interface RevenueAnalytics {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  revenueGrowth: number; // percentage compared to previous period
  orderGrowth: number;
  
  // Time series data
  dailyBreakdown: RevenueDataPoint[];
  weeklyComparison: RevenueDataPoint[];
  monthlyTrend: RevenueDataPoint[];
  
  // Period comparisons
  periodOverPeriod: {
    current: number;
    previous: number;
    change: number;
    changePercent: number;
  };
  
  // Year over year
  yearOverYear: {
    currentYear: number;
    lastYear: number;
    change: number;
    changePercent: number;
  };
}

export interface RevenueByCategory {
  category: string;
  revenue: number;
  orders: number;
  percentage: number;
}

export interface RevenueByHour {
  hour: number; // 0-23
  revenue: number;
  orders: number;
  averageOrderValue: number;
}

// ========================================
// ORDER ANALYTICS TYPES
// ========================================

export interface OrderAnalytics {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  averageOrderValue: number;
  averageOrderTime: number; // in minutes
  
  // Order volumes
  orderVolumeByDay: Array<{
    date: string;
    count: number;
    revenue: number;
  }>;
  
  orderVolumeByHour: Array<{
    hour: number;
    count: number;
    revenue: number;
  }>;
  
  // Order types distribution
  orderTypeDistribution: Array<{
    type: "dine_in" | "takeaway" | "delivery";
    count: number;
    revenue: number;
    percentage: number;
  }>;
  
  // Peak hours
  peakHours: Array<{
    hour: number;
    orderCount: number;
    revenue: number;
  }>;
  
  // Order status breakdown
  orderStatusBreakdown: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
}

// ========================================
// CUSTOMER ANALYTICS TYPES
// ========================================

export type CustomerSegment = "new" | "returning" | "loyal" | "at_risk" | "churned";

export interface CustomerAnalytics {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  uniqueCustomers: number;
  
  // Customer segments
  customerSegments: Array<{
    segment: CustomerSegment;
    count: number;
    percentage: number;
    revenue: number;
  }>;
  
  // Customer retention
  retentionRate: number;
  repeatPurchaseRate: number;
  averageOrdersPerCustomer: number;
  
  // Customer lifetime value
  averageLifetimeValue: number;
  topCustomers: Array<{
    customerId: string;
    customerName: string;
    totalRevenue: number;
    orderCount: number;
    lastOrderDate: string;
  }>;
  
  // Customer growth
  customerGrowth: {
    newCustomers: number;
    returnedCustomers: number;
    growthRate: number;
  };
}

// ========================================
// INVENTORY ANALYTICS TYPES
// ========================================

export interface InventoryAnalytics {
  totalInventoryValue: number;
  inventoryTurnoverRate: number;
  shrinkageRate: number;
  stockoutItems: number;
  lowStockItems: number;
  
  // Inventory usage
  usageByCategory: Array<{
    category: string;
    quantity: number;
    cost: number;
    percentage: number;
  }>;
  
  // Waste tracking
  wasteByReason: Array<{
    reason: string;
    quantity: number;
    cost: number;
  }>;
  
  // Reorder analysis
  reorderItems: Array<{
    ingredientId: string;
    name: string;
    currentStock: number;
    reorderPoint: number;
    recommendedOrderQuantity: number;
    estimatedCost: number;
  }>;
  
  // Cost analysis
  costBreakdown: {
    totalCost: number;
    foodCost: number;
    beverageCost: number;
    otherCost: number;
    costAsPercentage: number;
  };
}

// ========================================
// STAFF PERFORMANCE TYPES
// ========================================

export interface StaffPerformanceAnalytics {
  staffMembers: Array<{
    staffId: string;
    name: string;
    role: string;
    
    // Order handling
    ordersHandled: number;
    revenueGenerated: number;
    
    // Performance metrics
    averageOrderTime: number;
    ordersPerHour: number;
    
    // Customer feedback
    averageRating: number;
    
    // Efficiency
    efficiencyScore: number;
  }>;
  
  // Aggregate metrics
  totalStaff: number;
  averageOrdersPerStaff: number;
  averageRevenuePerStaff: number;
  topPerformer: {
    staffId: string;
    name: string;
    revenue: number;
  } | null;
}

// ========================================
// REPORT CONFIGURATION TYPES
// ========================================

export type ReportType = 
  | "revenue" 
  | "orders" 
  | "customers" 
  | "inventory" 
  | "staff" 
  | "comprehensive";

export type ExportFormat = "csv" | "excel" | "pdf";

export interface ReportConfiguration {
  id?: string;
  name: string;
  type: ReportType;
  filters: AnalyticsFilters;
  columns: string[];
  groupBy?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  includeCharts?: boolean;
  schedule?: {
    frequency: "daily" | "weekly" | "monthly";
    recipients: string[];
    enabled: boolean;
  };
}

export interface GeneratedReport {
  id: string;
  configurationId?: string;
  type: ReportType;
  generatedAt: string;
  dateRange: DateRange;
  data: Record<string, unknown>[];
  summary: Record<string, unknown>;
  exportUrl?: string;
}

// ========================================
// DASHBOARD METRICS TYPES
// ========================================

export interface DashboardMetrics {
  // Real-time metrics
  activeOrders: number;
  pendingOrders: number;
  todayRevenue: number;
  todayOrders: number;
  
  // Period metrics
  periodRevenue: number;
  periodOrders: number;
  periodAverageOrderValue: number;
  periodGrowth: number;
  
  // Quick stats
  quickStats: Array<{
    label: string;
    value: number | string;
    change?: number;
    changeLabel?: string;
    icon?: string;
  }>;
  
  // Alerts
  alerts: Array<{
    id: string;
    type: "warning" | "info" | "success" | "error";
    title: string;
    message: string;
    timestamp: string;
  }>;
}

// ========================================
// CHART DATA TYPES
// ========================================

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
  metadata?: Record<string, unknown>;
}

export interface TimeSeriesDataPoint {
  timestamp: string;
  value: number;
  label?: string;
}

export interface HeatmapDataPoint {
  x: number; // hour (0-23) or day (0-6)
  y: number; // day (0-6) or hour (0-23)
  value: number;
  label?: string;
}

// ========================================
// API RESPONSE TYPES
// ========================================

export interface AnalyticsApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    generatedAt: string;
    cacheHit: boolean;
    executionTimeMs: number;
  };
}

export interface PaginatedAnalyticsResponse<T> extends AnalyticsApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}
