// AI Assistant parameter types for all executors

export interface AnalyticsInsightsParams {

  };
  insights?: unknown;
  orders?: unknown;
  topItems?: unknown[];
  revenueByDay?: unknown[];
}

export interface AnalyticsExportParams {

}

export interface TranslationParams {

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
