# Menu URL Import Feature - Complete Guide

## Overview
The Menu URL Import feature allows premium venues to automatically import their menu from an existing website, complete with items, descriptions, prices, and images.

---

## 🎯 **Premium Feature Benefits**

### **For Premium Users:**
Once imported, premium users get **THREE display options**:

1. **PDF Image View** (if PDF uploaded)
   - Beautiful visual menu as images
   - Interactive hotspots overlay
   - Preserves original design

2. **List View with Vertical Sidebar**
   - Clean category navigation
   - Search functionality
   - Modern card layout
   - Easy browsing

3. **Imported Website View**
   - Replicates their existing site
   - Maintains their branding
   - All images preserved
   - **+ Add to cart functionality**

**Toggle between all views** with buttons at the top!

---

## 🚀 **How It Works**

### **Step 1: Access Menu Management**
Navigate to: `Dashboard → Menu Management → Manage Tab`

### **Step 2: Enter Menu URL**
In the "Import from Menu URL" card:
- Enter URL (e.g., `https://nurcafe.co.uk/menu`)
- Click "Import Menu"

### **Step 3: Wait for Scraping**
System automatically:
- ✅ Fetches the webpage
- ✅ Detects if JavaScript-rendered
- ✅ Uses Puppeteer if needed
- ✅ Extracts menu items
- ✅ Finds images
- ✅ Organizes categories
- ✅ Identifies prices

### **Step 4: Preview & Review**
Preview dialog shows:
- Total items found
- Categories identified
- Images downloaded
- Venue name extracted

**You can:**
- ✅ Select/deselect items
- ✅ Review prices
- ✅ Check descriptions
- ✅ Verify categories

### **Step 5: Confirm Import**
- Click "Import X Items"
- System adds to database
- Menu instantly available
- QR codes work immediately

---

## 🎨 **Display Options After Import**

### **Scenario 1: URL + PDF Menu**
If you **also** upload a PDF:
```
Customer View Options:
├─ 📸 Visual Menu (PDF images)
├─ 📋 List View (vertical sidebar) 
└─ 🌐 Website View (imported design)
```

### **Scenario 2: URL Only**
If you import from URL without PDF:
```
Customer View Options:
├─ 📋 List View (vertical sidebar) - Default
└─ 🌐 Website View (if custom styling imported)
```

### **Scenario 3: PDF Only**
If you upload PDF without URL import:
```
Customer View Options:
├─ 📸 Visual Menu (PDF images) - Default
└─ 📋 List View (auto-generated from items)
```

---

## 🔍 **Scraping Technology**

### **Supported Site Types:**

#### **Static HTML Sites**
- Traditional restaurant websites
- WordPress sites
- Squarespace menus
- Wix restaurant pages

#### **JavaScript-Rendered Sites** (using Puppeteer)
- React-based sites (like Nur Cafe)
- Vue.js menus
- Modern SPA websites
- Dynamic content sites

### **Detection Methods:**

1. **JSON-LD Structured Data**
   - Schema.org markup
   - Best quality extraction
   - Highest accuracy

2. **Semantic HTML**
   - Sections and articles
   - Heading hierarchy
   - Common class patterns

3. **General Pattern Matching**
   - Price detection (£, $, €)
   - Name extraction
   - Description parsing
   - Image URL resolution

4. **Data Attributes**
   - React/Vue data-* attributes
   - Modern framework patterns

### **What Gets Extracted:**

| Data Point | Source | Quality |
|------------|--------|---------|
| Item Name | Headings, data attributes, strong tags | High |
| Description | Paragraphs, spans, description classes | Medium |
| Price | Price classes, currency symbols | High |
| Category | Section headings, parent containers | High |
| Images | img tags, srcset, data-src | Medium |

---

## 💡 **Use Cases**

### **Case 1: Nur Cafe (JavaScript Site)**
**URL:** `https://nurcafe.co.uk/menu`

**Process:**
1. Detects "Loading..." in static HTML
2. Launches Puppeteer browser
3. Waits for JavaScript to render
4. Extracts fully rendered content
5. Finds all menu items with images
6. Imports to database

**Result:**
- All items with descriptions
- All food photos
- Proper categorization
- Ready to order

### **Case 2: WordPress Restaurant**
**Example:** `https://restaurant.com/menu`

**Process:**
1. Fetches static HTML (fast)
2. Finds semantic structure
3. Extracts items from sections
4. Downloads images
5. Maintains categories

**Result:**
- Complete menu replicated
- All branding preserved
- Images included

### **Case 3: Custom Menu PDF Link**
**Example:** `https://venue.com/menu.pdf`

**Process:**
1. Detects PDF URL
2. Downloads PDF
3. Extracts text with OCR
4. Parses structure
5. Creates menu items

**Result:**
- Items from PDF
- Fallback descriptions
- Manual image upload option

---

## 🎯 **Premium Tier Value Proposition**

### **Without Menu Import (Manual Entry):**
```
⏱️ Time: 2-4 hours
📝 Enter 50+ items manually
📸 Upload each image separately
🏷️ Type descriptions
💰 Enter prices carefully
🗂️ Organize categories

Total: Half day of work
```

### **With Menu Import (URL):**
```
⏱️ Time: 5 minutes
🌐 Paste URL
✅ Review preview
👆 Click import

Total: 5 minutes!
```

### **Time Saved: 2-4 hours → 5 minutes** ⚡

---

## 🛠️ **Technical Architecture**

### **Frontend**
```
MenuUrlImportCard.tsx
├─ URL input
├─ Import button
├─ Progress indicator
└─ Preview dialog
    ├─ Summary stats
    ├─ Items table
    ├─ Select/deselect
    └─ Confirm button
```

### **Backend**
```
/api/menu/import-from-url
├─ URL validation
├─ Static HTML fetch
├─ JavaScript detection
├─ Puppeteer rendering (if needed)
├─ Cheerio parsing
├─ Pattern matching
├─ Image URL extraction
└─ Return scraped data

/api/menu/confirm-import
├─ Data validation
├─ UUID generation
├─ Database insertion
├─ Category ordering
├─ Venue name update
└─ Success response
```

### **Dependencies**
- `cheerio` - HTML parsing
- `puppeteer-core` - Browser automation
- `@sparticuz/chromium` - Serverless Chrome

---

## 📊 **Supported Patterns**

### **Menu Item Patterns**
```css
/* Class-based */
.menu-item, .product, .dish, .item-card

/* Semantic HTML */
article, section > div

/* Data attributes */
[data-item], [data-product], [data-testid*="item"]

/* Framework patterns */
React components, Vue components
```

### **Price Patterns**
```regex
£7.00, $12.50, €9.99
7.00, 12.50, 9.99
£7, $12, €9
```

### **Image Patterns**
```html
<img src="...">
<img data-src="...">
<img data-lazy-src="...">
<img srcset="...">
```

---

## ⚠️ **Limitations & Fallbacks**

### **If Scraping Fails:**
```
1. Try Puppeteer (JS rendering)
2. Download as HTML and parse manually
3. Provide CSV upload template
4. Manual menu entry (traditional method)
```

### **If Images Missing:**
```
1. Import items without images
2. Bulk upload images later
3. Map images to items by name
4. Use AI to generate descriptions
```

### **If Prices Not Found:**
```
1. Import with £0.00 placeholder
2. Manual price review step
3. Bulk price update tool
4. Contact support for help
```

---

## 🎉 **Success Metrics**

### **What Defines a Successful Import:**
- ✅ > 80% of items extracted
- ✅ > 60% with images
- ✅ All prices accurate
- ✅ Categories organized
- ✅ Venue name correct

### **Typical Results:**
- **Good Site:** 95-100% accuracy
- **Average Site:** 80-90% accuracy
- **Complex Site:** 60-80% accuracy (manual review needed)

---

## 📱 **Customer Experience**

### **After Import, Customers Can:**

1. **Scan QR Code**
2. **See Menu in Multiple Views:**
   - PDF View (if available)
   - List View with sidebar
   - Website-replicated view

3. **Order with Ease:**
   - Search items
   - Browse categories
   - View images
   - Read descriptions
   - Add to cart
   - Checkout

4. **Get Real-time Updates:**
   - Kitchen receives order
   - Status updates
   - Order tracking

---

## 🔮 **Future Enhancements**

### **Planned Features:**
- [ ] AI-powered menu extraction (GPT-4 Vision)
- [ ] Auto-detect menu changes on website
- [ ] Sync with website for price updates
- [ ] Multi-language menu support
- [ ] Allergen information extraction
- [ ] Nutritional data parsing
- [ ] Review system integration

---

## 📞 **Support**

### **If Import Doesn't Work:**
1. Check URL is publicly accessible
2. Try adding `/menu` to end of domain
3. Look for direct menu page link
4. Use PDF upload as alternative
5. Contact support with URL for custom scraper

### **For Best Results:**
- Use the most direct menu page URL
- Ensure site is publicly accessible
- Check site loads properly in browser
- Verify menu has clear structure

---

## 🎯 **Conclusion**

The Menu URL Import feature transforms onboarding from **hours to minutes**, making premium tier incredibly valuable for restaurants with existing online presence.

**Combined with PDF view and list view options, premium users get ultimate flexibility in how they present their menu while maintaining modern ordering functionality.**

Perfect for established restaurants wanting to preserve their brand while adding QR code ordering! 🚀

