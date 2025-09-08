# Menu Import Fixes - Complete Solution

This document provides a comprehensive solution to fix the menu import issues identified in your system.

## Issues Identified

### 1. Modifier Explosion
**Problem**: "COFFEE — 164 items" with dozens like "Coffee with a shot of almond… £3.00"
**Root Cause**: Flavour syrups and extras were created as standalone menu items instead of options
**Solution**: Remove these items and create proper option groups

### 2. £0.00 Prices
**Problem**: Items like "Iced Black/Americano" showing £0.00
**Root Cause**: Parser failed to bind prices to items
**Solution**: Set correct prices based on PDF content

### 3. Misfiled Items
**Problem**: "Lobster Thermidor 700g" appears under COFFEE
**Root Cause**: Incorrect category assignment during parsing
**Solution**: Move food items to appropriate categories

### 4. Duplicates/Near-duplicates
**Problem**: "Pour-Over (V60)" and "Pour-Over (V60) öbös öö" both at £4.25
**Root Cause**: Parser created multiple versions of same item
**Solution**: Remove duplicates, keep cleanest version

### 5. Truncated Descriptions
**Problem**: "Served with overnight oat, granular…" (should be granola)
**Root Cause**: OCR/text extraction truncation
**Solution**: Apply spell correction and reconstruction

### 6. Component Items
**Problem**: "club sandwich, mini, wraps" as standalone items
**Root Cause**: Items mentioned in set descriptions became separate SKUs
**Solution**: Remove items that are components of sets

## Quick Fix Application

### Option 1: Automated Script (Recommended)
```bash
# Make sure DATABASE_URL is set in your environment
export DATABASE_URL="your_supabase_connection_string"

# Run the deployment script
./deploy-menu-fixes.sh
```

### Option 2: Manual SQL Execution
```bash
# Connect to your database and run the fix script
psql $DATABASE_URL -f scripts/fix-menu-import-issues.sql
```

## Specific Fixes Applied

### Price Corrections
- **Iced Black/Americano**: £0.00 → £3.50
- **Espresso**: £0.00 → £3.20
- **Flat White**: £0.00 → £3.50
- **Cappuccino**: £0.00 → £3.50
- **Latte**: £0.00 → £3.50
- **Arabic Coffee Pot (Small)**: £0.00 → £10.00
- **Arabic Coffee Pot (Large)**: £0.00 → £18.00
- **Afternoon Tea**: £0.00 → £25.00

### Item Removals
- All "Coffee with a shot of X" items
- Alternative Milk as standalone items
- Club sandwich, mini, wraps as standalone items
- Corrupted Pour-Over duplicates
- Duplicate tea items (Earl grey, Chamomile)

### Category Corrections
- Move lobster items from COFFEE to BRUNCH
- Move food items from COFFEE/TEA to appropriate categories
- Ensure proper category assignment

### Description Fixes
- "granular" → "granola"
- "overnight oat," → "overnight oats,"

## Improved Parser Implementation

For future menu imports, use the improved parser in `lib/improvedMenuParser.ts`:

```typescript
import { parseMenuBulletproof } from '@/lib/improvedMenuParser';

// Use this instead of the old parser
const parsedMenu = await parseMenuBulletproof(extractedText);
```

### Parser Rules
1. **Item Detection**: Only items with prices within 0-2 lines
2. **Section Headers**: Use headers to determine categories
3. **Extras/Modifiers**: Convert to options, not separate items
4. **Rejection Criteria**: No £0.00 prices, no components, no marketing text
5. **De-duplication**: Keep cleanest version, store others as aliases
6. **Category Guards**: Food items cannot be in COFFEE/TEA
7. **Validation**: Fail if >25% options exploded as items

## Validation Results

After applying fixes, you should see:
- **COFFEE category**: ~15-25 items (not 164)
- **Zero £0.00 prices**: Only legitimate items (Afternoon Tea, etc.)
- **Proper categories**: Food items in BRUNCH/MAINS, not COFFEE
- **Clean descriptions**: No truncated text
- **No duplicates**: Single version of each item

## Testing the Fixes

1. **Check category counts**:
   ```sql
   SELECT category, COUNT(*) FROM menu_items GROUP BY category ORDER BY COUNT(*) DESC;
   ```

2. **Verify zero prices**:
   ```sql
   SELECT name, category, price FROM menu_items WHERE price = 0.00;
   ```

3. **Check coffee items**:
   ```sql
   SELECT name, price FROM menu_items WHERE category = 'COFFEE' ORDER BY name;
   ```

## Future Prevention

1. **Use the improved parser** for all new menu imports
2. **Implement validation** in your import pipeline
3. **Add price sanity checks** before database insertion
4. **Create option groups** for modifiers instead of separate items
5. **Use category guards** to prevent misfiling

## Files Created/Modified

- `scripts/fix-menu-import-issues.sql` - Main fix script
- `lib/improvedMenuParser.ts` - Bulletproof parser for future use
- `deploy-menu-fixes.sh` - Automated deployment script
- `MENU_IMPORT_FIXES_README.md` - This documentation

## Support

If you encounter issues:
1. Check the deployment script output for specific errors
2. Verify your DATABASE_URL is correct
3. Ensure you have proper database permissions
4. Review the SQL script for any syntax issues

The fixes are designed to be safe and reversible, but always backup your data before applying major changes.
