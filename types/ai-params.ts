// AI Assistant parameter types for all executors

export interface AnalyticsInsightsParams {
  timeRange: "today" | "week" | "month" | "quarter" | "year" | "custom";
  itemId?: string;
  itemName?: string;
  customRange?: {
    start: string;
    end: string;
  };
  insights?: unknown;
  orders?: unknown;
  topItems?: unknown[];
  revenueByDay?: unknown[];
}

export interface AnalyticsExportParams {
  type: "revenue" | "items" | "orders" | "feedback";
  format: "csv" | "pdf";
  timeRange?: string;
  startDate?: string;
  endDate?: string;
  fileName?: string;
  data?: unknown;
}

export interface TranslationParams {
  targetLanguage: string;
  itemIds?: string[];
  categoryId?: string;
  categoryName?: string;
}

export interface MenuItemParams {
  name?: string;
  nameEn?: string;
  nameAr?: string;
  description?: string;
  descriptionEn?: string;
  descriptionAr?: string;
  price?: number;
  category?: string;
  isAvailable?: boolean;
  imageUrl?: string;
}

export interface InventoryParams {
  ingredientName?: string;
  quantity?: number;
  unit?: string;
  action?: "add" | "remove" | "adjust";
}

export interface OrderParams {
  orderId?: string;
  tableNumber?: string;
  status?: string;
  paymentStatus?: string;
}

export interface TableParams {
  tableId?: string;
  tableNumber?: string;
  action?: "merge" | "split" | "clear";
  targetTableId?: string;
}
