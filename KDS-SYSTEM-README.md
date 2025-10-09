# Kitchen Display System (KDS) - Implementation Guide

## Overview

The Kitchen Display System (KDS) is a comprehensive back-of-house solution that manages order preparation across multiple kitchen stations. It works seamlessly with Live Orders and Table Management to create a complete restaurant operations workflow.

## System Architecture

```
Order Flow:
Customer Order → Live Orders (FOH) → KDS Tickets (BOH) → Table Management → Analytics
```

### Three Connected Systems

| Feature | Audience | Purpose | Status View |
|---------|----------|---------|-------------|
| **Live Orders** | Servers, Managers | Track overall order flow | "Order #45 – In Progress" |
| **KDS** | Kitchen, Barista, Expo | Prepare items, track prep times | "Ticket #45 – Grill – Cheeseburger – READY" |
| **Table Management** | Hosts, Servers | Track table status | "Table 7 – Paid ✅" |

## Database Schema

The KDS system uses three main tables:

### 1. `kds_stations`
Represents different preparation stations (Grill, Fryer, Barista, etc.)

**Columns:**
- `id` - UUID primary key
- `venue_id` - Link to venue
- `station_name` - Display name (e.g., "Grill", "Barista")
- `station_type` - Type identifier (e.g., 'grill', 'fryer', 'barista', 'expo')
- `display_order` - Order for UI display
- `color_code` - Hex color for UI theming
- `is_active` - Enable/disable station

### 2. `kds_tickets`
Individual preparation tickets for each order item at specific stations

**Columns:**
- `id` - UUID primary key
- `venue_id` - Link to venue
- `order_id` - Link to order
- `station_id` - Link to station
- `item_name` - Menu item name
- `quantity` - Number of items
- `special_instructions` - Customer notes
- `status` - Ticket status: 'new', 'in_progress', 'ready', 'bumped'
- Timing fields: `created_at`, `started_at`, `ready_at`, `bumped_at`
- `table_number`, `table_label` - Table information
- `priority` - Urgency level

### 3. `kds_station_categories`
Maps menu categories to stations for automatic routing

**Columns:**
- `station_id` - Link to station
- `menu_category` - Menu category name

## Setup Instructions

### 1. Run Database Migrations

```bash
# Execute the KDS schema migration
psql -d your_database < migrations/kds-system-schema.sql
```

Or use Supabase SQL Editor to run the contents of `migrations/kds-system-schema.sql`.

### 2. Set Up Default Stations

The system automatically creates default stations when first accessed. You can also manually trigger setup:

```sql
SELECT setup_default_kds_stations('your-venue-id');
```

Default stations created:
- **Expo** - Main expediting station (default for all items)
- **Grill** - Hot grill items
- **Fryer** - Fried items
- **Barista** - Coffee and beverages
- **Cold Prep** - Salads, cold items

### 3. Configure Station Routing (Optional)

Map menu categories to specific stations:

```sql
INSERT INTO kds_station_categories (venue_id, station_id, menu_category)
VALUES 
  ('venue-id', 'station-id', 'Burgers'),
  ('venue-id', 'station-id', 'Drinks');
```

## Features

### Automatic Ticket Creation

When a new order is placed:
1. Trigger automatically creates KDS tickets
2. Each order item gets a ticket at the appropriate station
3. Tickets appear in "New" column on KDS dashboard

### Real-time Updates

- Uses Supabase Realtime for instant ticket updates
- Auto-refreshes every 30 seconds
- Live synchronization between Live Orders and KDS

### Status Workflow

```
NEW → IN_PROGRESS → READY → BUMPED
```

**Status Descriptions:**
- **New** - Ticket just created, waiting for prep
- **In Progress** - Kitchen is actively preparing
- **Ready** - Item is complete and ready for serving
- **Bumped** - Item has been served to customer

### Order Status Sync

KDS automatically updates order status:
- First ticket started → Order status = `IN_PREP`
- All tickets ready → Order status = `READY`
- All tickets bumped → Order status = `COMPLETED`

### Priority Indicators

Tickets are color-coded by age:
- 🟢 Green: < 5 minutes
- 🟡 Yellow: 5-10 minutes
- 🟠 Orange: 10-15 minutes
- 🔴 Red: > 15 minutes (overdue)

## API Endpoints

### Get Stations
```
GET /api/kds/stations?venueId={venueId}
```

### Get Tickets
```
GET /api/kds/tickets?venueId={venueId}&stationId={stationId}&status={status}
```

### Update Ticket Status
```
PATCH /api/kds/tickets
Body: { ticketId: string, status: string }
```

### Bulk Update Tickets
```
PATCH /api/kds/tickets/bulk-update
Body: { orderId: string, status: string }
```

## UI Components

### KDS Dashboard (`/dashboard/[venueId]/kds`)

**Layout:** Kanban-style with 3 columns
1. **New** - Incoming tickets
2. **In Progress** - Active prep
3. **Ready** - Complete items

**Features:**
- Station selector tabs
- Real-time ticket updates
- Timer display for each ticket
- Special instructions highlighting
- Bulk "Bump Order" action
- Auto-refresh toggle

### Ticket Card Information

Each ticket displays:
- Item name and quantity
- Table number/label
- Special instructions (if any)
- Time elapsed since creation
- Quick action buttons

## Integration with Other Systems

### Live Orders Integration

- KDS tickets automatically update order status
- Live Orders shows aggregated view of all tickets
- Real-time sync via Supabase triggers

### Table Management Integration

- When all tickets bumped → Table status can update
- Table information displayed on tickets
- Helps coordinate front-of-house service

### Analytics Integration

- Ticket timestamps feed into analytics
- Track average prep time per station
- Monitor kitchen efficiency metrics

## Usage Examples

### Example 1: Order Workflow

```
1. Customer scans QR → Places order (2 burgers, 2 coffees)
2. Order appears in Live Orders as "PLACED"
3. KDS creates tickets:
   - 2x Burger → Grill Station (NEW)
   - 2x Coffee → Barista Station (NEW)
4. Grill chef clicks "Start Prep" → Tickets = IN_PROGRESS
5. Grill chef finishes → Clicks "Ready" → Tickets = READY
6. Server sees "Order Ready" in Live Orders
7. Server delivers food → Clicks "Bump Order" → Tickets = BUMPED
8. Order status = COMPLETED
```

### Example 2: Special Instructions

```
Order: "Burger - No onions, extra cheese"

KDS Ticket displays:
┌─────────────────────────────┐
│ 1x Cheeseburger             │
│ Table 5                     │
│                             │
│ ⚠️ Special Instructions:    │
│ No onions, extra cheese     │
│                             │
│ ⏱️ 3m                       │
│ [Start Prep]                │
└─────────────────────────────┘
```

## Customization

### Add Custom Stations

```sql
INSERT INTO kds_stations (venue_id, station_name, station_type, display_order, color_code)
VALUES ('venue-id', 'Pizza Oven', 'pizza', 5, '#ff6b6b');
```

### Configure Auto-Routing

```sql
-- Route all pizza items to pizza station
INSERT INTO kds_station_categories (venue_id, station_id, menu_category)
SELECT 'venue-id', id, 'Pizza'
FROM kds_stations
WHERE station_name = 'Pizza Oven';
```

### Adjust Priority Thresholds

Edit `KDSClient.tsx`:
```typescript
const getPriorityIndicator = (createdAt: string) => {
  const minutes = elapsed / 60000;
  
  if (minutes > 20) return 'border-l-4 border-l-red-500';    // Customize threshold
  if (minutes > 15) return 'border-l-4 border-l-orange-500'; // Customize threshold
  // ... etc
};
```

## Troubleshooting

### Tickets Not Appearing

1. Check if stations exist:
   ```sql
   SELECT * FROM kds_stations WHERE venue_id = 'your-venue-id';
   ```

2. Verify trigger is active:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'trg_create_kds_tickets';
   ```

3. Check order status - tickets only create for new orders

### Status Not Syncing

1. Verify update trigger exists:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'trg_sync_order_status';
   ```

2. Check Supabase Realtime is enabled for tables:
   - `kds_tickets`
   - `orders`

### Performance Issues

1. Ensure indexes exist:
   ```sql
   SELECT * FROM pg_indexes WHERE tablename = 'kds_tickets';
   ```

2. Check query performance:
   ```sql
   EXPLAIN ANALYZE SELECT * FROM kds_tickets WHERE venue_id = 'xxx';
   ```

## Future Enhancements

Potential additions:
- [ ] Station-specific sounds/alerts
- [ ] Print ticket integration
- [ ] Kitchen timer presets per item
- [ ] Prep time analytics per station
- [ ] Multi-venue KDS aggregation
- [ ] Tablet/mobile optimized view
- [ ] Voice commands for hands-free operation
- [ ] Inventory deduction on ticket bump

## Security

All KDS endpoints are protected by:
- Row Level Security (RLS) policies
- Venue ownership verification
- User authentication checks

RLS ensures users can only see/modify tickets for their own venues.

## Performance

The system is optimized for:
- Real-time updates with minimal lag
- Efficient database queries with proper indexing
- Debounced UI updates to prevent excessive re-renders
- Lazy loading for large ticket volumes

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review database logs for trigger errors
3. Check browser console for API errors
4. Verify Supabase Realtime connection status

---

**Last Updated:** October 9, 2025
**Version:** 1.0.0

