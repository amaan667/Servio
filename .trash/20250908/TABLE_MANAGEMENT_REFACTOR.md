# Table Management Refactor - Complete Implementation

## 🎯 Overview

This refactor implements a **layered state system** for table management that separates:
- **Live State**: FREE (available) or OCCUPIED (seated) - from `table_sessions`
- **Reservation State**: RESERVED_NOW, RESERVED_LATER, or NONE - from `reservations`

This allows tables to show **"FREE now + Reserved for 19:30"** simultaneously, exactly how real venues operate.

## 🏗️ Architecture

### Data Model

```sql
-- Tables (physical table definitions)
tables(id, venue_id, label, seat_count, area, is_active, qr_version, ...)

-- Live session state (FREE = available, OCCUPIED = seated)
table_sessions(id, venue_id, table_id, status enum('FREE','OCCUPIED'), opened_at, closed_at, server_id)

-- Reservations (bookings with optional table assignment)
reservations(id, venue_id, table_id nullable, start_at, end_at, party_size, name, phone, status enum('BOOKED','CHECKED_IN','CANCELLED','NO_SHOW'))
```

### Key Constraints

- **One open session per table**: `UNIQUE (table_id) WHERE closed_at IS NULL`
- **No double booking**: Exclusion constraint on `(table_id, tstzrange(start_at, end_at))`
- **Reservations can be unassigned**: `table_id` can be `NULL`

## 🔄 State Transitions

### Live State (Primary Layer)
- **FREE → OCCUPIED**: Seat party (walk-in or reservation check-in)
- **OCCUPIED → FREE**: Close table (after all checks paid)

### Reservation State (Secondary Layer)
- **BOOKED → CHECKED_IN**: When party is seated
- **BOOKED → CANCELLED**: When reservation is cancelled
- **BOOKED → NO_SHOW**: When party doesn't arrive

### Combined States
A table can be in any combination:
- `FREE + RESERVED_LATER` → "Free until 19:30"
- `FREE + RESERVED_NOW` → "Reserved – due now"
- `OCCUPIED + RESERVED_LATER` → "Occupied, next booking at 19:30"
- `OCCUPIED + RESERVED_NOW` → "Occupied" (reservation marked CHECKED_IN)

## 📊 Runtime View

The `table_runtime_state` view combines both layers:

```sql
SELECT 
  table_id, label, seat_count, area,
  live_status,                    -- 'FREE' | 'OCCUPIED'
  reservation_state,              -- 'RESERVED_NOW' | 'RESERVED_LATER' | 'NONE'
  reserved_now_name,              -- Customer name if reserved now
  next_reservation_start,         -- Next booking time
  next_reservation_name           -- Next customer name
FROM table_runtime_state
WHERE venue_id = 'your-venue-id';
```

## 🚀 API Endpoints

### Tables
- `GET /api/tables?venueId=xxx` - Get all tables with runtime state
- `POST /api/tables` - Create new table
- `POST /api/tables/[tableId]/seat` - Seat party at table
- `POST /api/tables/[tableId]/close` - Close table
- `GET /api/tables/counters?venueId=xxx` - Get dashboard counters

### Reservations
- `GET /api/reservations?venueId=xxx` - Get all reservations
- `POST /api/reservations` - Create new reservation
- `POST /api/reservations/[id]/assign` - Assign reservation to table
- `POST /api/reservations/[id]/cancel` - Cancel reservation
- `GET /api/reservations/unassigned?venueId=xxx` - Get unassigned reservations

## 📈 Dashboard Counters

The new counters provide accurate, separated metrics:

```typescript
interface TableCounters {
  totalTables: number;           // All active tables
  available: number;             // FREE tables (no session or FREE session)
  occupied: number;              // OCCUPIED tables
  reservedNow: number;           // Tables with overlapping reservations
  reservedLater: number;         // Tables with future reservations today
  unassignedReservations: number; // Reservations without table assignment
}
```

## 🎨 UI Implementation

### Table Cards
Each table card shows two layers:

**Primary Chip (Live State):**
- 🟢 **FREE** - Available for seating
- 🟡 **OCCUPIED** - Currently seated + elapsed time

**Secondary Chip (Reservation State):**
- 🔴 **Reserved now** - Overlapping reservation
- 🟣 **Reserved at 19:30** - Future reservation
- (No chip) - No reservation

### Quick Actions
Context-sensitive actions based on state:

- **FREE + RESERVED_LATER**: "Seat party" (pre-fill reservation)
- **FREE + RESERVED_NOW**: "Check in" (mark reservation CHECKED_IN)
- **OCCUPIED**: "View checks / Close table"
- **Always**: "QR", "Assign reservation", "Release reservation"

### Filters
- **All** - Show all tables
- **Free now** - Available tables
- **Occupied now** - Seated tables
- **Reserved now** - Tables with overlapping reservations
- **Reserved later** - Tables with future reservations
- **Waiting** - Unassigned reservations
- **Closed today** - Tables closed today

## 🔧 Database Functions

### Core Actions
```sql
-- Seat party (FREE → OCCUPIED)
SELECT api_seat_party(table_id, reservation_id, server_id);

-- Close table (OCCUPIED → FREE)
SELECT api_close_table(table_id);

-- Assign reservation to table
SELECT api_assign_reservation(reservation_id, table_id);

-- Cancel reservation
SELECT api_cancel_reservation(reservation_id);
```

### Utility Functions
```sql
-- Get table runtime state
SELECT * FROM get_table_runtime_state(venue_id);

-- Get dashboard counters
SELECT * FROM api_table_counters(venue_id);

-- Ensure all tables have FREE sessions
SELECT ensure_free_sessions_for_active_tables();
```

## 🧪 Testing

Run the test script to validate the implementation:

```bash
psql -d your_database -f scripts/test-table-management-refactor.sql
```

The test covers:
- ✅ Basic table runtime state
- ✅ Creating reservations (assigned and unassigned)
- ✅ Seating parties (with and without reservations)
- ✅ Dashboard counters accuracy
- ✅ Assigning unassigned reservations
- ✅ Closing tables
- ✅ Cancelling reservations
- ✅ Edge cases (double seating, unpaid orders)

## 🚀 Deployment

1. **Run the database migration:**
   ```bash
   psql -d your_database -f scripts/table-management-refactor-complete.sql
   ```

2. **Deploy the API endpoints** (already created in `/app/api/`)

3. **Update your frontend** to use the new API endpoints and types

4. **Test the implementation:**
   ```bash
   psql -d your_database -f scripts/test-table-management-refactor.sql
   ```

## 🎯 Acceptance Criteria

- ✅ Tables can display FREE now and Reserved for 19:30 simultaneously
- ✅ Counters show accurate metrics without "last action wins" artifacts
- ✅ Seating a reserved party converts reservation to CHECKED_IN
- ✅ Closing table blocked until all checks paid
- ✅ Fresh FREE session created when table closes
- ✅ Filters work correctly for all states
- ✅ No "last action wins" bugs - status and reservation layers are independent

## 🔍 Key Benefits

1. **Real-world accuracy**: Matches how restaurants actually operate
2. **No more conflicts**: Live state and reservations are independent
3. **Better UX**: Staff can see both current and future table status
4. **Accurate reporting**: Dashboard counters reflect true state
5. **Flexible reservations**: Can be assigned later or remain unassigned
6. **Audit trail**: Complete history of table sessions and reservations

## 📝 Migration Notes

- **Backward compatible**: Existing data is preserved
- **Gradual rollout**: Can be deployed incrementally
- **No data loss**: All existing sessions and reservations remain intact
- **Performance optimized**: Proper indexes for fast queries

The refactor transforms table management from a simple state machine to a sophisticated, real-world system that handles the complexity of restaurant operations while maintaining data integrity and performance.
