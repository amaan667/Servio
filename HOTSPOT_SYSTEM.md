# Interactive Hotspot System Documentation

## Overview

The Interactive Hotspot System transforms static PDF menus into dynamic, interactive experiences. Users can click directly on menu items in the PDF to view details, add to cart, and explore the menu seamlessly.

## Features

### 🎯 Core Features

1. **OCR Hotspot Detection**
   - Automatically detects menu item positions on PDF pages using GPT-4o Vision
   - Stores clickable regions with coordinates
   - Confidence scoring for detection accuracy

2. **Interactive PDF Display**
   - Clickable hotspots overlaid on PDF menu images
   - Visual feedback on hover
   - Smooth animations and transitions

3. **Item Details Modal**
   - Beautiful modal showing item details
   - Quick add to cart functionality
   - Quantity controls
   - Price display with currency formatting

4. **Dual View Modes**
   - **PDF View**: Interactive image with clickable hotspots
   - **List View**: Searchable, filterable list of menu items

5. **Mobile Support**
   - Pinch-to-zoom functionality
   - Touch-friendly drag and pan
   - Sticky cart for mobile devices
   - Responsive design

6. **Image Optimization**
   - WEBP conversion utility
   - Image compression
   - Lazy loading support
   - Browser compatibility checks

## Architecture

### Database Schema

```sql
-- menu_hotspots table
CREATE TABLE menu_hotspots (
  id UUID PRIMARY KEY,
  venue_id TEXT NOT NULL,
  menu_item_id UUID NOT NULL,
  menu_upload_id UUID,
  page_index INTEGER NOT NULL,
  x_percent NUMERIC(5,2) NOT NULL,  -- 0-100
  y_percent NUMERIC(5,2) NOT NULL,  -- 0-100
  width_percent NUMERIC(5,2),       -- Optional
  height_percent NUMERIC(5,2),      -- Optional
  confidence NUMERIC(3,2),          -- 0-1
  detection_method TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### Components

#### 1. EnhancedPDFMenuDisplay
**Location**: `components/EnhancedPDFMenuDisplay.tsx`

Main component for displaying interactive PDF menus with hotspots.

**Props**:
- `venueId`: string - Venue identifier
- `menuItems`: MenuItem[] - Array of menu items
- `categoryOrder`: string[] | null - Category ordering
- `onAddToCart`: (item: any) => void - Add to cart handler
- `cart`: Array<{id: string, quantity: number}> - Current cart
- `onRemoveFromCart`: (itemId: string) => void - Remove from cart handler
- `onUpdateQuantity`: (itemId: string, quantity: number) => void - Update quantity handler
- `isOrdering`: boolean - Enable ordering mode

**Features**:
- Dual view mode (PDF/List)
- Search functionality
- Pinch-to-zoom
- Touch drag and pan
- Sticky cart (mobile)
- Hotspot rendering

#### 2. ItemDetailsModal
**Location**: `components/ItemDetailsModal.tsx`

Modal component for displaying item details and cart controls.

**Props**:
- `item`: MenuItem | null - Selected menu item
- `isOpen`: boolean - Modal open state
- `onClose`: () => void - Close handler
- `onAddToCart`: (item: MenuItem) => void - Add to cart handler
- `onUpdateQuantity`: (itemId: string, quantity: number) => void - Update quantity handler
- `quantity`: number - Current quantity in cart

#### 3. Image Utils
**Location**: `lib/image-utils.ts`

Utility functions for image processing and optimization.

**Functions**:
- `convertToWebP()` - Convert image to WEBP format
- `convertMultipleToWebP()` - Batch WEBP conversion
- `compressImage()` - Compress images with size limits
- `optimizeImageForWeb()` - Full optimization pipeline
- `getImageDimensions()` - Get image dimensions
- `supportsWebP()` - Check browser support
- `lazyLoadImage()` - Lazy load with Intersection Observer

### API Endpoints

#### 1. Detect Hotspots
**Endpoint**: `POST /api/menu/detect-hotspots`

Detects menu item positions on PDF pages using GPT-4o Vision.

**Request Body**:
```json
{
  "venueId": "venue_id_here"
}
```

**Response**:
```json
{
  "ok": true,
  "hotspots": 15,
  "detected": [
    {
      "item": "Margherita Pizza",
      "page": 1,
      "position": "45.5%, 30.2%",
      "confidence": 0.95
    }
  ]
}
```

#### 2. Trigger Hotspot Detection
**Endpoint**: `POST /api/menu/trigger-hotspot-detection`

Triggers hotspot detection with authentication.

**Request Body**:
```json
{
  "venueId": "venue_id_here"
}
```

**Response**:
```json
{
  "ok": true,
  "message": "Successfully detected 15 hotspots",
  "hotspots": 15,
  "detected": [...]
}
```

## Usage

### 1. Enable Hotspots

In the Menu Management interface:

1. Navigate to **Manage** tab
2. Upload a PDF menu (if not already uploaded)
3. Click **"Enable Interactive Hotspots"** button
4. Wait for detection to complete (uses GPT-4o Vision)
5. Hotspots are now active!

### 2. View Interactive Menu

1. Navigate to **Preview** tab
2. Select **PDF** view mode
3. Click on any menu item hotspot
4. View details in modal
5. Add to cart or adjust quantity

### 3. Switch Views

- **PDF View**: Interactive image with clickable hotspots
- **List View**: Searchable list with filters

Click the toggle buttons at the top to switch between views.

### 4. Mobile Features

- **Pinch to Zoom**: Pinch on the PDF to zoom in/out
- **Drag to Pan**: When zoomed in, drag to pan around
- **Sticky Cart**: Cart summary appears at bottom on mobile
- **Touch-Friendly**: Large touch targets for easy interaction

## Configuration

### Hotspot Detection Settings

The system uses GPT-4o Vision with the following settings:

```typescript
{
  model: 'gpt-4o',
  temperature: 0.1,
  max_tokens: 2000
}
```

### Image Optimization Settings

Default optimization settings:

```typescript
{
  format: 'webp',
  quality: 80,
  maxWidth: 1920,
  maxHeight: 1080
}
```

## Performance

### Optimization Strategies

1. **Lazy Loading**: Images load only when visible
2. **WEBP Format**: Smaller file sizes, faster loading
3. **Compression**: Automatic image compression
4. **Caching**: Hotspot data cached in database
5. **Indexed Queries**: Efficient database queries with indexes

### Browser Support

- ✅ Chrome/Edge (Full support)
- ✅ Firefox (Full support)
- ✅ Safari (Full support)
- ✅ Mobile browsers (Full support)
- ⚠️ IE11 (Limited support, WEBP not supported)

## Troubleshooting

### Hotspots Not Detected

**Issue**: No hotspots found after detection

**Solutions**:
1. Ensure PDF has clear text (not just images)
2. Check that menu items are properly extracted
3. Verify GPT-4o API key is configured
4. Check console for error messages

### Hotspots Not Clickable

**Issue**: Hotspots visible but not responding to clicks

**Solutions**:
1. Clear browser cache
2. Check browser console for errors
3. Verify `isOrdering` prop is set correctly
4. Ensure menu items exist in database

### Performance Issues

**Issue**: Slow loading or laggy interactions

**Solutions**:
1. Optimize PDF image sizes
2. Reduce number of hotspots per page
3. Enable lazy loading
4. Use WEBP format for images
5. Check network connection

## Future Enhancements

### Planned Features

1. **Manual Hotspot Editing**
   - Drag and drop to reposition hotspots
   - Resize hotspot regions
   - Add/remove hotspots manually

2. **Advanced Search**
   - Filter by category
   - Price range filters
   - Dietary restrictions
   - Allergen information

3. **Analytics**
   - Track hotspot clicks
   - Popular items analytics
   - User engagement metrics

4. **A/B Testing**
   - Test different hotspot designs
   - Compare PDF vs List view performance
   - Optimize conversion rates

5. **Multi-language Support**
   - Detect menu language
   - Multi-language item names
   - RTL support

## Development

### Running Migrations

```bash
# Apply hotspot schema
psql -d your_database -f migrations/menu-hotspots-schema.sql
```

### Testing

```bash
# Run tests
npm test

# Test hotspot detection
npm run test:hotspots

# Test image utilities
npm run test:image-utils
```

### Debugging

Enable debug logging:

```typescript
// In components
console.log('[HOTSPOT DEBUG]', hotspotData);

// In API routes
console.log('[HOTSPOT DETECT]', detectionResult);
```

## Support

For issues or questions:

1. Check this documentation
2. Review console logs
3. Check database for hotspot data
4. Verify API keys are configured
5. Contact support team

## License

This system is part of the Servio MVP platform.

