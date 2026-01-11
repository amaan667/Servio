/**
 * API Types - Type-safe API request/response definitions
 */

import type {
  OrderRow,
  TableRow,
  MenuItemRow,
  ReservationRow,
  VenueRow,
  UserVenueRoleRow,
  StaffInvitationRow,
  KDSTicketRow,
  PaymentRow,
  FeedbackRow,
} from "./database";

// ========================================
// GENERIC API TYPES
// ========================================

export interface ApiResponse<T = unknown> {

}

export interface ApiError {

  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {

  };
}

// ========================================
// ORDER API
// ========================================

export interface CreateOrderRequest {

    }>;
  }>;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  specialInstructions?: string;
}

export type CreateOrderResponse = ApiResponse<OrderRow>;

export interface GetOrdersRequest {

}

export type GetOrdersResponse = ApiResponse<OrderRow[]>;

export interface UpdateOrderStatusRequest {

}

export type UpdateOrderStatusResponse = ApiResponse<OrderRow>;

// ========================================
// TABLE API
// ========================================

export interface GetTablesRequest {

}

export type GetTablesResponse = ApiResponse<TableRow[]>;

export interface CreateTableRequest {

}

export type CreateTableResponse = ApiResponse<TableRow>;

export interface UpdateTableRequest {

}

export type UpdateTableResponse = ApiResponse<TableRow>;

// ========================================
// MENU API
// ========================================

export interface GetMenuItemsRequest {

}

export type GetMenuItemsResponse = ApiResponse<MenuItemRow[]>;

export interface CreateMenuItemRequest {

}

export type CreateMenuItemResponse = ApiResponse<MenuItemRow>;

export interface UpdateMenuItemRequest {

}

export type UpdateMenuItemResponse = ApiResponse<MenuItemRow>;

// ========================================
// RESERVATION API
// ========================================

export interface CreateReservationRequest {

}

export type CreateReservationResponse = ApiResponse<ReservationRow>;

export interface GetReservationsRequest {

}

export type GetReservationsResponse = ApiResponse<ReservationRow[]>;

// ========================================
// STAFF API
// ========================================

export interface InviteStaffRequest {

  permissions?: Record<string, boolean>;

}

export type InviteStaffResponse = ApiResponse<StaffInvitationRow>;

export interface GetStaffRequest {

}

export type GetStaffResponse = ApiResponse<UserVenueRoleRow[]>;

export interface UpdateStaffRoleRequest {

  permissions?: Record<string, boolean>;
}

export type UpdateStaffRoleResponse = ApiResponse<UserVenueRoleRow>;

// ========================================
// VENUE API
// ========================================

export interface GetVenueRequest {

}

export type GetVenueResponse = ApiResponse<VenueRow>;

export interface UpdateVenueRequest {

}

export type UpdateVenueResponse = ApiResponse<VenueRow>;

// ========================================
// PAYMENT API
// ========================================

export interface CreatePaymentRequest {

}

export type CreatePaymentResponse = ApiResponse<PaymentRow>;

export interface CreateStripeCheckoutRequest {

}

export type CreateStripeCheckoutResponse = ApiResponse<{

}>;

// ========================================
// KDS API
// ========================================

export interface GetKDSTicketsRequest {

}

export type GetKDSTicketsResponse = ApiResponse<KDSTicketRow[]>;

export interface UpdateKDSTicketRequest {

}

export type UpdateKDSTicketResponse = ApiResponse<KDSTicketRow>;

// ========================================
// FEEDBACK API
// ========================================

export interface SubmitFeedbackRequest {

}

export type SubmitFeedbackResponse = ApiResponse<FeedbackRow>;

export interface GetFeedbackRequest {

}

export type GetFeedbackResponse = ApiResponse<FeedbackRow[]>;

// ========================================
// ANALYTICS API
// ========================================

export interface GetAnalyticsRequest {

}

export interface AnalyticsMetrics {

  }>;
  ordersByStatus: Record<string, number>;

  }>;

  };
}

export type GetAnalyticsResponse = ApiResponse<AnalyticsMetrics>;

// ========================================
// TYPE GUARDS
// ========================================

export function isApiError(response: unknown): response is ApiError {
  return (
    typeof response === "object" &&
    response !== null &&
    "ok" in response &&
    response.ok === false &&
    "error" in response
  );
}

export function isApiSuccess<T>(response: unknown): response is ApiResponse<T> {
  return (
    typeof response === "object" && response !== null && "ok" in response && response.ok === true
  );
}
