// Inventory Management Types

export type IngredientUnit =
  | "g" // grams
  | "kg" // kilograms
  | "ml" // milliliters
  | "l" // liters
  | "oz" // ounces
  | "lb" // pounds
  | "pcs" // pieces
  | "cup"
  | "tbsp" // tablespoon
  | "tsp"; // teaspoon

export type StockMovementReason =
  | "sale" // Consumed by order
  | "receive" // Stock received
  | "adjust" // Manual adjustment
  | "waste" // Waste/spoilage
  | "stocktake" // Physical count adjustment
  | "return"; // Return to supplier

export type StockRefType = "order" | "shipment" | "manual";

export interface Ingredient {
  id: string;
  venue_id: string;
  name: string;
  sku?: string;
  unit: IngredientUnit;
  cost_per_unit: number;
  par_level: number;
  reorder_level: number;
  supplier?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StockLedger {
  id: string;
  ingredient_id: string;
  venue_id: string;
  delta: number;
  reason: StockMovementReason;
  ref_type?: StockRefType;
  ref_id?: string;
  note?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface MenuItemIngredient {
  menu_item_id: string;
  ingredient_id: string;
  qty_per_item: number;
  unit: IngredientUnit;
  created_at: string;
  updated_at: string;
}

export interface StockLevel {
  ingredient_id: string;
  venue_id: string;
  name: string;
  sku?: string;
  unit: IngredientUnit;
  cost_per_unit: number;
  par_level: number;
  reorder_level: number;
  supplier?: string;
  is_active: boolean;
  on_hand: number;
  created_at: string;
  updated_at: string;
}

// Request/Response types
export interface CreateIngredientRequest {
  venue_id: string;
  name: string;
  sku?: string;
  unit: IngredientUnit;
  cost_per_unit?: number;
  par_level?: number;
  reorder_level?: number;
  supplier?: string;
  notes?: string;
  initial_stock?: number; // If provided, creates a 'receive' ledger entry
}

export interface UpdateIngredientRequest {
  name?: string;
  sku?: string;
  unit?: IngredientUnit;
  cost_per_unit?: number;
  par_level?: number;
  reorder_level?: number;
  supplier?: string;
  notes?: string;
  is_active?: boolean;
}

export interface StockAdjustmentRequest {
  ingredient_id: string;
  delta: number;
  reason: StockMovementReason;
  note?: string;
}

export interface StocktakeRequest {
  ingredient_id: string;
  actual_count: number;
  note?: string;
}

export interface RecipeIngredient {
  ingredient_id: string;
  qty_per_item: number;
  unit: IngredientUnit;
}

export interface RecipeCostCalculation {
  total_cost: number;
  ingredients: Array<{
    ingredient_id: string;
    ingredient_name: string;
    qty_per_item: number;
    unit: IngredientUnit;
    cost_per_unit: number;
    total_cost: number;
  }>;
}

export interface LowStockAlert {
  ingredient_id: string;
  ingredient_name: string;
  current_stock: number;
  reorder_level: number;
  unit: IngredientUnit;
  affected_menu_items: string[];
}

export interface InventoryCSVRow {
  name: string;
  sku?: string;
  unit: IngredientUnit;
  cost_per_unit: number;
  on_hand: number;
  par_level: number;
  reorder_level: number;
  supplier?: string;
}

export interface StockDeductionResult {
  success: boolean;
  order_id?: string;
  deductions?: Array<{
    ingredient_id: string;
    ingredient_name: string;
    quantity_deducted: number;
    unit: IngredientUnit;
  }>;
  error?: string;
}
