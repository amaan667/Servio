# Catalog System - Clear & Upload PDF Implementation

This document describes the complete implementation of the "Clear & Upload PDF" functionality with atomic catalog replacement, bulletproof parsing, and proper database hygiene.

## 🎯 **Goal Achieved**

When "Clear & Upload PDF" is used:
- ✅ **Delete everything** in the venue's catalog (items, categories, variants, options, item-option links, aliases, images)
- ✅ **Insert only** the parsed items from the uploaded PDF
- ✅ **Rollback on failure** - if parsing/insert fails, keep the old catalog intact
- ✅ **No more "Jimmy's Killer Prawns"** leaking through from old menus

## 🏗️ **Database Architecture**

### **Extended Catalog Schema**

The system now includes a complete catalog structure:

```sql
-- Core tables with venue_id for scoped operations
categories (id, venue_id, name, sort_order)
menu_items (id, venue_id, category_id, name, subtitle, description, price, currency, available, sort_order)
options (id, venue_id, item_id, group_name, is_required, max_choices)
option_choices (id, venue_id, option_id, name, price_add_cents)
item_aliases (id, venue_id, item_id, alias)
item_images (id, venue_id, item_id, url, alt_text)
```

### **Key Features**
- **Venue-scoped**: Every table has `venue_id` for safe scoped deletes
- **Foreign Key Cascade**: Proper relationships with `ON DELETE CASCADE`
- **Row Level Security**: Proper RLS policies for data protection
- **Atomic Operations**: All operations happen in single transactions

## 🔧 **Core Components**

### **1. Atomic Replace Catalog RPC**

```sql
-- Single source of truth for catalog replacement
api_replace_catalog(venue_id, payload)
```

**Features:**
- ✅ **Hard clear** existing catalog for venue
- ✅ **Validate** no £0.00 prices
- ✅ **Atomic transaction** - rollback on any error
- ✅ **Proper ordering** - respects FK constraints
- ✅ **Comprehensive validation** - rejects bad data

### **2. Bulletproof Parser**

```typescript
// lib/improvedMenuParser.ts
parseMenuBulletproof(extractedText)
```

**Rules Implemented:**
- ✅ Only items with prices within 0-2 lines
- ✅ Section headers determine categories
- ✅ Extras become options, not separate items
- ✅ Reject £0.00 prices, components, marketing text
- ✅ De-duplicate and keep cleanest versions
- ✅ Category guards prevent food in COFFEE/TEA
- ✅ Validation against modifier explosion

### **3. API Endpoints**

#### **Replace Catalog**
```typescript
POST /api/catalog/replace
{
  venueId: string,
  pdfFileId?: string,
  payload?: object
}
```

#### **Clear Catalog**
```typescript
POST /api/catalog/clear
{
  venueId: string
}
```

### **4. Enhanced UI**

#### **Replace vs Append Toggle**
- **Replace Mode** (default): Complete catalog replacement
- **Append Mode**: Legacy behavior for backward compatibility

#### **Clear Catalog Button**
- Standalone button to clear entire catalog
- Confirmation dialog for safety
- Real-time feedback

#### **Removed Refresh Button**
- No longer needed with automatic refresh on operations
- Cleaner, more intuitive interface

## 🚀 **Deployment**

### **Quick Setup**
```bash
# Deploy the complete catalog system
./deploy-catalog-system.sh
```

### **Manual Setup**
```bash
# 1. Create catalog schema
psql $DATABASE_URL -f scripts/create-catalog-schema.sql

# 2. Deploy RPC functions
psql $DATABASE_URL -f scripts/create-replace-catalog-rpc.sql
```

## 📋 **Usage Examples**

### **Replace Catalog (Recommended)**
```typescript
// Upload PDF with complete replacement
const response = await fetch('/api/catalog/replace', {
  method: 'POST',
  body: formData // Contains PDF file and venueId
});

// Result: Complete catalog replacement with validation
```

### **Clear Catalog**
```typescript
// Clear entire catalog
const response = await fetch('/api/catalog/clear', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ venueId })
});

// Result: All catalog data removed for venue
```

### **Validation**
```sql
-- Validate payload before replacement
SELECT validate_catalog_payload('{"categories": [...]}');
```

## 🛡️ **Safety Features**

### **Validation Guards**
- ✅ **No £0.00 prices** - Rejects items without valid prices
- ✅ **No modifier explosion** - Prevents 164 "Coffee with shot of X" items
- ✅ **No misfiled items** - Food items can't be in COFFEE/TEA
- ✅ **No components as items** - Club sandwich stays in Afternoon Tea set
- ✅ **No duplicates** - Keeps cleanest version, stores others as aliases

### **Atomic Operations**
- ✅ **Single transaction** - All or nothing
- ✅ **Automatic rollback** - On any error, database unchanged
- ✅ **FK constraint respect** - Proper deletion order
- ✅ **Venue scoping** - Only affects target venue

### **Error Handling**
- ✅ **Clear error messages** - Specific validation failures
- ✅ **Warnings for suspicious patterns** - Large item counts, etc.
- ✅ **Graceful degradation** - Fallback to legacy mode if needed

## 🧪 **Testing**

### **Acceptance Tests**

1. **Clear Behavior**
   ```sql
   -- After replace, all old items should be gone
   SELECT COUNT(*) FROM menu_items WHERE venue_id = 'test-venue';
   ```

2. **£0.00 Guard**
   ```typescript
   // Upload PDF with missing price → import must fail
   const result = await replaceCatalog(venueId, invalidPayload);
   expect(result.error).toContain('Invalid price');
   ```

3. **No Modifier Explosion**
   ```sql
   -- COFFEE should be reasonable number, not 164
   SELECT COUNT(*) FROM menu_items WHERE category = 'COFFEE';
   ```

4. **Idempotence**
   ```typescript
   // Same PDF twice yields same catalog
   await replaceCatalog(venueId, pdf1);
   await replaceCatalog(venueId, pdf1);
   // Should be identical
   ```

5. **Rollback Safety**
   ```typescript
   // Force failure mid-insert → database unchanged
   // (Test with invalid data that passes initial validation)
   ```

## 📊 **Monitoring**

### **Success Metrics**
- ✅ **Category counts** - Reasonable numbers (COFFEE ~15-25, not 164)
- ✅ **Zero £0.00 prices** - Only legitimate items
- ✅ **Proper categories** - Food in BRUNCH/MAINS, not COFFEE
- ✅ **Clean descriptions** - No truncated text
- ✅ **No duplicates** - Single version of each item

### **Validation Queries**
```sql
-- Check category distribution
SELECT category, COUNT(*) FROM menu_items GROUP BY category ORDER BY COUNT(*) DESC;

-- Verify no zero prices
SELECT name, price FROM menu_items WHERE price = 0.00;

-- Check for modifier explosion
SELECT COUNT(*) FROM menu_items WHERE name ILIKE '%coffee with a shot of%';
```

## 🔄 **Migration Path**

### **From Legacy System**
1. **Deploy new schema** - Existing data automatically migrated
2. **Update UI** - Replace vs Append toggle available
3. **Test thoroughly** - Validate with sample PDFs
4. **Switch to Replace mode** - Default for new uploads
5. **Monitor results** - Ensure no data loss

### **Backward Compatibility**
- ✅ **Legacy endpoints** still work for Append mode
- ✅ **Existing data** preserved during migration
- ✅ **Gradual rollout** possible with toggle

## 🎉 **Benefits Achieved**

### **For Users**
- ✅ **No more stray items** from old menus
- ✅ **Clean, organized catalogs** with proper structure
- ✅ **Reliable imports** with validation and error handling
- ✅ **Flexible options** - Replace vs Append modes

### **For Developers**
- ✅ **Atomic operations** - No partial failures
- ✅ **Proper validation** - Catches issues before database
- ✅ **Clean architecture** - Well-structured catalog system
- ✅ **Easy testing** - Clear success/failure criteria

### **For Business**
- ✅ **Data integrity** - No corrupted catalogs
- ✅ **Customer experience** - Clean, accurate menus
- ✅ **Operational efficiency** - Reliable import process
- ✅ **Scalability** - Proper database design

## 🚨 **Important Notes**

1. **Replace Mode is Default** - Prevents accidental data mixing
2. **Always Backup** - Before major catalog changes
3. **Test First** - Use sample PDFs to validate
4. **Monitor Results** - Check category counts and prices
5. **Use Validation** - Leverage built-in validation functions

The catalog system now provides bulletproof menu import with atomic replacement, ensuring clean, accurate catalogs without the issues that plagued the previous system.
