# Hybrid Import - Actual Step-by-Step Flow

## 🔍 **What ACTUALLY Happens When You Upload URL + PDF**

### **Setup:**
- User has uploaded PDF menu (stored in `menu_uploads` table)
- PDF converted to images (array of image URLs)
- User enters: `https://yourrestaurant.co.uk/menu`
- Clicks "Smart Import"

---

## 📋 **Step-by-Step Execution**

### **Step 1: Frontend Validation** (HybridMenuImportCard.tsx)
```typescript
Line 46-48: Validate URL format
- Check if URL is valid
- Progress: 10%

Line 51-63: Check for existing PDF
- Query menu_uploads table for venue
- Get pdf_images array
- hasPDF = true/false
- Progress: 20%
```

**Decision Point:**
- If `hasPDF === false` → Skip to "No PDF Path" below
- If `hasPDF === true` → Continue with Vision AI

---

### **Step 2A: Scrape URL** (Inside /api/menu/hybrid-import)
```typescript
Line 51-62: Call /api/menu/import-from-url internally
- Fetch the menu URL
- Detect if JavaScript-rendered
- Use Puppeteer if needed
- Parse HTML with Cheerio
- Extract items

Returns:
{
  menuData: {
    items: [
      {
        name: "Grilled Halloumi",
        description: "Served with sweet chilli sauce",
        price: 7.00,
        category: "Starters",
        image_url: "https://yoursite.com/halloumi.jpg"
      },
      // ... more items
    ],
    venueName: "Your Restaurant",
    categories: ["Starters", "Mains", "Desserts"],
    imageCount: 42
  }
}

Console Output:
✅ [HYBRID IMPORT] Scraped items: 47
```

---

### **Step 3: Vision AI Analysis** (For each PDF page)
```typescript
Line 69-91: Loop through PDF images
For each pdfImages[pageIndex]:
  
  Call extractMenuItemPositions(imageUrl):
    - Uses GPT-4o Vision API
    - Sends PDF image to OpenAI
    - Prompt: "Find position of each menu item"
    - Returns: [{name, x, y, confidence}]
  
  Example Response:
  [
    {"name": "Grilled Halloumi", "x": 25, "y": 35, "confidence": 0.95},
    {"name": "Houmous", "x": 25, "y": 45, "confidence": 0.92},
    {"name": "Shakshuka Royale", "x": 75, "y": 40, "confidence": 0.98},
    // ... more items
  ]

Console Output:
👁️ [VISION] Analyzing page 1...
  ✅ [VISION] Found 23 items on page 1
👁️ [VISION] Analyzing page 2...
  ✅ [VISION] Found 24 items on page 2
✅ [HYBRID IMPORT] Total positions found: 47
```

---

### **Step 4: Intelligent Matching**
```typescript
Line 96-125: Match scraped items to Vision positions

For each item scraped from URL:
  For each position found by Vision:
    Calculate similarity score (Levenshtein distance)
    
  If best score > 70%:
    matchedItems.push({
      ...scrapedItem (name, price, description from URL),
      page: visionPosition.page,
      x_percent: visionPosition.x,
      y_percent: visionPosition.y,
      confidence: visionPosition.confidence
    })
  Else:
    unmatchedItems.push(scrapedItem)

Example Matching:
✅ "Grilled Halloumi" (URL) matches "Grilled Halloumi" (Vision) - 100%
✅ "Houmous" (URL) matches "Houmous" (Vision) - 100%
✅ "Shakshuka Royale" (URL) matches "Shakshuka Royale" (Vision) - 100%

Console Output:
  ✅ [MATCH] "Grilled Halloumi" → Position (25, 35) on page 1
  ✅ [MATCH] "Houmous" → Position (25, 45) on page 1
  ✅ [MATCH] "Shakshuka Royale" → Position (75, 40) on page 2
  ⚠️ [MATCH] "Some New Item" - No position found

📊 [HYBRID IMPORT] Matched items: 44
📊 [HYBRID IMPORT] Unmatched items: 3
📊 [HYBRID IMPORT] Match rate: 93.6%
```

**Returns to Frontend:**
```json
{
  "success": true,
  "matchedItems": [ /* 44 items with positions */ ],
  "unmatchedItems": [ /* 3 items without positions */ ],
  "totalScraped": 47,
  "totalPositions": 47,
  "matchRate": "93.6%"
}
```

---

### **Step 5: Database Import** (/api/menu/import-with-hotspots)
```typescript
Line 60-94: Insert matched items
For each matchedItem:
  Create menu_item:
    id: uuid
    venue_id: venue-xxx
    name: "Grilled Halloumi" (from URL)
    description: "Served with..." (from URL)
    price: 7.00 (from URL)
    category: "Starters" (from URL)
    image_url: "https://..." (from URL)
    is_available: true
    position: 0
  
  Create menu_hotspot:
    id: uuid
    venue_id: venue-xxx
    menu_item_id: [same as above]
    page_index: 0 (from Vision)
    x_percent: 25 (from Vision)
    y_percent: 35 (from Vision)
    width_percent: 15
    height_percent: 8

Line 99-135: Insert unmatched items
For each unmatchedItem:
  Create menu_item (same as above)
  Create menu_hotspot with AUTO-DISTRIBUTION:
    x_percent: 15 + (col * 20) // Spread horizontally
    y_percent: 20 + (row * 15) // Spread vertically

Line 138-157: Insert to database
- Delete existing hotspots for venue
- Insert all menu_items
- Insert all menu_hotspots

Console Output:
  ✅ [IMPORT] Grilled Halloumi → Hotspot at (25%, 35%)
  ✅ [IMPORT] Houmous → Hotspot at (25%, 45%)
  ✅ [IMPORT] Shakshuka Royale → Hotspot at (75%, 40%)
  ⚠️ [IMPORT] Some New Item → Auto-positioned (fallback)
✅ [IMPORT] Inserted menu items: 47
✅ [IMPORT] Inserted hotspots: 47
```

---

### **Alternative Path: No PDF Uploaded**
```typescript
Line 124-173: If hasPDF === false

Instead of hybrid-import:
1. Call /api/menu/import-from-url
   - Scrapes URL
   - Returns items

2. Call /api/menu/confirm-import
   - Inserts menu_items only
   - NO hotspots created
   - List view only

Progress: 30% → 60% → 80% → 100%

Toast: "Menu Imported Successfully! Imported 47 items from your website"
```

---

## 📊 **Database Changes**

### **Tables Affected:**

#### **1. menu_items**
```sql
INSERT INTO menu_items (
  id, venue_id, name, description, price, 
  category, image_url, is_available, position
) VALUES
  ('uuid1', 'venue-xxx', 'Grilled Halloumi', 'Served with...', 7.00, 'Starters', 'https://...', true, 0),
  ('uuid2', 'venue-xxx', 'Houmous', 'Homemade houmous...', 8.00, 'Starters', 'https://...', true, 1),
  -- ... 45 more items
```

#### **2. menu_hotspots** (Only if PDF exists)
```sql
DELETE FROM menu_hotspots WHERE venue_id = 'venue-xxx';

INSERT INTO menu_hotspots (
  id, venue_id, menu_item_id, page_index,
  x_percent, y_percent, width_percent, height_percent
) VALUES
  ('uuid-h1', 'venue-xxx', 'uuid1', 0, 25, 35, 15, 8), -- Grilled Halloumi
  ('uuid-h2', 'venue-xxx', 'uuid2', 0, 25, 45, 15, 8), -- Houmous
  ('uuid-h3', 'venue-xxx', 'uuid3', 1, 75, 40, 15, 8), -- Shakshuka (page 2, right column)
  -- ... 44 more hotspots
```

---

## 🎨 **What Customer Sees After Import**

### **If PDF + URL (Hybrid):**

**Customer scans QR → Ordering page loads:**

```typescript
// In EnhancedPDFMenuDisplay.tsx
useEffect(() => {
  // Fetches menu_uploads for pdf_images
  setPdfImages([...]) // 2 pages
  
  // Fetches menu_hotspots for this venue
  setHotspots([
    { menu_item_id: 'uuid1', page_index: 0, x_percent: 25, y_percent: 35 },
    { menu_item_id: 'uuid2', page_index: 0, x_percent: 25, y_percent: 45 },
    { menu_item_id: 'uuid3', page_index: 1, x_percent: 75, y_percent: 40 },
    // ... all hotspots
  ])
  
  // Fetches menu_items
  setMenuItems([...]) // All 47 items with descriptions, prices
})

// Renders PDF view
viewMode === 'pdf':
  Shows PDF image
  Overlays hotspot buttons at Vision AI coordinates:
    - Button at (25%, 35%) for Grilled Halloumi ← Perfect!
    - Button at (25%, 45%) for Houmous ← Perfect!
    - Button at (75%, 40%) for Shakshuka ← Perfect!
  
  User clicks button → Shows item details → Add to cart

// Can toggle to list view
viewMode === 'list':
  Shows VerticalMenuDisplay
  Categories on left sidebar
  All items from URL with images
  Search functionality
```

---

## ⚠️ **Current Issues I Found:**

### **Issue 1: Internal API Call**
```typescript
// Line 51 in hybrid-import/route.ts
const scrapeResponse = await fetch(
  `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/menu/import-from-url`,
  { ... }
);
```

**Problem:** 
- Making HTTP call to itself
- NEXT_PUBLIC_APP_URL might not be set
- Could fail in production

**Better Solution:**
- Import the scraping logic directly
- Don't make HTTP call to own API

### **Issue 2: Missing Error Handling**
- What if Vision API key not configured?
- What if Vision returns no positions?
- What if 0% match rate?

### **Issue 3: Unmatched Items**
- Auto-distributed on page 0
- Might overlap with matched items
- Could cause confusion

---

## ✅ **What IS Working:**

1. ✅ URL scraping with Puppeteer
2. ✅ Vision AI position detection (reuses existing function)
3. ✅ Fuzzy matching algorithm
4. ✅ Database insertion
5. ✅ Hotspot creation
6. ✅ Frontend progress tracking

---

## 🔧 **What Needs Fixing:**

1. **Refactor internal API call** - Import logic directly
2. **Add Vision API validation** - Check API key exists
3. **Better unmatched item handling** - Distribute on separate page
4. **Add preview step** - Show user what matched before importing
5. **Error recovery** - Handle partial failures

---

## 🎯 **Should It Work?**

**Theoretically: YES**
- Logic is sound
- All pieces exist
- Flow is correct

**Practically: NEEDS TESTING**
- Internal API call might fail
- Vision API might timeout
- Need to test with real menu

---

## 📝 **Recommended Next Steps:**

1. **Fix internal API call** - Import scraping logic directly
2. **Test with Nur Cafe** - See what actually happens
3. **Add preview dialog** - Show matched/unmatched before import
4. **Handle edge cases** - 0 matches, all matches, API failures

---

**Want me to fix these issues before testing?**

