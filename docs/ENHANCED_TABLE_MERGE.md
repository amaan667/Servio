# Enhanced Table Merge System

This document describes the comprehensive table merge functionality implemented according to the specified requirements.

## 🔑 General Principles

- **Default behavior**: Show only FREE tables (safe, most common case)
- **Advanced option**: "Show all tables" toggle to allow expansion/merge of occupied/reserved tables with proper checks
- **State source of truth**:
  - A table is **Occupied** if it has a live session OR any active order
  - A table is **Reserved** if it has a reservation attached to the current/future slot
  - A table is **Free** if no session, no active order, no current reservation

## 🧩 Merge Scenarios & Logic

### 1. Free + Free ✅ (always allowed)
**Use case**: Bigger party arrives, combine two empty tables.
**Logic**:
- Create a new combined session (pending until seated)
- Either seat the party immediately or leave the joined set as "Available for seating"

### 2. Free + Occupied ✅ (Expansion)
**Use case**: Party at T10 needs more space, staff adds free T11.
**Logic**:
- Free table joins the occupied session
- All new orders still flow to the occupied table's session ID
- Outstanding bills remain unchanged (they're tied to the session)
- Timer/seated duration inherits from the occupied table's session

### 3. Free + Reserved ⚠️ (Expansion of reservation)
**Use case**: A reservation at T5 needs extra seats, add free T6.
**Logic**:
- Free table is added to the reservation before the party arrives
- Reservation capacity increases accordingly
- When party checks in, both T5 + T6 flip to "Occupied" under the same session

### 4. Occupied + Occupied ⚠️ (Merge sessions)
**Use case**: Two parties mistakenly seated separately but are actually one group (T3 + T4).
**Logic**:
- Warning modal: "This will merge two active bills into one. Outstanding unpaid balances will be combined."
- Choose a primary session; move all orders & payment groups from the secondary into it
- Secondary session closes
- Mark secondary table as joined to the primary
- Only allowed with manager/staff confirmation

### 5. Reserved + Reserved ⚠️ (Same reservation only)
**Use case**: Booking for 10 was mistakenly placed as two reservations (T7 + T8).
**Logic**:
- Allowed only if the reservation IDs match (or staff explicitly merges reservations)
- If merged → one reservation record, one party, all tables grouped
- If reservations differ → block merge (to avoid mixing strangers)

### 6. Reserved + Occupied ❌ (different parties)
**Use case**: A reserved table (upcoming party) is next to an active table.
**Logic**:
- Not allowed: you cannot merge a future reservation with a current live party
- Staff must either cancel/convert the reservation or close the occupied session first

### 7. Cleaning/Blocked/Out of Service ❌
**Logic**:
- These states are never eligible for merging
- Keep them hidden from the merge picker

## ⚙️ UI Flow

1. **Merge modal default**: List only FREE tables
2. **Add toggle/button** → "Show other tables"
3. **In expanded view**:
   - Eligible (same session/reservation) → selectable
   - Ineligible → greyed out with tooltip ("Different session", "Different reservation")
4. **When risky merges are attempted** (Occupied+Occupied, Reserved+Reserved) → confirmation dialog with explicit warning

## ✅ Acceptance Criteria

- ✅ By default, staff sees only FREE tables when merging
- ✅ Staff can expand to see other states, but:
  - Occupied+Occupied requires confirmation
  - Reserved+Reserved requires confirmation and only if same reservation
  - Reserved+Occupied is blocked
- ✅ When a free table is merged into occupied/reserved, it inherits session/reservation from the primary
- ✅ Active orders + bills remain untouched unless a true session merge is confirmed

## 🏗️ Implementation Architecture

### Core Components

1. **`lib/table-states.ts`** - Core logic for table state detection and merge validation
2. **`components/table-management/EnhancedTableMergeDialog.tsx`** - Main merge dialog with safety-first UI
3. **`components/table-management/MergeConfirmationDialog.tsx`** - Confirmation dialog for risky operations
4. **`app/api/table-sessions/enhanced-merge/route.ts`** - Backend API for merge operations
5. **`hooks/useEnhancedTableMerge.ts`** - React hook for merge functionality

### Key Features

#### Table State Detection
```typescript
export function getTableState(table: any): TableStateInfo {
  // Determines if table is FREE, OCCUPIED, RESERVED, or BLOCKED
  // Based on session status, active orders, and reservations
}
```

#### Merge Scenario Validation
```typescript
export function getMergeScenario(sourceTable: any, targetTable: any): MergeScenario {
  // Returns merge type, allowed status, confirmation requirements, and warnings
}
```

#### Safe UI Defaults
- Default view shows only FREE tables
- "Show all tables" toggle for advanced operations
- Clear visual indicators for table states
- Tooltips explaining why certain merges are blocked

#### Confirmation System
- Risky merges require explicit confirmation
- User must type confirmation text (e.g., "MERGE ACTIVE BILLS")
- Clear warnings about what will happen

### API Endpoints

#### Enhanced Merge API
```typescript
POST /api/table-sessions/enhanced-merge
{
  "source_table_id": "uuid",
  "target_table_id": "uuid", 
  "venue_id": "string",
  "confirmed": boolean // Required for risky operations
}
```

### Database Operations

The system handles various merge scenarios with appropriate database updates:

1. **Free + Free**: Creates combined table with merged label and seat count
2. **Free + Occupied**: Marks free table as merged with occupied table
3. **Free + Reserved**: Marks free table as merged with reserved table  
4. **Occupied + Occupied**: Combines sessions, merges outstanding amounts
5. **Reserved + Reserved**: Groups tables under same reservation

## 🔒 Safety Features

1. **Default Safe Mode**: Only shows free tables by default
2. **Visual Warnings**: Clear indicators for risky operations
3. **Confirmation Required**: Explicit confirmation for dangerous merges
4. **State Validation**: Comprehensive validation before allowing merges
5. **Error Handling**: Graceful error handling with user-friendly messages

## 🎯 Usage Examples

### Basic Free Table Merge
1. Click "Merge Table" on any free table
2. Select another free table from the list
3. Confirm merge - tables are combined immediately

### Expanding Occupied Table
1. Click "Merge Table" on occupied table
2. Toggle "Show all tables" 
3. Select a free table
4. Confirm merge - free table joins the occupied session

### Risky Session Merge
1. Click "Merge Table" on occupied table
2. Toggle "Show all tables"
3. Select another occupied table
4. System shows warning about combining bills
5. Type "MERGE ACTIVE BILLS" to confirm
6. Tables are merged with combined outstanding amounts

This implementation provides the safety-first approach requested while enabling the flexibility real restaurants need for table management and party expansions.
