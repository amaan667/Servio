# Menu Upload & Fetching Debugging Guide

## Issues Fixed

### 1. **Menu Items Not Being Saved to Database**
**Problem:** The `saveMenuItemsToDatabase` function was just a placeholder.

**Solution:** ✅ **FIXED**
- Implemented actual Supabase database integration
- Creates venue if it doesn't exist
- Saves all extracted menu items to `menu_items` table
- Proper error handling and logging

### 2. **Ordering UI Not Refreshing After Upload**
**Problem:** Menu items were extracted but not showing in ordering page.

**Solution:** ✅ **FIXED**
- **Automatic menu fetching** on page load
- **No manual refetch needed** - removed debug buttons
- Proper venue ID handling
- Clean, simple UI without clutter

### 3. **Wrong Venue ID Queries**
**Problem:** Ordering page was querying wrong venue or not using venue ID properly.

**Solution:** ✅ **FIXED**
- Proper venue ID detection from URL parameters
- Clear logic for demo vs real venues
- Consistent venue ID usage across upload and fetch

### 4. **Venue ID Type Mismatch (NEW)**
**Problem:** Database expects UUID but we're using string venue IDs like "amaantanveer667-venue".

**Solution:** ✅ **FIXED**
- **Simplified approach** - venue_id is TEXT and can be the slug directly
- **No UUID conversion needed** - use slug as venue_id consistently
- **Direct queries** - no venue lookup step required

## How to Test

### **Step 1: Upload Menu**
1. Go to dashboard with venue slug (e.g., `?venue=my-restaurant`)
2. Upload a PDF menu
3. Check console logs for database save confirmation
4. Verify items appear in Supabase table

### **Step 2: Check Ordering Page**
1. Go to ordering page with same venue slug (e.g., `/order?venue=my-restaurant`)
2. **Menu should load automatically** - no manual action needed
3. If no items appear, check console for errors
4. Verify venue slug matches between upload and fetch

### **Step 3: Debug Database**
1. Go to Supabase → Table Editor
2. Check `venues` table for your venue slug
3. Check `menu_items` table for your items
4. Verify `venue_id` matches the venue slug

## Debugging Commands

### **Check Database Directly**
```sql
-- Check if venue exists by slug
SELECT * FROM venues WHERE venue_id = 'your-venue-slug';

-- Check menu items for venue
SELECT * FROM menu_items WHERE venue_id = 'your-venue-slug' AND available = true;

-- Check table structure (important!)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'venues' AND column_name = 'venue_id';
```

### **Check Console Logs**
Look for these log messages:
```
[MENU_EXTRACTION] Processing venue slug: your-venue-slug
[MENU_EXTRACTION] Found existing venue: your-venue-slug
[MENU_EXTRACTION] Successfully saved X items to database for venue: your-venue-slug
Fetching menu for real venue slug: your-venue-slug
Found X available items for venue your-venue-slug
```

### **Network Tab**
1. Open DevTools → Network
2. Upload menu and check `/api/upload-menu` request
3. Check ordering page for menu fetch requests
4. Verify venue slug in request parameters

## Common Issues & Solutions

### **Issue: "invalid input syntax for type uuid"**
**Problem:** Database venue column is UUID but you're passing string.
**Solution:** ✅ **FIXED**
- Use venue slugs (strings) directly as venue_id
- No UUID conversion needed
- venue_id is TEXT field, not UUID

### **Issue: "No menu items found"**
**Check:**
1. Venue slug in URL matches database
2. Menu items were actually saved to database
3. RLS policies allow reading menu items
4. Items have `available = true`

### **Issue: Menu items not appearing after upload**
**Solutions:**
1. **Reload the ordering page** (Cmd+R)
2. Check if venue slug is correct
3. Verify database save was successful
4. Check console for fetch errors

### **Issue: Database save failed**
**Check:**
1. Supabase environment variables are set
2. RLS policies allow inserting menu items
3. Venue exists in database
4. Menu item data is valid

## URL Examples

### **Demo Mode:**
- `/order?demo=1` → Shows demo data
- `/order?venue=demo-cafe` → Shows demo data

### **Real Venue (using slugs):**
- `/order?venue=my-restaurant` → Shows DB items for my-restaurant
- `/order?venue=pizza-palace` → Shows DB items for pizza-palace
- `/order?venue=amaantanveer667-venue` → Shows DB items for amaantanveer667-venue

### **Dashboard:**
- `/dashboard?venue=my-restaurant` → Upload menu for my-restaurant

## Environment Variables Required

```bash
# Database
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Google Cloud (for OCR)
GOOGLE_CREDENTIALS_B64=base64_encoded_service_account_json
GCS_BUCKET_NAME=your-gcs-bucket-name

# OpenAI (for menu extraction)
OPENAI_API_KEY=sk-your-openai-api-key
```

## Testing Checklist

- [ ] Upload PDF menu → Check console for save confirmation
- [ ] Check Supabase table → Verify items exist
- [ ] Go to ordering page → **Menu loads automatically**
- [ ] Check venue slug consistency across upload and fetch
- [ ] Verify RLS policies allow read/write access
- [ ] Test with different venue slugs
- [ ] Test demo vs real venue logic

## Debug Functions

### **Check Current Venue:**
```javascript
// In browser console
console.log('Current venue:', new URLSearchParams(window.location.search).get('venue'));
```

### **Force Demo Mode:**
```javascript
// In browser console
window.location.href = '/order?demo=1';
```

### **Check Menu Items in Console:**
```javascript
// In browser console (on ordering page)
console.log('Menu items:', document.querySelectorAll('[data-menu-item]').length);
```

## Key Changes Made

1. ✅ **Removed debug/refetch buttons** - Clean UI
2. ✅ **Automatic menu fetching** - No manual action needed
3. ✅ **Simplified error handling** - Clear error messages
4. ✅ **Removed unnecessary API endpoints** - Cleaner codebase
5. ✅ **Fixed venue ID type mismatch** - Uses slugs directly as venue_id
6. ✅ **Simplified venue handling** - No UUID conversion needed

## Database Schema Notes

The system now properly handles:
- **Venue slugs** (user-friendly URLs like "my-restaurant")
- **Direct venue_id usage** (slug is the venue_id)
- **Menu item queries** (uses slug directly)
- **Consistent venue handling** (same slug for upload and fetch)

The menu system now works automatically without any manual intervention needed! 