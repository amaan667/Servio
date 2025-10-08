# Settings Page Upgrade - Complete Guide

## 🎉 What's New

The Settings page has been completely redesigned with modern UI/UX and powerful new features:

### ✨ Visual Improvements
- **Two-column layout** on larger screens for better organization
- **Modern card design** with shadows and rounded corners
- **Purple gradient theme** (#8B5CF6) with pink accents
- **Section headers with icons** for easy navigation
- **Sticky "Save Changes" button** that appears when you have unsaved changes
- **Success toast notifications** for user feedback

### 🆕 New Features

#### 1. Account Information
- Email Address (read-only)
- Full Name (read-only)

#### 2. Venue Settings
- **Venue Name** - Your business name
- **Venue Type** - Select from: Café, Restaurant, Dessert Lounge, Food Truck, Bar/Pub, Other
- **Type of Service** - Choose: Table Service, Pickup/Counter Orders, or Both
- **Timezone Selector** - Auto-detected from browser, with popular timezones
- **Venue Email** - Contact email for your venue
- **Venue Phone** - Contact phone number
- **Enhanced Address Input**:
  - Google Places Autocomplete (when API key is configured)
  - Interactive map preview
  - Falls back to manual entry with OpenStreetMap geocoding
- **Operating Hours** - Expandable section to set hours for each day of the week

#### 3. Security Settings (Collapsible)
- **Password Management** - Set or change password
- **Two-Factor Authentication** - Toggle for 2FA (coming soon)

#### 4. Danger Zone
- **Delete Account** - Enhanced confirmation with type "DELETE" requirement
- Clear warnings about permanent data deletion

## 🔧 Setup Instructions

### Step 1: Run Database Migration

Before using the new features, you need to add new columns to the `venues` table.

**Option A: Using Supabase SQL Editor**
1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `/migrations/add-venue-settings-columns.sql`
4. Execute the script

**Option B: Using Supabase CLI**
```bash
supabase db push /migrations/add-venue-settings-columns.sql
```

The migration adds:
- `timezone` - IANA timezone identifier
- `venue_type` - Type of venue (cafe, restaurant, etc.)
- `service_type` - Type of service offered
- `operating_hours` - JSON object with daily hours
- `latitude` / `longitude` - Coordinates for map preview

### Step 2: (Optional) Configure Google Maps API

For the best address input experience with autocomplete:

1. **Get a Google Maps API Key**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable "Maps JavaScript API" and "Places API"
   - Create credentials (API key)
   - Restrict the API key to your domain for security

2. **Add to Environment Variables**:
   ```env
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
   ```

3. **Restart your development server**:
   ```bash
   npm run dev
   ```

**Without Google Maps API**: The address input will still work using:
- Manual address entry
- OpenStreetMap for geocoding and map preview
- No API key required

### Step 3: Test the New Features

1. Navigate to Settings page: `/dashboard/[venueId]/settings`
2. You should see:
   - Two-column layout on desktop
   - All new venue setting fields
   - Enhanced address input (with or without Google autocomplete)
   - Collapsible Security section
   - Enhanced Danger Zone

## 📋 Database Schema Changes

### New Columns in `venues` table:

```sql
-- Timezone
timezone TEXT DEFAULT 'Europe/London'

-- Venue Type
venue_type TEXT DEFAULT 'restaurant'
-- Values: cafe, restaurant, dessert_lounge, food_truck, bar_pub, other

-- Service Type
service_type TEXT DEFAULT 'table_service'
-- Values: table_service, counter_pickup, both

-- Operating Hours (JSON)
operating_hours JSONB
-- Structure: { 
--   monday: { open: "09:00", close: "17:00", closed: false },
--   tuesday: { open: "09:00", close: "17:00", closed: false },
--   ...
-- }

-- Coordinates
latitude DECIMAL(10, 8)
longitude DECIMAL(11, 8)
```

## 🎨 Design System

### Colors
- **Primary Gradient**: `from-purple-600 to-pink-600` (#8B5CF6 to pink)
- **Section Headers**: Light purple/pink gradients (`from-purple-50 to-pink-50`)
- **Borders**: `border-gray-200` with `rounded-xl`
- **Shadows**: `shadow-lg` on cards

### Typography
- **Section Titles**: Icons with descriptive text
- **Helper Text**: Muted foreground color
- **Labels**: Clear, concise with optional icons

### Interactive Elements
- **Sticky Save Button**: Appears bottom-right on desktop, bottom on mobile
- **Success Messages**: Green accent with checkmark icon
- **Error Messages**: Red destructive variant
- **Accordions**: Smooth expand/collapse animations

## 🔐 Security Features

### Password Management
- Set password for OAuth users
- Change password for email/password users
- Minimum 6 characters validation
- Confirmation required
- Success feedback with auto-close

### Two-Factor Authentication (Future)
- Toggle switch prepared
- Currently disabled (coming soon)
- UI ready for implementation

### Account Deletion
- Enhanced confirmation modal
- Type "DELETE" requirement
- Multiple warnings
- Permanent action with cascading deletes

## 🌍 Timezone Support

Auto-detects user's timezone from browser and pre-selects it. Supported timezones:
- Europe: London, Paris, Berlin, Madrid, Rome, Amsterdam
- Americas: New York, Chicago, Los Angeles
- Asia: Dubai, Singapore, Tokyo
- Australia: Sydney

## 📱 Responsive Design

### Mobile (< 768px)
- Single column layout
- Save button fixed at bottom above navigation
- Full-width cards
- Touch-optimized controls

### Tablet (768px - 1024px)
- Single column layout
- Better spacing
- Responsive cards

### Desktop (> 1024px)
- Two-column grid layout
- Sticky save button (bottom-right)
- Maximum width container (7xl)
- Optimized spacing

## 🚀 Features Summary

| Feature | Status | Notes |
|---------|--------|-------|
| Two-column layout | ✅ Complete | Responsive |
| Account info section | ✅ Complete | Read-only |
| Venue settings | ✅ Complete | All fields |
| Timezone selector | ✅ Complete | Auto-detect |
| Venue type | ✅ Complete | 6 options |
| Service type | ✅ Complete | Radio buttons |
| Operating hours | ✅ Complete | Expandable |
| Enhanced address | ✅ Complete | With/without Google |
| Map preview | ✅ Complete | OpenStreetMap |
| Security section | ✅ Complete | Collapsible |
| Password mgmt | ✅ Complete | Set/Change |
| 2FA toggle | ✅ UI Ready | Coming soon |
| Danger zone | ✅ Complete | Enhanced confirm |
| Sticky save button | ✅ Complete | Desktop + Mobile |
| Toast notifications | ✅ Complete | Success/Error |
| Purple gradient theme | ✅ Complete | Brand colors |

## 🐛 Troubleshooting

### Issue: New fields not showing
**Solution**: Run the database migration script first

### Issue: Google autocomplete not working
**Solution**: 
1. Check `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set
2. Verify API key has Places API enabled
3. Check browser console for errors
4. Falls back to manual entry if unavailable

### Issue: Map preview not displaying
**Solution**: 
- Map uses OpenStreetMap (no API key required)
- Check address is valid and has enough details
- Geocoding happens after 1.5s delay

### Issue: Operating hours not saving
**Solution**: 
- Ensure you click "Save Changes" button
- Check for validation errors
- Verify database migration was successful

## 📝 Environment Variables

Add to your `.env.local`:

```env
# Optional: For Google Places Autocomplete
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Required: Existing Supabase variables
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## 🎯 Next Steps

After setup:
1. Test all features in development
2. Configure Google Maps API (optional)
3. Verify database migration in production
4. Deploy changes to production
5. Update user documentation

## 💡 Tips

- **Timezone**: Automatically detected but can be changed
- **Address**: Works without Google API using OpenStreetMap
- **Operating Hours**: Optional - leave collapsed if not needed
- **Save Changes**: Button only appears when you have unsaved changes
- **Mobile**: Optimized for touch with proper spacing

---

Need help? Check the main README or contact support.

