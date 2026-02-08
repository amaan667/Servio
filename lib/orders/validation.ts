/**
 * Zod Validation Schemas for Orders
 * Type-safe input validation for order operations
 */

import { z } from "zod";
import {
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  PaymentMode,
  FulfillmentType,
  OrderSource,
} from "./constants";

// ============================================================================
// Individual Item Schemas
// ============================================================================

/**
 * Order item modifier schema
 */
export const orderItemModifierSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Modifier name is required"),
  price: z.number().min(0, "Price cannot be negative"),
  quantity: z.number().int().min(1).optional(),
});

export type OrderItemModifierInput = z.infer<typeof orderItemModifierSchema>;

/**
 * Create order item input schema
 */
export const createOrderItemInputSchema = z.object({
  menu_item_id: z.string().uuid().optional().nullable(),
  item_name: z.string().min(1, "Item name is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  price: z.number().min(0, "Price cannot be negative"),
  special_instructions: z.string().max(500).optional(),
  modifiers: z.array(orderItemModifierSchema).optional(),
  station: z.string().optional(),
});

export type CreateOrderItemInput = z.infer<typeof createOrderItemInputSchema>;

// ============================================================================
// Order Creation Schema
// ============================================================================

/**
 * Create order input schema with full validation
 */
export const createOrderInputSchema = z.object({
  table_number: z.union([z.number(), z.string(), z.null()]).optional(),
  customer_name: z.string().min(1, "Customer name is required").max(100),
  customer_phone: z.string().min(1, "Phone number is required").max(20),
  customer_email: z.string().email().optional().or(z.literal("")),
  items: z
    .array(createOrderItemInputSchema)
    .min(1, "At least one item is required")
    .max(100, "Maximum 100 items per order"),
  total_amount: z.number().min(0, "Total cannot be negative"),
  notes: z.string().max(500).optional(),
  order_status: z.nativeEnum(OrderStatus).optional(),
  payment_status: z.nativeEnum(PaymentStatus).optional(),
  payment_method: z.nativeEnum(PaymentMethod).optional(),
  payment_mode: z.nativeEnum(PaymentMode).optional(),
  source: z.nativeEnum(OrderSource).optional(),
  fulfillment_type: z.nativeEnum(FulfillmentType).optional(),
  counter_label: z.string().max(50).optional(),
  qr_type: z.string().optional(),
  requires_collection: z.boolean().optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;

// ============================================================================
// Update Schemas
// ============================================================================

/**
 * Update order status schema
 */
export const updateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus, {
    errorMap: () => ({ message: "Invalid order status" }),
  }),
  reason: z.string().max(200).optional(),
  userId: z.string().optional(),
});

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

/**
 * Update payment status schema
 */
export const updatePaymentStatusSchema = z.object({
  paymentStatus: z.nativeEnum(PaymentStatus, {
    errorMap: () => ({ message: "Invalid payment status" }),
  }),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  paymentIntentId: z.string().optional(),
});

export type UpdatePaymentStatusInput = z.infer<typeof updatePaymentStatusSchema>;

// ============================================================================
// Query/Filter Schemas
// ============================================================================

/**
 * Order filters schema
 */
export const orderFiltersSchema = z.object({
  status: z.union([z.nativeEnum(OrderStatus), z.array(z.nativeEnum(OrderStatus))]).optional(),
  paymentStatus: z.array(z.nativeEnum(PaymentStatus)).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  tableId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  source: z.nativeEnum(OrderSource).optional(),
  fulfillmentType: z.nativeEnum(FulfillmentType).optional(),
});

export type OrderFiltersInput = z.infer<typeof orderFiltersSchema>;

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate order item before adding to order
 */
export function validateOrderItem(item: unknown): CreateOrderItemInput {
  const result = createOrderItemInputSchema.safeParse(item);
  if (!result.success) {
    throw new Error(`Invalid order item: ${result.error.message}`);
  }
  return result.data;
}

/**
 * Validate complete order input
 */
export function validateCreateOrderInput(data: unknown): CreateOrderInput {
  const result = createOrderInputSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid order data: ${result.error.message}`);
  }
  return result.data;
}

/**
 * Validate status update
 */
export function validateStatusUpdate(data: unknown): UpdateOrderStatusInput {
  const result = updateOrderStatusSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid status update: ${result.error.message}`);
  }
  return result.data;
}

/**
 * Validate filters
 */
export function validateFilters(filters: unknown): OrderFiltersInput {
  const result = orderFiltersSchema.safeParse(filters);
  if (!result.success) {
    return {};
  }
  return result.data;
}

// ============================================================================
// Validation Results
// ============================================================================

/**
 * Validation result interface
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Create validation result helper
 */
export function createValidationResult<T>(
  success: boolean,
  data?: T,
  error?: string
): ValidationResult<T> {
  return { success, data, error };
}
