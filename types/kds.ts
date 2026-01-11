// Kitchen Display System (KDS) Type Definitions

export interface KDSStation {
  id: string;
  venue_id: string;
  station_name: string;
  station_type: string;
  display_order: number;
  color_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface KDSTicket {
  id: string;
  venue_id: string;
  order_id: string;
  station_id: string;
  item_name: string;
  quantity: number;
  special_instructions?: string;
  status: KDSTicketStatus;
  created_at: string;
  started_at?: string;
  ready_at?: string;
  bumped_at?: string;
  table_number?: number;
  table_label?: string;
  priority: number;
  updated_at: string;

  // Relations
  kds_stations?: KDSStation;
  orders?: {
    id: string;
    customer_name: string;
    order_status: string;
    payment_status?: string;
  };
}

export type KDSTicketStatus = "new" | "in_progress" | "ready" | "bumped";

export interface KDSStationCategory {
  id: string;
  venue_id: string;
  station_id: string;
  menu_category: string;
  created_at: string;
}

// API Request/Response Types

export interface GetStationsRequest {
  venueId: string;
}

export interface GetStationsResponse {
  ok: boolean;
  stations?: KDSStation[];
  error?: string;
}

export interface CreateStationRequest {
  venueId: string;
  stationName: string;
  stationType?: string;
  displayOrder?: number;
  colorCode?: string;
}

export interface CreateStationResponse {
  ok: boolean;
  station?: KDSStation;
  error?: string;
}

export interface GetTicketsRequest {
  venueId: string;
  stationId?: string;
  status?: KDSTicketStatus;
}

export interface GetTicketsResponse {
  ok: boolean;
  tickets?: KDSTicket[];
  error?: string;
}

export interface UpdateTicketRequest {
  ticketId: string;
  status: KDSTicketStatus;
}

export interface UpdateTicketResponse {
  ok: boolean;
  ticket?: KDSTicket;
  error?: string;
}

export interface BulkUpdateTicketsRequest {
  orderId?: string;
  stationId?: string;
  status: KDSTicketStatus;
}

export interface BulkUpdateTicketsResponse {
  ok: boolean;
  updated?: number;
  tickets?: KDSTicket[];
  error?: string;
}

// UI State Types

export interface KDSFilters {
  selectedStation: string | null;
  statusFilter: KDSTicketStatus | "all";
}

export interface KDSStats {
  newCount: number;
  inProgressCount: number;
  readyCount: number;
  totalActive: number;
  avgPrepTime?: number;
}

export interface TicketGroup {
  orderId: string;
  tickets: KDSTicket[];
  allReady: boolean;
  customerName?: string;
  tableLabel?: string;
}
