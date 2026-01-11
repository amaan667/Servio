// Kitchen Display System (KDS) Type Definitions

export interface KDSStation {

}

export interface KDSTicket {

  };
}

export type KDSTicketStatus = "new" | "in_progress" | "ready" | "bumped";

export interface KDSStationCategory {

}

// API Request/Response Types

export interface GetStationsRequest {

}

export interface GetStationsResponse {

}

export interface CreateStationRequest {

}

export interface CreateStationResponse {

}

export interface GetTicketsRequest {

}

export interface GetTicketsResponse {

}

export interface UpdateTicketRequest {

}

export interface UpdateTicketResponse {

}

export interface BulkUpdateTicketsRequest {
  orderId?: string;
  stationId?: string;

}

export interface BulkUpdateTicketsResponse {

}

// UI State Types

export interface KDSFilters {

}

export interface KDSStats {

}

export interface TicketGroup {

}
