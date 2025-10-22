/**
 * @fileoverview Centralized Zod validation schemas for API requests
 * @module lib/validation/schemas
 */

import { z } from 'zod';

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

export const UUIDSchema = z.string().uuid('Invalid UUID format');
export const EmailSchema = z.string().email('Invalid email address');
export const PhoneSchema = z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number');
export const URLSchema = z.string().url('Invalid URL');

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ============================================================================
// ORDER SCHEMAS
// ============================================================================

export const OrderItemSchema = z.object({
  menu_item_id: UUIDSchema,
  item_name: z.string().min(1).max(255),
  quantity: z.number().int().positive(),
  price: z.number().positive(),
  special_instructions: z.string().max(500).optional(),
  modifiers: z.array(z.object({
    name: z.string(),
    price: z.number(),
  })).optional(),
});

export const CreateOrderSchema = z.object({
  venue_id: UUIDSchema,
  items: z.array(OrderItemSchema).min(1, 'Order must have at least one item'),
  table_number: z.string().optional(),
  table_id: UUIDSchema.optional(),
  customer_name: z.string().max(255).optional(),
  customer_phone: PhoneSchema.optional(),
  customer_email: EmailSchema.optional(),
  special_instructions: z.string().max(1000).optional(),
  payment_method: z.enum(['stripe', 'cash', 'card', 'pay_later', 'demo']).default('pay_later'),
  total_amount: z.number().positive(),
  tax_amount: z.number().nonnegative().optional(),
  tip_amount: z.number().nonnegative().optional(),
  session_id: z.string().optional(),
});

export const UpdateOrderStatusSchema = z.object({
  order_id: UUIDSchema,
  status: z.enum(['pending', 'confirmed', 'preparing', 'ready', 'served', 'completed', 'cancelled']),
  notes: z.string().max(500).optional(),
});

// ============================================================================
// MENU SCHEMAS
// ============================================================================

export const MenuItemSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  price: z.number().positive(),
  category: z.string().min(1).max(100),
  category_id: UUIDSchema.optional(),
  image_url: URLSchema.optional(),
  is_available: z.boolean().default(true),
  preparation_time: z.number().int().positive().optional(),
  allergens: z.array(z.string()).optional(),
  dietary_tags: z.array(z.enum(['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'halal', 'kosher'])).optional(),
  modifiers: z.array(z.object({
    name: z.string(),
    options: z.array(z.object({
      name: z.string(),
      price: z.number(),
    })),
  })).optional(),
});

export const CreateMenuItemSchema = MenuItemSchema.extend({
  venue_id: UUIDSchema,
});

export const UpdateMenuItemSchema = MenuItemSchema.partial().extend({
  id: UUIDSchema,
  venue_id: UUIDSchema,
});

export const MenuCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  display_order: z.number().int().nonnegative().optional(),
  is_active: z.boolean().default(true),
});

// ============================================================================
// TABLE MANAGEMENT SCHEMAS
// ============================================================================

export const TableSchema = z.object({
  table_number: z.string().min(1).max(50),
  capacity: z.number().int().positive(),
  status: z.enum(['available', 'occupied', 'reserved', 'maintenance']).default('available'),
  section: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

export const CreateTableSchema = TableSchema.extend({
  venue_id: UUIDSchema,
});

export const ReservationSchema = z.object({
  customer_name: z.string().min(1).max(255),
  customer_phone: PhoneSchema,
  customer_email: EmailSchema.optional(),
  party_size: z.number().int().positive().max(50),
  reservation_time: z.string().datetime(),
  duration_minutes: z.number().int().positive().default(90),
  special_requests: z.string().max(1000).optional(),
  table_id: UUIDSchema.optional(),
});

export const CreateReservationSchema = ReservationSchema.extend({
  venue_id: UUIDSchema,
});

// ============================================================================
// INVENTORY SCHEMAS
// ============================================================================

export const IngredientSchema = z.object({
  name: z.string().min(1).max(255),
  unit: z.string().min(1).max(50),
  current_stock: z.number().nonnegative(),
  min_stock: z.number().nonnegative(),
  max_stock: z.number().positive(),
  cost_per_unit: z.number().positive(),
  supplier: z.string().max(255).optional(),
  notes: z.string().max(500).optional(),
});

export const StockAdjustmentSchema = z.object({
  ingredient_id: UUIDSchema,
  quantity: z.number(),
  reason: z.enum(['purchase', 'waste', 'usage', 'adjustment', 'stocktake']),
  notes: z.string().max(500).optional(),
  cost: z.number().positive().optional(),
});

// ============================================================================
// STAFF SCHEMAS
// ============================================================================

export const StaffInvitationSchema = z.object({
  email: EmailSchema,
  role: z.enum(['owner', 'manager', 'staff']),
  venue_id: UUIDSchema,
  permissions: z.array(z.string()).optional(),
});

export const StaffShiftSchema = z.object({
  staff_id: UUIDSchema,
  venue_id: UUIDSchema,
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  role: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

// ============================================================================
// FEEDBACK SCHEMAS
// ============================================================================

export const FeedbackSchema = z.object({
  venue_id: UUIDSchema,
  order_id: UUIDSchema.optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
  category: z.enum(['food', 'service', 'ambiance', 'value', 'overall']).default('overall'),
  customer_name: z.string().max(255).optional(),
  customer_email: EmailSchema.optional(),
  is_anonymous: z.boolean().default(false),
});

// ============================================================================
// PAYMENT SCHEMAS
// ============================================================================

export const PaymentIntentSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3).default('usd'),
  payment_method: z.enum(['card', 'stripe']),
  metadata: z.record(z.string()).optional(),
});

export const StripeCheckoutSchema = z.object({
  price_id: z.string().min(1),
  success_url: URLSchema,
  cancel_url: URLSchema,
  customer_email: EmailSchema.optional(),
  trial_days: z.number().int().nonnegative().optional(),
});

// ============================================================================
// ANALYTICS SCHEMAS
// ============================================================================

export const AnalyticsQuerySchema = z.object({
  venue_id: UUIDSchema,
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
  metrics: z.array(z.enum(['revenue', 'orders', 'customers', 'items_sold', 'avg_order_value'])),
  group_by: z.enum(['day', 'week', 'month', 'hour']).optional(),
});

// ============================================================================
// VENUE SCHEMAS
// ============================================================================

export const VenueSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  address: z.string().max(500).optional(),
  phone: PhoneSchema.optional(),
  email: EmailSchema.optional(),
  website: URLSchema.optional(),
  logo_url: URLSchema.optional(),
  cuisine_type: z.array(z.string()).optional(),
  opening_hours: z.record(z.object({
    open: z.string().regex(/^\d{2}:\d{2}$/),
    close: z.string().regex(/^\d{2}:\d{2}$/),
    closed: z.boolean().default(false),
  })).optional(),
  settings: z.record(z.unknown()).optional(),
});

export const CreateVenueSchema = VenueSchema.extend({
  owner_user_id: UUIDSchema,
  organization_id: UUIDSchema.optional(),
});

// ============================================================================
// VALIDATION HELPER
// ============================================================================

/**
 * Validate request body against a schema
 */
export async function validateRequest<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; error: z.ZodError }> {
  try {
    const body = await request.json();
    const data = schema.parse(body);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error };
    }
    throw error;
  }
}

/**
 * Validate query parameters against a schema
 */
export function validateQuery<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: z.ZodError } {
  try {
    const params = Object.fromEntries(searchParams.entries());
    const data = schema.parse(params);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error };
    }
    throw error;
  }
}

/**
 * Format Zod error for API response
 */
export function formatZodError(error: z.ZodError): { field: string; message: string }[] {
  return error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }));
}

