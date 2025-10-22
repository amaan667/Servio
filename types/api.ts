/**
 * API Type Definitions
 * Comprehensive types for all API routes
 */

import { z } from 'zod';

// ============================================================================
// Common Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ============================================================================
// Order Types
// ============================================================================

export interface OrderItem {
  menu_item_id: string;
  item_name: string;
  quantity: number;
  price: number;
  specialInstructions?: string;
  station?: string;
}

export interface CreateOrderRequest {
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  table_id?: string;
  items: OrderItem[];
  total_amount: number;
  payment_method: 'stripe' | 'till' | 'demo' | 'pay_later';
  notes?: string;
  prep_lead_minutes?: number;
}

export interface OrderResponse {
  id: string;
  venue_id: string;
  order_status: string;
  payment_status: string;
  total_amount: number;
  created_at: string;
  updated_at: string;
}

export interface UpdateOrderStatusRequest {
  order_status: 'PLACED' | 'IN_PREP' | 'READY' | 'SERVING' | 'COMPLETED' | 'CANCELLED';
}

// ============================================================================
// Menu Types
// ============================================================================

export interface MenuItem {
  id: string;
  venue_id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  is_available: boolean;
  position?: number;
  image_url?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateMenuItemRequest {
  name: string;
  description?: string;
  price: number;
  category: string;
  is_available?: boolean;
  position?: number;
  image_url?: string;
}

export interface UpdateMenuItemRequest {
  name?: string;
  description?: string;
  price?: number;
  category?: string;
  is_available?: boolean;
  position?: number;
  image_url?: string;
}

export interface MenuCategory {
  id: string;
  venue_id: string;
  name: string;
  position: number;
  description?: string;
}

// ============================================================================
// Venue Types
// ============================================================================

export interface Venue {
  venue_id: string;
  owner_id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateVenueRequest {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
}

export interface UpdateVenueRequest {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
}

// ============================================================================
// Table Types
// ============================================================================

export interface Table {
  id: string;
  venue_id: string;
  label: string;
  area?: string;
  capacity: number;
  status: 'FREE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING';
  qr_code_url?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTableRequest {
  label: string;
  area?: string;
  capacity: number;
  status?: 'FREE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING';
}

export interface UpdateTableRequest {
  label?: string;
  area?: string;
  capacity?: number;
  status?: 'FREE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING';
}

// ============================================================================
// Staff Types
// ============================================================================

export interface StaffMember {
  id: string;
  venue_id: string;
  user_id: string;
  role: 'owner' | 'manager' | 'staff';
  name: string;
  email: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateStaffRequest {
  email: string;
  role: 'manager' | 'staff';
  name?: string;
}

export interface UpdateStaffRequest {
  role?: 'manager' | 'staff';
  name?: string;
  phone?: string;
  is_active?: boolean;
}

// ============================================================================
// Reservation Types
// ============================================================================

export interface Reservation {
  id: string;
  venue_id: string;
  table_id?: string;
  customer_name: string;
  customer_email?: string;
  customer_phone: string;
  party_size: number;
  reservation_date: string;
  reservation_time: string;
  status: 'PENDING' | 'CONFIRMED' | 'SEATED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateReservationRequest {
  customer_name: string;
  customer_email?: string;
  customer_phone: string;
  party_size: number;
  reservation_date: string;
  reservation_time: string;
  table_id?: string;
  notes?: string;
}

export interface UpdateReservationRequest {
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  party_size?: number;
  reservation_date?: string;
  reservation_time?: string;
  table_id?: string;
  status?: 'PENDING' | 'CONFIRMED' | 'SEATED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  notes?: string;
}

// ============================================================================
// Payment Types
// ============================================================================

export interface PaymentIntent {
  id: string;
  venue_id: string;
  order_id?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed' | 'canceled';
  payment_method: string;
  created_at: string;
}

export interface CreatePaymentIntentRequest {
  amount: number;
  currency?: string;
  order_id?: string;
  payment_method: string;
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface AnalyticsStats {
  total_orders: number;
  total_revenue: number;
  average_order_value: number;
  orders_today: number;
  revenue_today: number;
  orders_this_week: number;
  revenue_this_week: number;
  orders_this_month: number;
  revenue_this_month: number;
}

export interface AnalyticsInsight {
  type: 'trend' | 'anomaly' | 'recommendation';
  title: string;
  description: string;
  value?: number;
  change?: number;
}

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

export const CreateOrderSchema = z.object({
  customer_name: z.string().min(1),
  customer_email: z.string().email().optional(),
  customer_phone: z.string().optional(),
  table_id: z.string().uuid().optional(),
  items: z.array(z.object({
    menu_item_id: z.string().uuid(),
    item_name: z.string(),
    quantity: z.number().positive(),
    price: z.number().positive(),
    specialInstructions: z.string().optional(),
    station: z.string().optional(),
  })),
  total_amount: z.number().positive(),
  payment_method: z.enum(['stripe', 'till', 'demo', 'pay_later']),
  notes: z.string().optional(),
  prep_lead_minutes: z.number().positive().optional(),
});

export const CreateMenuItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  category: z.string().min(1),
  is_available: z.boolean().optional(),
  position: z.number().optional(),
  image_url: z.string().url().optional(),
});

export const UpdateMenuItemSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.number().positive().optional(),
  category: z.string().min(1).optional(),
  is_available: z.boolean().optional(),
  position: z.number().optional(),
  image_url: z.string().url().optional(),
});

export const CreateVenueSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
});

export const CreateTableSchema = z.object({
  label: z.string().min(1),
  area: z.string().optional(),
  capacity: z.number().positive(),
  status: z.enum(['FREE', 'OCCUPIED', 'RESERVED', 'CLEANING']).optional(),
});

export const CreateReservationSchema = z.object({
  customer_name: z.string().min(1),
  customer_email: z.string().email().optional(),
  customer_phone: z.string().min(1),
  party_size: z.number().positive(),
  reservation_date: z.string(),
  reservation_time: z.string(),
  table_id: z.string().uuid().optional(),
  notes: z.string().optional(),
});

// ============================================================================
// Type Guards
// ============================================================================

export function isApiResponse<T>(value: unknown): value is ApiResponse<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    typeof (value as ApiResponse).ok === 'boolean'
  );
}

export function isPaginatedResponse<T>(value: unknown): value is PaginatedResponse<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    'total' in value &&
    Array.isArray((value as PaginatedResponse<T>).data)
  );
}

