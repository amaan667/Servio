# Menu Display Options by Subscription Tier

## Overview
Servio offers different menu display options based on the venue's subscription tier, providing flexibility and premium features for higher-tier customers.

---

## Subscription Tiers & Features

### 🆓 **Basic Tier**
**Display:** Vertical Sidebar Menu (Default)
- Clean vertical category sidebar
- Search functionality
- Responsive mobile menu
- Item cards with images
- Add to cart functionality

**Use Case:** Perfect for venues starting out or with simple menus

---

### ⭐ **Standard Tier**
**Display:** Vertical Sidebar Menu (Default)
- All Basic features
- Enhanced styling options
- Custom branding colors

**Use Case:** Growing venues with established menus

---

### 👑 **Premium Tier**
**Display:** Multiple Options with Toggle
1. **PDF Image View** (Visual Menu)
   - Beautiful PDF menu as images
   - Interactive hotspots with add to cart
   - Maintains original menu design
   - Professional presentation

2. **List View** (Order Here)
   - Vertical sidebar with categories
   - All items with descriptions
   - Search functionality
   - Modern card layout
   - Add to cart on every item

**Toggle Button:** Premium users can switch between views instantly

**Use Case:** 
- Established restaurants with professional PDF menus
- Venues that want to preserve their brand aesthetic
- Businesses importing from existing menu websites

---

## Feature Comparison

| Feature | Basic | Standard | Premium |
|---------|-------|----------|---------|
| Vertical Sidebar Menu | ✅ | ✅ | ✅ |
| Search Functionality | ✅ | ✅ | ✅ |
| Mobile Responsive | ✅ | ✅ | ✅ |
| Custom Branding | ❌ | ✅ | ✅ |
| PDF Image View | ❌ | ❌ | ✅ |
| View Toggle | ❌ | ❌ | ✅ |
| Hotspot Ordering | ❌ | ❌ | ✅ |
| Menu Import from URL | ❌ | ❌ | ✅ |

---

## Menu Replication from Existing Sites

### For Premium Tier Only

**If a venue has an existing menu website:**

1. **Provide Menu URL**
   - We scrape/parse their site
   - Extract items, prices, descriptions
   - Download images
   - Identify categories

2. **Import Process**
   ```
   Existing Menu → Parse → Database → Display Options
   ```

3. **Result**
   - Same beautiful menu
   - + QR code ordering
   - + Kitchen display
   - + Payment processing
   - + Analytics

4. **Display Options**
   - **PDF View:** If they have a PDF menu
   - **List View:** Structured data view with sidebar
   - **Toggle:** Switch between both

---

## Technical Implementation

### Basic/Standard Users
```typescript
<StyledMenuDisplay>
  └─ <VerticalMenuDisplay>
      ├─ Sidebar Categories
      ├─ Search Bar
      └─ Item Grid
```

### Premium Users
```typescript
<EnhancedPDFMenuDisplay>
  ├─ View Toggle (PDF / List)
  ├─ PDF Image View
  │   ├─ Menu as Images
  │   ├─ Interactive Hotspots
  │   └─ Add to Cart Overlay
  └─ List View
      ├─ Vertical Sidebar
      ├─ Search Functionality
      └─ Item Cards with Add to Cart
```

---

## User Experience Flow

### Basic/Standard Venue:
```
QR Scan → Vertical Menu → Select Items → Cart → Checkout
```

### Premium Venue (with PDF):
```
QR Scan → PDF View (default)
         ├─ Browse Visual Menu
         ├─ Click Hotspots to Add Items
         └─ Toggle to List View
              ├─ Search Items
              ├─ Browse Categories
              └─ Add to Cart
```

### Premium Venue (imported from website):
```
Menu URL → Import Process → Database
                            ├─ Generate PDF View (optional)
                            └─ List View (default)
```

---

## Benefits by Tier

### Basic Benefits
- ✅ Professional ordering system
- ✅ Mobile-friendly menu
- ✅ QR code ordering
- ✅ Real-time kitchen updates

### Standard Benefits
- ✅ All Basic features
- ✅ Custom branding
- ✅ Enhanced styling

### Premium Benefits
- ✅ All Standard features
- ✅ PDF menu preservation
- ✅ Multiple view options
- ✅ Menu import from URL
- ✅ Hotspot ordering
- ✅ Professional presentation
- ✅ Quick onboarding (import existing menus)

---

## Setup Process

### Basic/Standard
1. Add menu items manually
2. Upload images (optional)
3. Organize categories
4. Generate QR codes
5. **Done** - Vertical menu ready

### Premium (with PDF)
1. Upload PDF menu
2. System converts to images
3. Add hotspots (auto or manual)
4. Map items to hotspots
5. Generate QR codes
6. **Done** - PDF + List view ready

### Premium (from existing site)
1. Provide menu URL
2. System scrapes/parses
3. Auto-imports items & images
4. Reviews & confirms
5. Generate QR codes
6. **Done** - Professional menu in minutes

---

## Conclusion

Our tiered approach ensures:
- **Everyone** gets a great ordering experience
- **Standard** users get branding control
- **Premium** users get maximum flexibility and quick setup
- **Venues** can start simple and upgrade as they grow

The PDF image view + list view combination for premium users is **perfect** for:
- Restaurants with existing professional menus
- Quick onboarding from menu websites
- Maintaining brand aesthetic while adding modern functionality

