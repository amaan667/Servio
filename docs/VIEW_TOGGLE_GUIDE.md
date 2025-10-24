# View Toggle System - How It Works

## 🎯 **How Users Decide What View Shows in the Ordering UI**

---

## **Automatic View Selection (Smart Defaults)**

### **Basic/Standard Tier Users**
```
Customer scans QR → Vertical Sidebar Menu (only option)
```
**No toggle buttons** - they see the beautiful vertical menu with categories on the left.

### **Premium Tier Users**

The system **automatically decides** based on what content is available:

```typescript
// Decision Logic
if (venue has PDF uploaded) {
  Default View: PDF Image View
  Toggle Options: [📸 Visual Menu] [📋 List View]
} else {
  Default View: List View  
  Toggle Options: [📋 List View] only
}
```

---

## **Premium View Toggle Buttons**

### **Location**
Top of the ordering page, above the menu:

```
┌─────────────────────────────────────────────┐
│  [📸 Visual Menu]  [📋 List View]  [🔍 Search] │
├─────────────────────────────────────────────┤
│                                             │
│            Menu Content Here                │
│                                             │
└─────────────────────────────────────────────┘
```

### **What Each Button Shows**

#### **📸 Visual Menu Button**
- Only appears if venue has uploaded a PDF
- Shows PDF menu as images
- Interactive hotspots overlay
- Click items to add to cart
- Zoom/pan controls
- Beautiful visual presentation

#### **📋 List View Button**
- Always available for premium users
- Shows vertical sidebar with categories
- Search functionality
- Item cards with add to cart
- Modern, functional layout

---

## **Component Logic**

### **File:** `components/EnhancedPDFMenuDisplay.tsx`

```typescript
// Line 62: State for current view
const [viewMode, setViewMode] = useState<'pdf' | 'list'>('pdf');

// Line 74-100: Check if PDF images exist
useEffect(() => {
  const fetchPDFImages = async () => {
    // Fetch PDF images from menu_uploads table
    const images = uploadData?.pdf_images || uploadData?.pdf_images_cc;
    
    if (images && images.length > 0) {
      setPdfImages(images);
      setViewMode('pdf'); // Default to PDF if available
    } else {
      setViewMode('list'); // Default to list if no PDF
    }
  };
}, [venueId]);

// Lines 337-355: Toggle Buttons
{pdfImages.length > 0 && (
  <Button onClick={() => setViewMode('pdf')}>
    Visual Menu
  </Button>
)}
<Button onClick={() => setViewMode('list')}>
  List View
</Button>

// Lines 374-497: Conditional Rendering
{viewMode === 'pdf' && pdfImages.length > 0 && (
  <PDFImageViewWithHotspots />
)}

{viewMode === 'list' && (
  <VerticalMenuWithSidebar />
)}
```

---

## **User Experience Flow**

### **Scenario 1: Premium with PDF Menu**

```
Customer Journey:
1. Scans QR code
2. Sees PDF Image View (default)
   - Beautiful menu photos
   - Click hotspots to order
3. Can toggle to List View
   - Search for specific items
   - Browse by category
4. Can toggle back to PDF View
   - Visual browsing experience
```

**Toggle Buttons Visible:** ✅ Both
- [📸 Visual Menu] (active)
- [📋 List View]

### **Scenario 2: Premium with URL Import Only**

```
Customer Journey:
1. Scans QR code
2. Sees List View (default)
   - Vertical sidebar
   - Items from imported website
   - All images preserved
3. No PDF option (not uploaded)
```

**Toggle Buttons Visible:** ✅ One
- [📋 List View] (active, only option)

### **Scenario 3: Premium with PDF + URL Import**

```
Customer Journey:
1. Scans QR code
2. Sees PDF Image View (default)
   - Original menu design
3. Can toggle to List View
   - Shows imported items
   - Vertical sidebar
   - Search functionality
4. Toggle back anytime
```

**Toggle Buttons Visible:** ✅ Both
- [📸 Visual Menu]
- [📋 List View]

---

## **Decision Tree**

```
Customer Scans QR Code
│
├─ Is venue Premium?
│   NO → Show Vertical Sidebar Menu (Basic/Standard)
│   │    └─ No toggle buttons
│   │
│   YES → Check for PDF
│         │
│         ├─ Has PDF Images?
│         │   YES → Default: PDF View
│         │         Toggle: [📸 Visual] [📋 List]
│         │         
│         └─ NO PDF → Default: List View
│                     Toggle: [📋 List] (only option)
```

---

## **Toggle State Management**

### **State Variable**
```typescript
const [viewMode, setViewMode] = useState<'pdf' | 'list'>('pdf');
```

### **Default Logic**
```typescript
if (pdfImages.length > 0) {
  setViewMode('pdf')  // Premium users see PDF first
} else {
  setViewMode('list') // Fallback to list if no PDF
}
```

### **User Control**
```typescript
// Customer clicks button → instant view change
<Button onClick={() => setViewMode('pdf')}>
<Button onClick={() => setViewMode('list')}>
```

### **Persistence**
Currently: No persistence (resets on page reload)
Future: Could save preference in localStorage

---

## **What Gets Displayed in Each View**

### **PDF Image View** 📸

**Shows:**
- PDF menu pages as high-quality images
- Interactive hotspots on each item
- Add to cart buttons on hotspots
- Zoom controls (+/-)
- Pan/drag functionality
- Page navigation (if multi-page)

**Best For:**
- Visual browsing
- Preserving original design
- Professional presentation
- High-end restaurants

**Data Source:**
- `menu_uploads.pdf_images` (array of image URLs)
- `menu_hotspots` (coordinates for each item)

### **List View** 📋

**Shows:**
- Vertical category sidebar (left)
- Search bar at top
- Item cards in grid (2 columns desktop)
- Each card has:
  - Name
  - Description
  - Price
  - Image (if available)
  - Add to cart button

**Best For:**
- Searching specific items
- Comparing items
- Quick ordering
- Accessibility

**Data Source:**
- `menu_items` table (all items)
- `menu_uploads.category_order` (category sequence)

---

## **Integration with Menu Import**

### **After URL Import:**

```
1. User imports from https://nurcafe.co.uk/menu
2. System scrapes and finds:
   ✓ 50 menu items
   ✓ 8 categories  
   ✓ 45 images
3. Items saved to menu_items table
4. Customer ordering page now shows:
   → List View with vertical sidebar
   → All imported items visible
   → Images displayed
   → Add to cart on each item
```

### **If They Also Upload PDF:**

```
1. Already have URL import (50 items)
2. Upload PDF menu
3. System creates hotspots
4. Customer ordering page now shows:
   → PDF View (default)
   → Toggle button appears
   → Can switch to List View
   → Both views use same menu_items data
```

---

## **Toggle Button Visibility Logic**

```typescript
// From EnhancedPDFMenuDisplay.tsx, line 337

{pdfImages.length > 0 && (
  <Button onClick={() => setViewMode('pdf')}>
    📸 Visual Menu
  </Button>
)}

<Button onClick={() => setViewMode('list')}>
  📋 List View
</Button>
```

**Result:**
- PDF button **only shows** if PDF images exist
- List button **always shows** (fallback option)
- Current view is highlighted (default variant)

---

## **Conditional Rendering**

```typescript
// Line 374: PDF View
{viewMode === 'pdf' && pdfImages.length > 0 && (
  <div className="pdf-image-view">
    {/* PDF pages with hotspots */}
  </div>
)}

// Line 501: List View  
{viewMode === 'list' && (
  <div className="list-view">
    {/* Vertical sidebar + item cards */}
  </div>
)}
```

**Only one view renders at a time** - instant switching with no reload.

---

## **Customer Control**

### **Customers Can:**
1. ✅ Start with default view (PDF if available)
2. ✅ Click toggle button to switch views
3. ✅ Switch back anytime
4. ✅ Use search in list view
5. ✅ Add to cart in both views
6. ✅ Zoom/pan in PDF view

### **Customers Cannot:**
- ❌ Edit menu items
- ❌ Change prices
- ❌ Modify categories
- ❌ Upload new PDF

(Those are owner features in dashboard)

---

## **Technical Implementation**

### **View State**
```typescript
'pdf'  → Shows PDF images with hotspots
'list' → Shows vertical sidebar menu
```

### **Data Flow**
```
menu_items (database)
    ↓
menuItems (prop from parent)
    ↓
EnhancedPDFMenuDisplay component
    ↓
    ├─ PDF View: Uses menuItems + hotspots
    └─ List View: Uses menuItems + categoryOrder
```

### **Both Views Use Same Data**
- Same menu_items array
- Same add to cart function
- Same cart state
- Different presentation only

---

## **Summary for Your Question**

### **"How does the user decide what view is in the ordering UI?"**

**Answer:**

1. **System Decides Default:**
   - PDF available → PDF View
   - No PDF → List View

2. **Customer Decides After:**
   - Sees toggle buttons (premium only)
   - Clicks to switch views
   - Instant switch, no reload
   - Can switch back anytime

3. **Venue Owner Decides Options:**
   - Upload PDF → Enable PDF view
   - Import from URL → Populate list view
   - Do both → Both views available
   - Premium tier → Toggle enabled

### **"What can be toggled?"**

**Premium users can toggle between:**
- 📸 **Visual Menu** (PDF image view with hotspots)
- 📋 **List View** (vertical sidebar with search)

**Basic/Standard users:**
- No toggle (only vertical sidebar menu)

---

## **Perfect for Menu Replication**

### **With URL Import + Premium:**

```
Existing Website (nurcafe.co.uk/menu)
    ↓
Import Items + Images
    ↓
List View (vertical sidebar)
    ↓
Customer Experience:
✓ Same menu items
✓ Same food photos
✓ Same descriptions
✓ Same categories
✓ + Add to cart
✓ + QR ordering
✓ + Kitchen display
✓ + Payment processing
```

### **If They Also Have PDF:**
```
PDF Menu Upload
    ↓
PDF Image View Available
    ↓
Toggle Button Appears
    ↓
Customer Can Choose:
├─ 📸 Visual Menu (beautiful PDF)
└─ 📋 List View (functional ordering)
```

**Best of both worlds!** 🎉

---

## 🚀 **Conclusion**

**The toggle system is automatic and smart:**
- Premium tier → Toggle available
- PDF uploaded → Visual Menu option appears
- URL imported → List View populated
- Customer → Chooses their preferred view
- Both views → Same ordering functionality

**Perfect for replicating existing menus while maintaining flexibility!** ✅

