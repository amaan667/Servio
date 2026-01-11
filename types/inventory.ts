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

}

export interface StockLedger {

}

export interface MenuItemIngredient {

}

export interface StockLevel {

}

// Request/Response types
export interface CreateIngredientRequest {

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

}

export interface StocktakeRequest {

}

export interface RecipeIngredient {

}

export interface RecipeCostCalculation {

  }>;
}

export interface LowStockAlert {

}

export interface InventoryCSVRow {

}

export interface StockDeductionResult {

  }>;
  error?: string;
}
