// Table Management Types
// These types define the structure for the new table management system

export type TableStatus = "FREE" | "OCCUPIED";
export type ReservationStatus = "BOOKED" | "CHECKED_IN" | "CANCELLED" | "NO_SHOW";
export type ReservationState = "RESERVED_NOW" | "RESERVED_LATER" | "NONE";

export interface Table {
  id: string;
  venue_id: string;
  label: string;
  seat_count: number;
  area: string | null;
  is_active: boolean;
  qr_version: number;
  created_at: string;
  updated_at: string;
}

export interface TableSession {
  id: string;
  venue_id: string;
  table_id: string;
  order_id: string | null;
  status: TableStatus;
  opened_at: string;
  closed_at: string | null;
  server_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Reservation {
  id: string;
  venue_id: string;
  table_id: string | null; // null for unassigned reservations
  customer_name: string;
  customer_phone: string | null;
  start_at: string;
  end_at: string;
  party_size: number;
  status: ReservationStatus;
  created_at: string;
  updated_at: string;
}

export interface TableRuntimeState {
  // Table info
  table_id: string;
  venue_id: string;
  label: string;
  seat_count: number;
  area: string | null;
  is_active: boolean;

  // Live session state
  session_id: string | null;
  primary_status: TableStatus | null;
  opened_at: string | null;
  server_id: string | null;

  // Reservation state
  reservation_status: ReservationState;

  // Current reservation (if any)
  reserved_now_id: string | null;
  reserved_now_start: string | null;
  reserved_now_end: string | null;
  reserved_now_party_size: number | null;
  reserved_now_name: string | null;
  reserved_now_phone: string | null;

  // Next reservation (if any)
  next_reservation_id: string | null;
  next_reservation_start: string | null;
  next_reservation_end: string | null;
  next_reservation_party_size: number | null;
  next_reservation_name: string | null;
  next_reservation_phone: string | null;
}

export interface UnassignedReservation {
  id: string;
  venue_id: string;
  start_at: string;
  end_at: string;
  party_size: number;
  customer_name: string;
  customer_phone: string | null;
  status: ReservationStatus;
  created_at: string;
}

export interface TableCounters {
  tables_set_up: number;
  in_use_now: number;
  reserved_now: number;
  reserved_later: number;
  waiting: number;
}

// API Request/Response types
export interface SeatPartyRequest {
  reservationId?: string;
  serverId?: string;
}

export interface AssignReservationRequest {
  tableId: string;
}

export interface CreateTableRequest {
  venueId: string;
  label: string;
  seatCount?: number;
  area?: string;
}

export interface CreateReservationRequest {
  venueId: string;
  tableId?: string;
  customerName: string;
  customerPhone?: string;
  startAt: string;
  endAt: string;
  partySize?: number;
}

// UI State types for table cards
export interface TableCardState {
  // Primary state (live)
  isFree: boolean;
  isOccupied: boolean;
  occupiedDuration?: string; // "2h 15m" format

  // Secondary state (reservation)
  hasReservationNow: boolean;
  hasReservationLater: boolean;
  reservationTime?: string; // "19:30" format
  reservationPartySize?: number;
  reservationName?: string;

  // Actions available
  canSeatParty: boolean;
  canCloseTable: boolean;
  canAssignReservation: boolean;
  canReleaseReservation: boolean;
}

// Filter types for table management UI
export type TableFilter =
  | "all"
  | "free"
  | "occupied"
  | "reserved_now"
  | "reserved_later"
  | "unassigned"
  | "closed_today";

export interface TableManagementState {
  tables: TableRuntimeState[];
  unassignedReservations: UnassignedReservation[];
  counters: TableCounters;
  selectedFilter: TableFilter;
  isLoading: boolean;
  error: string | null;
}
