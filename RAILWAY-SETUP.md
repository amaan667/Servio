# 🚂 Railway Setup Guide for PDF Processing

## ✅ What's Been Done:

1. ✅ **Removed Dockerfile** - Railway will use Nixpacks
2. ✅ **Updated package.json** - Node 20 specified, PORT variable in start script
3. ✅ **Updated PDF conversion** - Uses `pdf2pic` with `fromPath` for Railway
4. ✅ **Added runtime exports** - Ensures Node.js runtime for PDF processing

---

## 🔧 **Required Railway Environment Variables:**

Go to **Railway → Settings → Variables** and add these:

```bash
# Required for PDF processing
NIXPACKS_PKGS=graphicsmagick ghostscript

# Node version (already in package.json, but good to set)
NODE_VERSION=20

# Disable Next.js telemetry
NEXT_TELEMETRY_DISABLED=1

# Your existing Supabase variables
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# Your existing Redis variables
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token

# Your existing OpenAI variable
OPENAI_API_KEY=your_openai_key
```

---

## 📋 **How It Works:**

### **1. Nixpacks Installation**

When you deploy, Railway will automatically install:
- `graphicsmagick` - Image processing library
- `ghostscript` - PDF processing library

You'll see in the logs:
```
Installing nix packages: graphicsmagick ghostscript
```

### **2. PDF Conversion Flow**

```
1. PDF uploaded → /api/catalog/replace
2. PDF saved to /tmp/pdf2img/input.pdf
3. pdf2pic converts using GraphicsMagick/Ghostscript
4. Images saved to /tmp/pdf2img/out/page_1.png, page_2.png, etc.
5. Images uploaded to Supabase Storage
6. Public URLs stored in menu_uploads.pdf_images
7. Temp files cleaned up
8. Images displayed in preview tab ✅
```

### **3. Why This Works**

- ✅ **No Dockerfile** - Railway uses Nixpacks (faster, more reliable)
- ✅ **Native binaries** - GraphicsMagick/Ghostscript installed via Nixpacks
- ✅ **Temp directory** - Uses `/tmp` (writable on Railway)
- ✅ **Node.js runtime** - `export const runtime = 'nodejs'` ensures Node, not Edge
- ✅ **Force dynamic** - `export const dynamic = 'force-dynamic'` ensures fresh execution

---

## 🚀 **Deployment Steps:**

### **Step 1: Add Environment Variables**

1. Go to Railway dashboard
2. Click on your project
3. Go to **Settings** → **Variables**
4. Click **+ New Variable**
5. Add the variables listed above

### **Step 2: Deploy**

The code is already pushed to GitHub, so Railway will automatically deploy.

### **Step 3: Check Deployment Logs**

You should see:
```
Installing nix packages: graphicsmagick ghostscript
✓ Starting...
✓ Ready in 500ms
```

### **Step 4: Test PDF Upload**

1. Go to your dashboard
2. Go to Menu Management
3. Upload your PDF menu
4. Wait for processing
5. Check the Preview tab - **images should show!** ✅

---

## 🔍 **Troubleshooting:**

### **Issue: "spawn gm ENOENT"**

**Solution:** Make sure you added `NIXPACKS_PKGS=graphicsmagick ghostscript` to Railway variables.

### **Issue: "Cannot find module 'pdf2pic'"**

**Solution:** The package is already in `package.json`. Railway will install it automatically.

### **Issue: "Permission denied" writing to /tmp**

**Solution:** This shouldn't happen, but if it does, make sure you're writing to `/tmp` and not repo folders.

### **Issue: PDF conversion times out**

**Solution:** Large PDFs (>50 pages) might timeout. Consider:
- Converting in background job
- Processing fewer pages at once
- Increasing Railway timeout settings

---

## 📊 **Expected Logs:**

After uploading a PDF, you should see:

```
[PDF_TO_IMAGES] Starting PDF to images conversion for venue: venue-xxx
[PDF_TO_IMAGES] PDF written to temp file: /tmp/pdf2img/input.pdf
[PDF_TO_IMAGES] Converting PDF to images...
[PDF_TO_IMAGES] Converted 3 pages
[PDF_TO_IMAGES] Page 1 uploaded to storage: venue-xxx/menu-page-1-xxx.png
[PDF_TO_IMAGES] Page 1 converted successfully. URL: https://...
[PDF_TO_IMAGES] Page 2 uploaded to storage: venue-xxx/menu-page-2-xxx.png
[PDF_TO_IMAGES] Page 2 converted successfully. URL: https://...
[PDF_TO_IMAGES] Page 3 uploaded to storage: venue-xxx/menu-page-3-xxx.png
[PDF_TO_IMAGES] Page 3 converted successfully. URL: https://...
[PDF_TO_IMAGES] Conversion complete. Total images: 3
[PDF_TO_IMAGES] Cleaned up temp directory
```

---

## ✅ **Verification:**

### **After Deployment:**

1. **Check Railway Logs** - Should show Nixpacks installing packages
2. **Upload PDF** - Should complete without errors
3. **Check Preview Tab** - Should show PDF images
4. **Check Database** - `menu_uploads.pdf_images` should have URLs

### **SQL Query to Check:**

```sql
SELECT 
  id,
  venue_id,
  filename,
  array_length(pdf_images, 1) as pdf_images_count,
  created_at
FROM menu_uploads
WHERE venue_id = 'your-venue-id'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected result:**
```
pdf_images_count | 3 (or however many pages your PDF has)
```

---

## 🎯 **Summary:**

**What Changed:**
- ❌ Removed Dockerfile
- ✅ Added Nixpacks environment variables
- ✅ Updated PDF conversion to use `fromPath`
- ✅ Added runtime exports to ensure Node.js

**What You Need to Do:**
1. Add `NIXPACKS_PKGS=graphicsmagick ghostscript` to Railway variables
2. Deploy (automatic via GitHub)
3. Test PDF upload

**Expected Result:**
- ✅ PDF images show in preview tab
- ✅ No build errors
- ✅ Fast, reliable conversion

---

**Last Updated:** October 18, 2025
**Status:** Ready to Deploy ✅

