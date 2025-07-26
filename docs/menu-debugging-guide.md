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
- Added `refetchMenuItems()` function
- Exposed refetch function globally for testing
- Added debug button to manually trigger refetch
- Proper venue ID handling

### 3. **Wrong Venue ID Queries**
**Problem:** Ordering page was querying wrong venue or not using venue ID properly.

**Solution:** ✅ **FIXED**
- Proper venue ID detection from URL parameters
- Clear logic for demo vs real venues
- Consistent venue ID usage across upload and fetch

## How to Test

### **Step 1: Upload Menu**
1. Go to dashboard with venue ID (e.g., `?venue=my-restaurant`)
2. Upload a PDF menu
3. Check console logs for database save confirmation
4. Verify items appear in Supabase table

### **Step 2: Check Ordering Page**
1. Go to ordering page with same venue ID (e.g., `/order?venue=my-restaurant`)
2. Check if menu items appear
3. If not, click "Refetch Menu Items" button
4. Check console for fetch logs

### **Step 3: Debug Database**
1. Go to Supabase → Table Editor
2. Check `venues` table for your venue
3. Check `menu_items` table for your items
4. Verify `venue_id` matches

## Debugging Commands

### **Check Database Directly**
```sql
-- Check if venue exists
SELECT * FROM venues WHERE venue_id = 'your-venue-id';

-- Check menu items for venue
SELECT * FROM menu_items WHERE venue_id = 'your-venue-id' AND available = true;
```

### **Check Console Logs**
Look for these log messages:
```
[MENU_EXTRACTION] Saving X items to venue: your-venue-id
[MENU_EXTRACTION] Successfully saved X items to database
Refetching menu items...
Found X available items for venue your-venue-id
```

### **Network Tab**
1. Open DevTools → Network
2. Upload menu and check `/api/upload-menu` request
3. Check ordering page for menu fetch requests
4. Verify venue ID in request parameters

## Common Issues & Solutions

### **Issue: "No menu items found"**
**Check:**
1. Venue ID in URL matches database
2. Menu items were actually saved to database
3. RLS policies allow reading menu items
4. Items have `available = true`

### **Issue: Menu items not appearing after upload**
**Solutions:**
1. Click "Refetch Menu Items" button
2. Hard refresh the page (Cmd+Shift+R)
3. Check if venue ID is correct
4. Verify database save was successful

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

### **Real Venue:**
- `/order?venue=my-restaurant` → Shows DB items for my-restaurant
- `/order?venue=pizza-palace` → Shows DB items for pizza-palace

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
- [ ] Go to ordering page → Check if items appear
- [ ] If not appearing → Click "Refetch Menu Items"
- [ ] Check venue ID consistency across upload and fetch
- [ ] Verify RLS policies allow read/write access
- [ ] Test with different venue IDs
- [ ] Test demo vs real venue logic

## Debug Functions

### **Manual Refetch:**
```javascript
// In browser console
window.refetchMenuItems();
```

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

This debugging guide should help you identify and fix any remaining issues with menu upload and fetching! 