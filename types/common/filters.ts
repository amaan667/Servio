/**
 * Common Filter Types
 */

export interface BaseFilters {
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export interface OrderFilters extends BaseFilters {
  orderStatus?: string[];
  paymentStatus?: string[];
  tableId?: string;
  sessionId?: string;
  customerName?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface MenuFilters extends BaseFilters {
  category?: string;
  isAvailable?: boolean;
  minPrice?: number;
  maxPrice?: number;
}

export interface TableFilters extends BaseFilters {
  area?: string;
  status?: string;
  capacity?: number;
}

export interface StaffFilters extends BaseFilters {
  role?: string;
  isActive?: boolean;
}

export interface ReservationFilters extends BaseFilters {
  status?: string;
  tableId?: string;
  date?: string;
}

