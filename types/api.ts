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
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiError {
  ok: false;
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  ok: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// ========================================
// ORDER API
// ========================================

export interface CreateOrderRequest {
  venueId: string;
  tableId?: string;
  counterId?: string;
  orderType: "dine_in" | "takeaway" | "delivery";
  items: Array<{
    menuItemId: string;
    quantity: number;
    specialInstructions?: string;
    modifiers?: Array<{
      id: string;
      name: string;
      price: number;
    }>;
  }>;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  specialInstructions?: string;
}

export type CreateOrderResponse = ApiResponse<OrderRow>;

export interface GetOrdersRequest {
  venueId: string;
  status?: string;
  tableId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export type GetOrdersResponse = ApiResponse<OrderRow[]>;

export interface UpdateOrderStatusRequest {
  orderId: string;
  status: "pending" | "in_prep" | "ready" | "served" | "completed" | "cancelled";
}

export type UpdateOrderStatusResponse = ApiResponse<OrderRow>;

// ========================================
// TABLE API
// ========================================

export interface GetTablesRequest {
  venueId: string;
}

export type GetTablesResponse = ApiResponse<TableRow[]>;

export interface CreateTableRequest {
  venueId: string;
  label: string;
  seats: number;
  section?: string;
}

export type CreateTableResponse = ApiResponse<TableRow>;

export interface UpdateTableRequest {
  tableId: string;
  label?: string;
  seats?: number;
  section?: string;
  status?: "available" | "occupied" | "reserved" | "inactive";
}

export type UpdateTableResponse = ApiResponse<TableRow>;

// ========================================
// MENU API
// ========================================

export interface GetMenuItemsRequest {
  venueId: string;
  categoryId?: string;
  isAvailable?: boolean;
}

export type GetMenuItemsResponse = ApiResponse<MenuItemRow[]>;

export interface CreateMenuItemRequest {
  venueId: string;
  categoryId?: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  preparationTime?: number;
  tags?: string[];
  allergens?: string[];
}

export type CreateMenuItemResponse = ApiResponse<MenuItemRow>;

export interface UpdateMenuItemRequest {
  menuItemId: string;
  name?: string;
  description?: string;
  price?: number;
  imageUrl?: string;
  isAvailable?: boolean;
  preparationTime?: number;
}

export type UpdateMenuItemResponse = ApiResponse<MenuItemRow>;

// ========================================
// RESERVATION API
// ========================================

export interface CreateReservationRequest {
  venueId: string;
  tableId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  startAt: string;
  endAt: string;
  partySize: number;
  notes?: string;
  specialRequests?: string;
}

export type CreateReservationResponse = ApiResponse<ReservationRow>;

export interface GetReservationsRequest {
  venueId: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export type GetReservationsResponse = ApiResponse<ReservationRow[]>;

// ========================================
// STAFF API
// ========================================

export interface InviteStaffRequest {
  venueId: string;
  email: string;
  role: "manager" | "staff" | "server" | "kitchen";
  permissions?: Record<string, boolean>;
  userId: string; // Inviter's user ID
  userEmail?: string;
  userName?: string;
}

export type InviteStaffResponse = ApiResponse<StaffInvitationRow>;

export interface GetStaffRequest {
  venueId: string;
}

export type GetStaffResponse = ApiResponse<UserVenueRoleRow[]>;

export interface UpdateStaffRoleRequest {
  userId: string;
  venueId: string;
  role: "manager" | "staff" | "server" | "kitchen";
  permissions?: Record<string, boolean>;
}

export type UpdateStaffRoleResponse = ApiResponse<UserVenueRoleRow>;

// ========================================
// VENUE API
// ========================================

export interface GetVenueRequest {
  venueId: string;
}

export type GetVenueResponse = ApiResponse<VenueRow>;

export interface UpdateVenueRequest {
  venueId: string;
  venueName?: string;
  businessType?: string;
  address?: string;
  phone?: string;
  email?: string;
  timezone?: string;
  dailyResetTime?: string;
}

export type UpdateVenueResponse = ApiResponse<VenueRow>;

// ========================================
// PAYMENT API
// ========================================

export interface CreatePaymentRequest {
  orderId: string;
  amount: number;
  paymentMethod: "card" | "cash" | "bank_transfer" | "other";
  stripePaymentIntentId?: string;
}

export type CreatePaymentResponse = ApiResponse<PaymentRow>;

export interface CreateStripeCheckoutRequest {
  orderId: string;
  successUrl: string;
  cancelUrl: string;
}

export type CreateStripeCheckoutResponse = ApiResponse<{
  sessionId: string;
  url: string;
}>;

// ========================================
// KDS API
// ========================================

export interface GetKDSTicketsRequest {
  venueId: string;
  stationId?: string;
  status?: string;
}

export type GetKDSTicketsResponse = ApiResponse<KDSTicketRow[]>;

export interface UpdateKDSTicketRequest {
  ticketId: string;
  status: "pending" | "in_progress" | "ready" | "completed" | "cancelled";
}

export type UpdateKDSTicketResponse = ApiResponse<KDSTicketRow>;

// ========================================
// FEEDBACK API
// ========================================

export interface SubmitFeedbackRequest {
  venueId: string;
  orderId?: string;
  rating: number;
  comment?: string;
  category: "food" | "service" | "ambiance" | "value" | "overall";
  customerName?: string;
  customerEmail?: string;
}

export type SubmitFeedbackResponse = ApiResponse<FeedbackRow>;

export interface GetFeedbackRequest {
  venueId: string;
  startDate?: string;
  endDate?: string;
  category?: string;
  minRating?: number;
}

export type GetFeedbackResponse = ApiResponse<FeedbackRow[]>;

// ========================================
// ANALYTICS API
// ========================================

export interface GetAnalyticsRequest {
  venueId: string;
  startDate: string;
  endDate: string;
  metrics?: string[];
}

export interface AnalyticsMetrics {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  topSellingItems: Array<{
    itemId: string;
    itemName: string;
    quantity: number;
    revenue: number;
  }>;
  ordersByStatus: Record<string, number>;
  ordersByHour: Array<{
    hour: number;
    count: number;
  }>;
  customerSatisfaction: {
    averageRating: number;
    totalFeedback: number;
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
