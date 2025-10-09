# 📦 Servio Smart Inventory System - Auto-Deduction Guide

## 🎯 Overview

The Servio Inventory System is now a **fully automated, restaurant-grade smart inventory engine** that:
- ✅ Automatically deducts ingredients when orders complete
- ✅ Tracks all stock movements with full audit trail
- ✅ Auto-86s menu items when ingredients run out
- ✅ Provides real-time low stock alerts
- ✅ Calculates COGS (Cost of Goods Sold)
- ✅ Integrates with KDS and Live Orders

---

## 🏗️ Architecture

### Database Schema

```sql
-- Core Tables
ingredients              # Master ingredient list
stock_ledgers           # Immutable movement history
menu_item_ingredients   # Recipe mapping (qty per menu item)

-- Views
v_stock_levels          # Real-time stock calculation from ledger
```

### Key Features

1. **Ingredient Master Data**
   - Name, SKU, Unit, Cost per Unit
   - Par Level, Reorder Level
   - Supplier information
   - Active/Inactive status

2. **Stock Ledger (Movements)**
   - Immutable transaction log
   - Delta-based tracking (+/-)
   - Reason types: `sale`, `receive`, `adjust`, `waste`, `stocktake`, `return`
   - Links to orders, users, and references

3. **Recipe Management**
   - Map menu items → ingredients
   - Quantity per item with units
   - Automatic cost calculation
   - Stock availability warnings

---

## 🔄 Auto-Deduction Flow

### When an Order Completes

```mermaid
Order Status → COMPLETED
    ↓
Call deduct_stock_for_order(order_id, venue_id)
    ↓
For each item in order:
    ↓
    Get recipe (menu_item_ingredients)
    ↓
    For each ingredient:
        ↓
        Calculate: total_qty = qty_per_item × order_quantity
        ↓
        Insert stock_ledger: delta = -total_qty, reason = 'sale'
        ↓
        Trigger: check_low_stock_and_86()
            ↓
            If stock ≤ 0 → Auto-86 linked menu items
            ↓
            If stock ≤ reorder_level → Low stock alert
```

### Integration Points

**Live Orders** (`/app/api/dashboard/orders/[id]/route.ts`)
```typescript
if (order_status === 'COMPLETED' && data) {
  await supa.rpc('deduct_stock_for_order', {
    p_order_id: id,
    p_venue_id: data.venue_id,
  });
}
```

**Order Update API** (`/app/api/orders/update-status/route.ts`)
```typescript
if (status === 'COMPLETED') {
  await supabase.rpc('deduct_stock_for_order', {
    p_order_id: orderId,
    p_venue_id: order.venue_id,
  });
}
```

---

## 📊 UI Components

### 1. **Inventory Overview Tab**

**Location:** `/app/dashboard/[venueId]/inventory`

**Features:**
- ✅ Real-time stock levels
- ✅ Low stock banner (auto-alert)
- ✅ Search and filter
- ✅ Quick actions: Receive, Adjust, Waste, Stocktake
- ✅ CSV Export (current stock snapshot)

**Actions:**
```
Receive (+)  → Update stock + cost + supplier
Adjust (±)   → Manual correction
Waste (-)    → Record spoilage/loss
Stocktake    → Physical count reconciliation
```

### 2. **Stock Movements Tab**

**Location:** `/app/dashboard/[venueId]/inventory` → Movements

**Features:**
- ✅ Complete transaction history
- ✅ Filter by: Reason, Date Range
- ✅ Pagination (50 per page)
- ✅ User tracking (who made the change)
- ✅ CSV Export (full audit trail)

**Display:**
```
Date | Ingredient | Reason | Delta | Note | User
------------------------------------------------
2025-10-09 | Eggs | Sale | -4 pcs | Order #237 | Auto
2025-10-09 | Coffee | Receive | +10 kg | Restock | amaan
2025-10-10 | Lettuce | Waste | -2 kg | Spoilage | staff
```

### 3. **Receive Stock Dialog**

**Enhanced Workflow:**
- Quantity received
- Cost per unit (updates ingredient master)
- Supplier (updates ingredient master)
- Note/reference
- **Real-time summary:**
  - New stock level preview
  - Total purchase cost

---

## 🔗 Recipe & Menu Integration

### Set Up Menu Item Recipes

1. Go to **Menu Management**
2. Click **"Set Recipe"** on any menu item
3. Add ingredients with quantities

**Example: Turkish Eggs**
```
Eggs          → 2 pcs
Butter        → 0.05 kg
Greek Yogurt  → 0.1 kg
Paprika       → 0.01 kg
```

### What Happens on Sale

**Customer orders 1x Turkish Eggs:**
1. Order → COMPLETED
2. Auto-deduction triggers:
   - Eggs: -2 pcs
   - Butter: -0.05 kg
   - Greek Yogurt: -0.1 kg
   - Paprika: -0.01 kg
3. Stock ledger entries created
4. Low stock check runs
5. If Eggs ≤ 0 → **Menu item auto-disabled**

---

## 📈 Reports & Analytics

### CSV Exports

**Inventory Overview Export:**
```csv
Name, SKU, On Hand, Unit, Par Level, Reorder Level, Cost/Unit, Supplier
Eggs, EGG-001, 48, pcs, 100, 20, 0.50, Farm Fresh Co
Coffee Beans, COFFEE-001, 5.2, kg, 20, 5, 12.00, Local Roasters
```

**Movements Export:**
```csv
Date, Ingredient, Delta, Unit, Reason, Ref Type, Note, User
2025-10-09T14:23:00Z, Eggs, -4, pcs, sale, order, Order #237, system
2025-10-09T10:15:00Z, Coffee Beans, 10, kg, receive, Restock, amaan
```

### COGS Tracking

- Each `receive` entry logs cost per unit
- Can calculate: Total Purchase Cost vs Revenue
- Track ingredient cost trends over time

---

## 🚨 Alerts & Automation

### Low Stock Alert

**Trigger:** `stock ≤ reorder_level`

**UI:** 
- Amber banner in Overview tab
- Count of low-stock items
- Ingredients highlighted in table

### Auto-86 (Out of Stock)

**Trigger:** `stock ≤ 0`

**Action:**
```sql
UPDATE menu_items 
SET is_available = false 
WHERE id IN (
  SELECT menu_item_id FROM menu_item_ingredients 
  WHERE ingredient_id = [out_of_stock_ingredient]
)
```

**Notification:** Console log + future: real-time channel

### Re-Enable Menu Items

When stock is received and goes above 0, manually re-enable menu items in Menu Management.

---

## 🔧 API Endpoints

### Ingredients
- `GET /api/inventory/ingredients?venue_id=xxx` - List all
- `POST /api/inventory/ingredients` - Create new
- `PATCH /api/inventory/ingredients/[id]` - Update
- `DELETE /api/inventory/ingredients/[id]` - Delete

### Stock Operations
- `POST /api/inventory/stock/adjust` - Receive/Adjust/Waste
- `POST /api/inventory/stock/stocktake` - Physical count
- `GET /api/inventory/stock/movements` - History with filters

### Recipes
- `GET /api/inventory/recipes/[menu_item_id]` - Get recipe
- `POST /api/inventory/recipes/[menu_item_id]` - Save recipe
- `DELETE /api/inventory/recipes/[menu_item_id]/[ingredient_id]` - Remove

### Export
- `GET /api/inventory/export/csv?venue_id=xxx` - Overview CSV
- `GET /api/inventory/export/movements?venue_id=xxx&from=&to=&reason=` - Movements CSV

---

## 🎬 Usage Example

### Scenario: Morning Stock Receipt

**1. Receive Stock**
```
Action: Click "Receive (+)" on "Coffee Beans"
Quantity: 10 kg
Cost/Unit: $12.00
Supplier: Local Roasters
Note: Weekly delivery #42

Result:
- Stock: 5.2 kg → 15.2 kg
- Cost updated: $12.00/kg
- Ledger entry: +10 kg, reason=receive
```

**2. Order Processing**
```
Customer orders: 2x Latte

Auto-deduction (if recipe set):
- Coffee Beans: -0.04 kg (0.02 kg × 2)
- Milk: -0.4 L (0.2 L × 2)

Stock after: Coffee 15.16 kg, Milk 2.1 L
```

**3. End of Day - Stocktake**
```
Action: Click "Stocktake" on "Milk"
Physical Count: 1.8 L
System Count: 2.1 L

Result:
- Ledger entry: -0.3 L, reason=stocktake
- Note: "End of day variance"
```

---

## 🚀 Future Enhancements

### Already Built & Ready
- [x] Auto-deduction on order completion
- [x] Recipe/ingredient mapping
- [x] Low stock alerts
- [x] Auto-86 out-of-stock items
- [x] Movement history with filters
- [x] CSV exports
- [x] Cost tracking

### Planned
- [ ] **Auto Purchase Orders** - Generate draft POs when stock low
- [ ] **COGS Dashboard** - Visual cost analysis
- [ ] **Multi-location sync** - Share suppliers across venues
- [ ] **Predictive alerts** - ML-based reorder suggestions
- [ ] **Barcode scanning** - Quick stock receipts
- [ ] **Waste analytics** - Track spoilage patterns

---

## 📝 Configuration Checklist

- [x] Migration applied: `inventory-system-schema.sql`
- [x] Database function: `deduct_stock_for_order()` deployed
- [x] Trigger: `check_low_stock_and_86()` active
- [x] RLS policies enabled
- [x] Order completion hooks integrated
- [x] UI components deployed
- [x] Export endpoints live

---

## 🎉 Success!

Your inventory system is now **production-ready** and automatically tracks every ingredient movement tied to orders, providing:

✅ **Zero manual tracking** - Auto-deduction on every sale  
✅ **Full audit trail** - Every change logged with user/reason  
✅ **Cost intelligence** - COGS tracking built-in  
✅ **Stock safety** - Never oversell with auto-86  
✅ **Manager insights** - Export data for analysis  

**Next:** Set up recipes for your menu items and watch the system work! 🚀

