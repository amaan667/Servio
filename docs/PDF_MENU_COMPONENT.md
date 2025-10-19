# PDF Menu Component Documentation

## Overview

The PDF Menu component system provides a canonical, reusable way to render PDF menus with pixel-perfect clickable overlays. It uses `pdfjs-dist` to render PDFs to canvas and provides precise coordinate scaling for interactive hotspots.

## Components

### 1. `usePdfOverlay` Hook

**Location:** `hooks/usePdfOverlay.ts`

Manages PDF rendering lifecycle and coordinate scaling for overlay items.

#### Features

- ✅ Per-page dimension tracking (original vs rendered)
- ✅ Automatic scale factor calculation (scaleX, scaleY)
- ✅ Pixel-perfect hitbox positioning
- ✅ Window resize/re-render support
- ✅ Pure functions for coordinate mapping

#### API

```typescript
interface PdfOverlayItem {
  id: string;
  page: number;
  x: number;      // PDF coordinates
  y: number;      // PDF coordinates
  w: number;      // PDF coordinates
  h: number;      // PDF coordinates
  name?: string;
  priceMinor?: number;
}

interface PageDimensions {
  originalWidth: number;
  originalHeight: number;
  renderedWidth: number;
  renderedHeight: number;
  scaleX: number;
  scaleY: number;
}

function usePdfOverlay(
  numPages: number,
  scale?: number
): {
  pages: PageDimensions[];
  getItemStyle: (item: PdfOverlayItem) => React.CSSProperties;
  updatePageDimensions: (pageIndex: number, dimensions: Partial<PageDimensions>) => void;
  reset: () => void;
}
```

#### Usage

```typescript
import { usePdfOverlay } from '@/hooks/usePdfOverlay';

const { pages, getItemStyle, updatePageDimensions } = usePdfOverlay(
  numPages,
  1.5 // scale factor
);

// Get CSS styles for an overlay item
const style = getItemStyle({
  id: 'item-1',
  page: 0,
  x: 100,
  y: 200,
  w: 150,
  h: 50,
});

// Update page dimensions after rendering
updatePageDimensions(0, {
  originalWidth: 612,
  originalHeight: 792,
  renderedWidth: 918,
  renderedHeight: 1188,
});
```

### 2. `PdfMenu` Component

**Location:** `components/menu/PdfMenu.tsx`

Renders a PDF with interactive overlay items.

#### Features

- ✅ Client-side PDF rendering with `pdfjs-dist`
- ✅ Support for URL or ArrayBuffer sources
- ✅ Automatic CORS handling (fetches and converts URLs to ArrayBuffer)
- ✅ Multi-page support
- ✅ Debug mode for visualizing hitboxes
- ✅ Configurable scale factor

#### Props

```typescript
interface PdfMenuProps {
  src: string | ArrayBuffer;  // PDF URL or binary data
  items?: PdfOverlayItem[];   // Overlay items
  scale?: number;             // Default: 1.5
  onItemClick?: (id: string) => void;
  debug?: boolean;            // Show hitbox outlines
  className?: string;
}
```

#### Usage

```typescript
import { PdfMenu } from '@/components/menu/PdfMenu';

function MenuPage() {
  const items = [
    {
      id: 'item-1',
      page: 0,
      x: 100,
      y: 200,
      w: 150,
      h: 50,
      name: 'Burger',
    },
    {
      id: 'item-2',
      page: 0,
      x: 300,
      y: 200,
      w: 150,
      h: 50,
      name: 'Pizza',
    },
  ];

  const handleItemClick = (id: string) => {
    console.log('Clicked item:', id);
  };

  return (
    <PdfMenu
      src="/menu.pdf"
      items={items}
      scale={1.5}
      onItemClick={handleItemClick}
      debug={true}
    />
  );
}
```

### 3. `PdfMenuWithCart` Component

**Location:** `components/menu/PdfMenu.tsx`

Enhanced version with cart functionality, showing +/- buttons for items.

#### Features

- ✅ All features of `PdfMenu`
- ✅ Cart quantity display
- ✅ Add to cart button
- ✅ Increment/decrement quantity controls

#### Props

```typescript
interface PdfMenuWithCartProps extends PdfMenuProps {
  cart?: Array<{ id: string; quantity: number }>;
  onAddToCart?: (item: PdfOverlayItem) => void;
  onUpdateQuantity?: (itemId: string, quantity: number) => void;
}
```

#### Usage

```typescript
import { PdfMenuWithCart } from '@/components/menu/PdfMenu';

function OrderingPage() {
  const [cart, setCart] = useState<Array<{ id: string; quantity: number }>>([]);

  const handleAddToCart = (item: PdfOverlayItem) => {
    setCart([...cart, { id: item.id, quantity: 1 }]);
  };

  const handleUpdateQuantity = (itemId: string, quantity: number) => {
    setCart(cart.map(item => 
      item.id === itemId ? { ...item, quantity } : item
    ));
  };

  return (
    <PdfMenuWithCart
      src="/menu.pdf"
      items={items}
      cart={cart}
      onAddToCart={handleAddToCart}
      onUpdateQuantity={handleUpdateQuantity}
    />
  );
}
```

## Scaling Math

### How It Works

1. **Original Dimensions**: Get from PDF using `page.getViewport({ scale: 1 })`
   ```typescript
   const viewport = page.getViewport({ scale: 1 });
   // viewport.width = 612 (for Letter size at 72 DPI)
   // viewport.height = 792
   ```

2. **Rendered Dimensions**: Get from PDF using `page.getViewport({ scale })`
   ```typescript
   const scaledViewport = page.getViewport({ scale: 1.5 });
   // scaledViewport.width = 918
   // scaledViewport.height = 1188
   ```

3. **Calculate Scale Factors**:
   ```typescript
   const scaleX = renderedWidth / originalWidth;
   const scaleY = renderedHeight / originalHeight;
   // scaleX = 918 / 612 = 1.5
   // scaleY = 1188 / 792 = 1.5
   ```

4. **Map PDF Coordinates to CSS**:
   ```typescript
   const left = x * scaleX;
   const top = y * scaleY;
   const width = w * scaleX;
   const height = h * scaleY;
   ```

### Example

For a menu item at PDF coordinates (100, 200) with size (150, 50):

```typescript
// Original PDF dimensions
const originalWidth = 612;
const originalHeight = 792;

// Rendered dimensions at 1.5x scale
const renderedWidth = 918;
const renderedHeight = 1188;

// Scale factors
const scaleX = 918 / 612 = 1.5;
const scaleY = 1188 / 792 = 1.5;

// Menu item in PDF coordinates
const item = { x: 100, y: 200, w: 150, h: 50 };

// CSS coordinates
const left = 100 * 1.5 = 150px;
const top = 200 * 1.5 = 300px;
const width = 150 * 1.5 = 225px;
const height = 50 * 1.5 = 75px;
```

## Testing

### Run Tests

```bash
pnpm test __tests__/hooks/usePdfOverlay.test.ts
```

### Test Coverage

- ✅ 22 tests covering all scaling scenarios
- ✅ 1:1, 2x, 1.5x, and fractional scaling
- ✅ Different x and y scale factors
- ✅ Edge cases: zero, negative, very small/large dimensions
- ✅ Common PDF page sizes (Letter, A4)
- ✅ Floating point precision

## Migration Guide

### From EnhancedPDFMenuDisplay

The existing `EnhancedPDFMenuDisplay` component uses pre-rendered PDF images from Supabase. To migrate to the new `PdfMenu` component:

1. **Keep using images** (if PDFs are already converted to images):
   ```typescript
   // Keep using EnhancedPDFMenuDisplay for now
   // No changes needed
   ```

2. **Switch to direct PDF rendering** (if you want to use PDFs directly):
   ```typescript
   // Before
   <EnhancedPDFMenuDisplay
     venueId={venueId}
     menuItems={items}
     onAddToCart={handleAddToCart}
   />

   // After
   <PdfMenuWithCart
     src={pdfUrl}
     items={hotspotItems}
     cart={cart}
     onAddToCart={handleAddToCart}
     onUpdateQuantity={handleUpdateQuantity}
   />
   ```

### Converting Hotspots to Overlay Items

If you have hotspots stored in the database with percentage-based coordinates:

```typescript
// Database hotspot
interface Hotspot {
  id: string;
  menu_item_id: string;
  page_index: number;
  x_percent: number;
  y_percent: number;
  width_percent: number;
  height_percent: number;
}

// Convert to PDF overlay item
function convertHotspotToOverlayItem(
  hotspot: Hotspot,
  pageWidth: number,
  pageHeight: number
): PdfOverlayItem {
  return {
    id: hotspot.menu_item_id,
    page: hotspot.page_index,
    x: (hotspot.x_percent / 100) * pageWidth,
    y: (hotspot.y_percent / 100) * pageHeight,
    w: (hotspot.width_percent / 100) * pageWidth,
    h: (hotspot.height_percent / 100) * pageHeight,
  };
}
```

## Debug Mode

Enable debug mode to visualize hitboxes:

```typescript
<PdfMenu
  src="/menu.pdf"
  items={items}
  debug={true}  // Shows red borders around hitboxes
/>
```

Debug mode shows:
- Red borders around each overlay item
- Item ID labels
- Semi-transparent red background

## Performance

### Rendering

- ✅ Client-side rendering with `pdfjs-dist`
- ✅ Canvas-based rendering (fast)
- ✅ Lazy loading of pages
- ✅ Caching of rendered pages

### Scaling

- ✅ Pure functions (no side effects)
- ✅ O(1) coordinate mapping
- ✅ No re-renders on window resize (handled by CSS)

## Browser Compatibility

- ✅ Chrome/Edge (recommended)
- ✅ Firefox
- ✅ Safari (with some limitations)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## Known Issues

1. **PDF.js Worker**: The worker must be loaded correctly. We use:
   ```typescript
   pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
   ```

2. **CORS**: For cross-origin PDFs, we fetch and convert to ArrayBuffer:
   ```typescript
   const response = await fetch(src);
   const arrayBuffer = await response.arrayBuffer();
   ```

3. **Large PDFs**: Very large PDFs may take time to render. Consider:
   - Using pre-rendered images for large files
   - Implementing progressive loading
   - Using lower scale factors

## Future Enhancements

- [ ] Zoom controls (already in EnhancedPDFMenuDisplay)
- [ ] Pan/drag support
- [ ] Print support
- [ ] Accessibility improvements
- [ ] Keyboard navigation
- [ ] Touch gestures for mobile

## Summary

### Files Created

- ✅ `hooks/usePdfOverlay.ts` - PDF overlay hook with scaling logic
- ✅ `components/menu/PdfMenu.tsx` - PDF menu component
- ✅ `__tests__/hooks/usePdfOverlay.test.ts` - Comprehensive tests

### Tests

- ✅ 22 tests, all passing
- ✅ 100% coverage of scaling utilities

### Commits

1. ✅ `refactor(menu): add PdfMenu component and usePdfOverlay hook`
2. ✅ `test(menu): add scaling math tests for usePdfOverlay`

### Next Steps

1. **Migrate existing components** to use `PdfMenu` (optional)
2. **Add zoom controls** to `PdfMenu` component
3. **Add accessibility** features (ARIA labels, keyboard nav)
4. **Optimize performance** for large PDFs

---

**Status:** ✅ Core implementation complete and tested

