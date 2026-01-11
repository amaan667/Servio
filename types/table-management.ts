// Table Management Types
// These types define the structure for the new table management system

export type TableStatus = "FREE" | "OCCUPIED";
export type ReservationStatus = "BOOKED" | "CHECKED_IN" | "CANCELLED" | "NO_SHOW";
export type ReservationState = "RESERVED_NOW" | "RESERVED_LATER" | "NONE";

export interface Table {

}

export interface TableSession {

}

export interface Reservation {

}

export interface TableRuntimeState {
  // Table info

}

export interface UnassignedReservation {

}

export interface TableCounters {

}

// API Request/Response types
export interface SeatPartyRequest {
  reservationId?: string;
  serverId?: string;
}

export interface AssignReservationRequest {

}

export interface CreateTableRequest {

}

export interface CreateReservationRequest {

}

// UI State types for table cards
export interface TableCardState {
  // Primary state (live)

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

}
