# 🔍 PDF Menu Images Debugging Guide

## 🎯 Quick Diagnosis

Run these steps to find out why your PDF menu images aren't showing:

---

## Step 1: Check Database Schema (2 minutes)

**Go to Supabase Dashboard → SQL Editor** and run:

```sql
-- Check if pdf_images column exists
SELECT 
  column_name, 
  data_type, 
  column_default
FROM information_schema.columns
WHERE table_name = 'menu_uploads'
AND column_name = 'pdf_images';
```

**Expected result:**
```
column_name  | data_type | column_default
-------------|-----------|---------------
pdf_images   | ARRAY     | '{}'
```

**If no results:** The column doesn't exist. Run the fix script below.

---

## Step 2: Check Your Menu Uploads (1 minute)

**In Supabase SQL Editor**, run:

```sql
-- Replace 'YOUR_VENUE_ID' with your actual venue ID
SELECT 
  id,
  venue_id,
  filename,
  storage_path,
  pdf_images,
  array_length(pdf_images, 1) as pdf_images_count,
  created_at
FROM menu_uploads
WHERE venue_id = 'YOUR_VENUE_ID'  -- Replace with your venue ID
ORDER BY created_at DESC
LIMIT 5;
```

**What to look for:**
- **If `pdf_images_count` is NULL or 0:** PDF images weren't generated
- **If `pdf_images_count` > 0:** Images were generated, check if they're accessible

---

## Step 3: Check Storage Bucket (1 minute)

**In Supabase SQL Editor**, run:

```sql
-- Check if menus bucket is public
SELECT name, public, file_size_limit
FROM storage.buckets
WHERE name = 'menus';
```

**Expected result:**
```
name   | public | file_size_limit
-------|--------|----------------
menus  | true   | 52428800
```

**If `public` is `false`:** This is your problem! Run the fix script below.

---

## Step 4: Check Storage Files (1 minute)

**In Supabase Dashboard → Storage → menus bucket**

Look for files like:
- `YOUR_VENUE_ID/menu-page-1-TIMESTAMP.png`
- `YOUR_VENUE_ID/menu-page-2-TIMESTAMP.png`

**If you see these files:** Images were generated successfully  
**If you don't see these files:** PDF conversion failed

---

## Step 5: Check Railway Logs (2 minutes)

**Go to Railway Dashboard → Your Service → Logs**

Search for:
```
[PDF_TO_IMAGES]
[PDF_PROCESS]
```

**Look for:**
- ✅ `PDF loaded successfully. Total pages: X`
- ✅ `Page X converted successfully. URL: ...`
- ❌ `Error converting PDF to images`
- ❌ `Failed to get public URL`

---

## 🔧 **THE FIX** (Most Likely Issue)

### Run This SQL Script in Supabase:

```sql
-- 1. Add pdf_images column if missing
ALTER TABLE menu_uploads
ADD COLUMN IF NOT EXISTS pdf_images TEXT[] DEFAULT '{}';

-- 2. Make menus bucket public (CRITICAL!)
UPDATE storage.buckets
SET public = true
WHERE name = 'menus';

-- 3. Create public read policy
DROP POLICY IF EXISTS "Public Read" ON storage.objects;

CREATE POLICY "Public Read"
ON storage.objects FOR SELECT
USING (bucket_id = 'menus');

-- 4. Verify
SELECT name, public FROM storage.buckets WHERE name = 'menus';
```

**This script is in:** `scripts/fix-pdf-storage.sql`

---

## 🎯 **Most Common Issues & Solutions**

### Issue 1: Storage Bucket Not Public
**Symptom:** Images generated but URLs return 403 Forbidden  
**Solution:** Run the SQL script above to make bucket public

### Issue 2: pdf_images Column Missing
**Symptom:** Database error when saving PDF images  
**Solution:** Run the SQL script above to add the column

### Issue 3: PDF Conversion Failing
**Symptom:** No images in storage, errors in Railway logs  
**Solution:** Check Railway logs for specific error

### Issue 4: Wrong Venue ID
**Symptom:** Images generated for wrong venue  
**Solution:** Check that you're using the correct venue ID

---

## 🧪 **Test After Fix**

### Test 1: Check Database
```sql
SELECT 
  venue_id,
  array_length(pdf_images, 1) as image_count,
  pdf_images
FROM menu_uploads
WHERE venue_id = 'YOUR_VENUE_ID'
ORDER BY created_at DESC
LIMIT 1;
```

### Test 2: Check Storage
Go to **Supabase Dashboard → Storage → menus** and verify images exist

### Test 3: Test URL
Copy one of the URLs from `pdf_images` array and open it in a browser:
- ✅ **Should show:** The PDF page as an image
- ❌ **Should NOT show:** 403 Forbidden or 404 Not Found

### Test 4: Check Frontend
1. Go to your menu preview page
2. Open browser console (F12)
3. Look for: `[PDF MENU DISPLAY] Fetch result:`
4. Check if `pdfImagesLength` > 0

---

## 📋 **Complete Fix Checklist**

- [ ] Run `scripts/fix-pdf-storage.sql` in Supabase
- [ ] Verify menus bucket is public
- [ ] Verify pdf_images column exists
- [ ] Re-upload your PDF menu
- [ ] Check Railway logs for conversion success
- [ ] Check Supabase storage for image files
- [ ] Test image URLs in browser
- [ ] Refresh menu preview page
- [ ] Check browser console for errors

---

## 🚨 **Still Not Working?**

### Check These:

1. **Railway Logs:**
   ```bash
   # Look for these errors:
   - "Error converting PDF to images"
   - "Failed to upload page"
   - "Failed to get public URL"
   ```

2. **Browser Console:**
   ```javascript
   // Open browser console and check:
   - [PDF MENU DISPLAY] Fetch result
   - pdfImagesLength
   - Any CORS errors
   ```

3. **Supabase Storage:**
   - Go to Storage → menus bucket
   - Check if files exist
   - Check file permissions
   - Try downloading a file manually

4. **Database:**
   ```sql
   -- Check if data is being saved
   SELECT * FROM menu_uploads 
   WHERE venue_id = 'YOUR_VENUE_ID' 
   ORDER BY created_at DESC 
   LIMIT 1;
   ```

---

## 🎯 **Quick Test Endpoint**

After Railway deploys, test this:

```bash
# Check PDF images status
curl "https://your-app.up.railway.app/api/menu/check-pdf-images?venueId=YOUR_VENUE_ID"
```

**Expected response:**
```json
{
  "ok": true,
  "venueId": "venue-123",
  "uploads": [
    {
      "has_pdf_images": true,
      "pdf_images_count": 3,
      "pdf_images": ["url1", "url2", "url3"]
    }
  ]
}
```

---

## 📞 **Need More Help?**

1. **Check Railway logs** for `[PDF_TO_IMAGES]` errors
2. **Check Supabase storage** for image files
3. **Check database** for pdf_images column
4. **Check browser console** for fetch errors
5. **Test image URLs** directly in browser

---

**The most common issue is the storage bucket not being public!** Run the SQL script above and re-upload your PDF. 🚀

