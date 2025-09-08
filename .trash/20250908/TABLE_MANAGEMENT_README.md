# Table Management Feature

This document describes the Table Management feature implementation for Servio MVP.

## Overview

The Table Management feature provides a live, operational view of restaurant tables with real-time status tracking and contextual actions. It integrates with the existing order system to provide a complete table lifecycle management solution.

## Features

### Core Functionality
- **Live Table Status**: Real-time view of table statuses (Free, Ordering, In Prep, Ready, Served, Awaiting Bill, Reserved, Closed)
- **Contextual Actions**: Smart actions based on current table status
- **Table Lifecycle Management**: Complete flow from seating to payment
- **Real-time Updates**: Live synchronization with order status changes
- **Search & Filtering**: Find tables quickly with search and status filters

### Table Status Flow
```
FREE → ORDERING → IN_PREP → READY → SERVED → AWAITING_BILL → CLOSED
  ↓                                                              ↑
RESERVED ────────────────────────────────────────────────────────┘
```

### Payment Integration
- **Pay Later Option**: Customers can place orders without immediate payment
- **Add More Items**: Customers can add items to their table after initial order
- **Flexible Payment**: Pay now or pay later workflow

## Database Schema

### Tables
```sql
CREATE TABLE tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id TEXT NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
    label TEXT NOT NULL, -- "Table 1", "Table 2", etc.
    seat_count INTEGER DEFAULT 2,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Table Sessions
```sql
CREATE TABLE table_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id TEXT NOT NULL REFERENCES venues(venue_id) ON DELETE CASCADE,
    table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'FREE' CHECK (status IN ('FREE', 'ORDERING', 'IN_PREP', 'READY', 'SERVED', 'AWAITING_BILL', 'RESERVED', 'CLOSED')),
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### View
```sql
CREATE VIEW tables_with_sessions AS
SELECT 
    t.id, t.venue_id, t.label, t.seat_count, t.is_active,
    ts.id as session_id, ts.status, ts.order_id, ts.opened_at, ts.closed_at,
    o.total_amount, o.customer_name, o.order_status, o.payment_status, o.updated_at as order_updated_at
FROM tables t
LEFT JOIN table_sessions ts ON t.id = ts.table_id 
    AND ts.id = (SELECT id FROM table_sessions ts2 WHERE ts2.table_id = t.id ORDER BY ts2.opened_at DESC LIMIT 1)
LEFT JOIN orders o ON ts.order_id = o.id
WHERE t.is_active = true;
```

## API Endpoints

### Tables
- `GET /api/tables?venue_id={id}` - Get all tables for a venue
- `POST /api/tables` - Create a new table
- `PUT /api/tables/[id]` - Update a table
- `DELETE /api/tables/[id]` - Delete a table

### Table Sessions
- `POST /api/table-sessions` - Create a new table session
- `PUT /api/table-sessions/[id]` - Update a table session
- `DELETE /api/table-sessions/[id]` - Delete a table session

### Table Actions
- `POST /api/table-sessions/actions` - Execute table actions
  - `start_preparing` - Mark order as in preparation
  - `mark_ready` - Mark order as ready
  - `mark_served` - Mark order as served
  - `mark_awaiting_bill` - Mark table as awaiting bill
  - `close_table` - Close table and create new free session
  - `reserve_table` - Reserve a table
  - `move_table` - Move session to another table

## Components

### Core Components
- `TableCard` - Individual table display with status and actions
- `StatusPill` - Visual status indicator with colors and icons
- `AddTableDialog` - Modal for creating new tables
- `TabFilters` - Filter tables by status
- `TableManagementClient` - Main page component

### Hooks
- `useTablesData` - Fetch and manage table data with real-time updates
- `useTableActions` - Execute table actions (start prep, mark ready, etc.)
- `useTableManagement` - CRUD operations for tables

## File Structure

```
app/dashboard/[venueId]/tables/
├── page.tsx                           # Main page wrapper
└── table-management-client.tsx        # Client component

components/table-management/
├── StatusPill.tsx                     # Status indicator
├── TableCard.tsx                      # Table display card
├── AddTableDialog.tsx                 # Add table modal
└── TabFilters.tsx                     # Status filters

hooks/
├── useTablesData.ts                   # Table data management
├── useTableActions.ts                 # Table action execution
└── useTableManagement.ts              # Table CRUD operations

app/api/
├── tables/
│   ├── route.ts                       # Tables CRUD
│   └── [id]/route.ts                  # Individual table operations
└── table-sessions/
    ├── route.ts                       # Session CRUD
    ├── [id]/route.ts                  # Individual session operations
    └── actions/route.ts               # Table actions

scripts/
├── create-table-management-tables.sql # Database schema
└── deploy-table-management.js         # Deployment script
```

## Installation & Setup

### 1. Database Setup
```bash
# Run the database migration
node scripts/deploy-table-management.js
```

### 2. Environment Variables
Ensure these environment variables are set:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### 3. Access the Feature
Navigate to `/dashboard/[venueId]/tables` to access the Table Management page.

## Usage

### For Staff
1. **View Tables**: See all tables with current status and order information
2. **Manage Status**: Use contextual actions to update table status
3. **Add Tables**: Create new tables as needed
4. **Filter & Search**: Find specific tables quickly

### For Customers
1. **Order Flow**: Place orders through the existing QR code system
2. **Pay Later**: Choose to pay immediately or pay later
3. **Add Items**: Add more items to existing orders
4. **Table Status**: See real-time updates of their order status

## Status Colors & Icons

- **FREE**: Green - Available for seating
- **ORDERING**: Amber - Customer is placing order
- **IN_PREP**: Amber - Kitchen is preparing order
- **READY**: Violet - Order is ready for service
- **SERVED**: Violet - Order has been served
- **AWAITING_BILL**: Slate - Waiting for payment
- **RESERVED**: Blue - Table is reserved
- **CLOSED**: Gray - Table session is closed

## Real-time Updates

The system uses Supabase Realtime to provide live updates:
- Table status changes
- Order updates
- New table creation
- Session modifications

## Security

- **Row Level Security (RLS)**: All tables are protected by RLS policies
- **Venue Isolation**: Users can only access tables for their venues
- **Action Validation**: All actions are validated server-side

## Integration Points

### With Existing Systems
- **Orders**: Tables are linked to orders for complete lifecycle tracking
- **Payment**: Integrated with existing payment flow
- **QR Codes**: Tables can be linked to QR codes for customer access
- **Live Orders**: Table status updates reflect in live orders view

### Future Enhancements
- **Table Merging**: Advanced table merging capabilities
- **Reservation System**: Full reservation management
- **Analytics**: Table utilization and performance metrics
- **Mobile App**: Native mobile app integration

## Troubleshooting

### Common Issues
1. **Tables not loading**: Check RLS policies and venue permissions
2. **Real-time not working**: Verify Supabase Realtime is enabled
3. **Actions failing**: Check API endpoint permissions and validation

### Debug Mode
Enable debug logging by checking browser console for:
- `[TABLES HOOK]` - Table data operations
- `[TABLE ACTIONS]` - Action execution
- `[TABLE SESSIONS]` - Session management

## Performance Considerations

- **Pagination**: Large venues should implement table pagination
- **Real-time Limits**: Monitor real-time subscription limits
- **Database Indexes**: Ensure proper indexing on venue_id and status columns
- **Caching**: Consider implementing table data caching for better performance

## Contributing

When adding new features:
1. Update the database schema if needed
2. Add appropriate API endpoints
3. Create/update React components
4. Add real-time subscriptions
5. Update this documentation

## Support

For issues or questions:
1. Check the browser console for error messages
2. Verify database permissions and RLS policies
3. Test API endpoints directly
4. Review the component state and props
