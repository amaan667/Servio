# Inventory Management System - Implementation Guide

## Overview

A complete Inventory Management MVP has been added to Servio to track ingredients, manage stock levels, map recipes to menu items, and automatically deduct inventory when orders are completed. This system is gated as a **Premium feature**.

## Features Implemented

### 1. Database Schema
**Location**: `/migrations/inventory-system-schema.sql`

Three core tables with RLS policies:

- **`ingredients`**: Master list of ingredients with cost tracking
  - Fields: name, SKU, unit, cost_per_unit, par_level, reorder_level, supplier
  - Units supported: g, kg, ml, l, oz, lb, pcs, cup, tbsp, tsp

- **`stock_ledgers`**: Immutable ledger of all stock movements
  - Tracks: delta (+ or -), reason (sale/receive/adjust/waste/stocktake), references
  - Maintains complete audit trail

- **`menu_item_ingredients`**: Recipe mapping (ingredients → menu items)
  - Links menu items to required ingredients with quantities
  - Enables automatic cost calculation and stock deduction

- **`v_stock_levels`**: SQL view for efficient on-hand calculations
  - Aggregates ledger entries to show current stock levels
  - Used by all inventory queries

### 2. API Routes

#### Ingredients Management
- `GET /api/inventory/ingredients?venue_id=xxx` - List all ingredients with stock levels
- `POST /api/inventory/ingredients` - Create new ingredient (supports initial_stock)
- `PATCH /api/inventory/ingredients/:id` - Update ingredient
- `DELETE /api/inventory/ingredients/:id` - Delete ingredient

#### Stock Movements
- `POST /api/inventory/stock/adjust` - Adjust stock (receive, waste, manual)
- `POST /api/inventory/stock/stocktake` - Physical count adjustment
- `GET /api/inventory/stock/movements` - View ledger history (paginated, filterable)
- `POST /api/inventory/stock/deduct` - Deduct stock for an order

#### Recipes
- `GET /api/inventory/recipes/:menu_item_id` - Get recipe with cost calculation
- `POST /api/inventory/recipes/:menu_item_id` - Save/update recipe
- `DELETE /api/inventory/recipes/:menu_item_id` - Delete entire recipe
- `DELETE /api/inventory/recipes/:menu_item_id/:ingredient_id` - Remove one ingredient

#### Import/Export
- `GET /api/inventory/export/csv?venue_id=xxx` - Export ingredients to CSV
- `POST /api/inventory/import/csv` - Import ingredients from CSV

#### Alerts & Utilities
- `GET /api/inventory/low-stock?venue_id=xxx` - Get low stock alerts
- `POST /api/inventory/seed` - Seed sample data for testing

### 3. Dashboard UI

**Location**: `/app/dashboard/[venueId]/inventory/`

Main inventory page with two tabs:

#### Overview Tab
- **Ingredients Table**: Shows all ingredients with stock levels
  - Color-coded: Red (out of stock), Amber (low stock), Normal
  - Actions: Receive, Adjust, Waste, Stocktake, Delete
  - Search functionality
  
- **Low Stock Banner**: Alerts when ingredients hit reorder levels
  - Shows count of critical and warning items
  - Expandable to see details

- **Bulk Operations**:
  - CSV Import/Export buttons
  - Add new ingredient dialog

#### Movements Tab
- Paginated list of all stock transactions
- Filter by reason (sale, receive, adjust, waste, stocktake)
- Shows: date, ingredient, reason badge, delta with arrow indicators

### 4. Recipe Management

**Location**: `components/inventory/RecipeDialog.tsx`

Integrated into Menu Management via a "Recipe" button (chef hat icon):

- **Recipe Builder**: Add/remove ingredients with quantities
- **Cost Calculation**: Real-time total cost per menu item
- **Stock Warnings**: Alerts when ingredients are low
- **Unit Consistency**: Uses same units as ingredient definitions

### 5. Automatic Stock Deduction

**Integration Points**:
- `/app/api/orders/update-status/route.ts` (line 30-46)
- `/app/api/dashboard/orders/[id]/route.ts` (line 36-48)

When an order status changes to `COMPLETED`:
1. Calls `deduct_stock_for_order()` SQL function
2. For each order item, reads its recipe
3. Inserts negative ledger entries for consumed ingredients
4. Triggers auto-86 if any ingredient goes to zero (via DB trigger)

### 6. Auto-86 Logic

**Location**: Database trigger `check_low_stock_and_86()`

Automatically:
- Detects when ingredient stock ≤ 0
- Sets `menu_items.is_available = false` for affected items
- Logs warnings for reorder-level breaches
- Prevents orders for unavailable items

### 7. Low-Stock Alerts

**Components**:
- `/hooks/useInventoryAlerts.ts` - Real-time polling hook
- `/components/inventory/LowStockBanner.tsx` - Alert banner
- Auto-refreshes every 30 seconds
- Shows critical (out) and warning (low) counts
- Links to inventory management

### 8. Feature Gating (Premium)

**Location**: `/lib/feature-gates.ts`

Subscription-based access control:
- **Basic**: Core ordering features
- **Standard**: Analytics
- **Premium**: Inventory, KDS, Staff Management

The inventory page checks `PREMIUM_FEATURES.INVENTORY` and shows an upsell card if access is denied.

### 9. Seed Data

**Location**: `/lib/inventory-seed.ts`

Creates sample data:
- 8 ingredients (buns, patties, cheese, lettuce, ketchup, coffee, milk, cups)
- Initial stock levels
- 4 sample recipes (Cheeseburger, Burger, Latte, Cappuccino)

**Usage**:
```bash
POST /api/inventory/seed
{
  "venue_id": "your-venue-id"
}
```

## Database Migration

Run the migration to set up tables:

```bash
# Using Supabase CLI
supabase db push --file migrations/inventory-system-schema.sql

# Or execute in Supabase SQL Editor
```

The migration includes:
- All table definitions with indexes
- RLS policies (venue-scoped)
- SQL views for stock levels
- Helper function `deduct_stock_for_order()`
- Triggers for auto-86 and stock alerts

## Testing Flow

1. **Seed Data**: `POST /api/inventory/seed` with your venue_id
2. **View Inventory**: Navigate to `/dashboard/[venueId]/inventory`
3. **Add Recipe**: Go to menu management, click chef hat icon on any item
4. **Place Order**: Create an order with items that have recipes
5. **Complete Order**: Mark order as completed
6. **Verify Deduction**: Check inventory - stock should decrease
7. **Low Stock**: Reduce ingredient below reorder level → see alert
8. **Auto 86**: Reduce to zero → menu item becomes unavailable

## Key Files Reference

### TypeScript Types
- `/types/inventory.ts` - All inventory-related types

### Components
- `/components/inventory/InventoryOverview.tsx`
- `/components/inventory/InventoryMovements.tsx`
- `/components/inventory/RecipeDialog.tsx`
- `/components/inventory/AddIngredientDialog.tsx`
- `/components/inventory/StockAdjustmentDialog.tsx`
- `/components/inventory/StocktakeDialog.tsx`
- `/components/inventory/ImportCSVDialog.tsx`
- `/components/inventory/LowStockBanner.tsx`

### Hooks
- `/hooks/useInventoryAlerts.ts`

### API Routes
All under `/app/api/inventory/`

## CSV Format

**Export/Import columns**:
```
Name, SKU, Unit, Cost Per Unit, On Hand, Par Level, Reorder Level, Supplier
```

Example:
```csv
"Hamburger Bun","BUN-001",pcs,0.50,100,150,30,"Local Bakery"
"Beef Patty","MEAT-001",pcs,2.00,80,100,20,"Prime Meats"
```

## Future Enhancements

Potential additions:
- Stripe subscription integration for actual tier enforcement
- Email alerts for low stock
- Purchase order generation
- Vendor management
- Batch recipe updates
- Unit conversions (g ↔ kg, ml ↔ l)
- Cost variance tracking
- Waste analytics
- Mobile barcode scanning

## Navigation

The inventory system integrates with existing breadcrumb navigation following the pattern:
**Home ← Dashboard ← Inventory** [[memory:8563488]]

Users can access via:
- Direct link: `/dashboard/[venueId]/inventory`
- Dashboard navigation (add link as needed)

## Notes

- All mutations are tracked in `stock_ledgers` for full audit trail
- Stock can never be directly set - only moved via ledger entries
- RLS ensures users only see their venue's inventory
- Premium tier check happens server-side and client-side
- Default to allowing all features if no `subscription_tier` column exists (backward compatibility)

