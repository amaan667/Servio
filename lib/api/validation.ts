/**
 * Comprehensive Input Validation Schemas
 * Using Zod for runtime type validation and sanitization
 */

import { z } from "zod";

// Common validation schemas
export const UUIDSchema = z.string().uuid();
export const EmailSchema = z.string().email().max(255);
export const PhoneSchema = z.string().regex(/^\+?[1-9]\d{1,14}$/);
export const VenueIdSchema = z.string().regex(/^venue-[a-z0-9-]+$/);
export const PositiveIntSchema = z.number().int().positive();
export const NonNegativeNumberSchema = z.number().nonnegative();
export const URLSchema = z.string().url();

// Sanitization helpers
export function sanitizeString(input: string, maxLength = 1000): string {
  return input.trim().slice(0, maxLength).replace(/[<>]/g, ""); // Remove potential XSS characters
}

export function sanitizeHTML(input: string): string {
  // Strip all HTML tags and dangerous characters
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "");
}

// Order validation
export const OrderItemSchema = z.object({
  menu_item_id: z.string().optional().nullable(),
  item_name: z.string().min(1).max(255),
  quantity: z.number().int().min(1).max(100),
  price: z.number().nonnegative(),
  unit_price: z.number().nonnegative().optional(),
  specialInstructions: z.string().max(500).optional().nullable(),
  special_instructions: z.string().max(500).optional().nullable(),
});

export const CreateOrderSchema = z.object({
  venue_id: VenueIdSchema,
  customer_name: z
    .string()
    .min(1)
    .max(255)
    .transform((val) => sanitizeString(val, 255)),
  customer_phone: PhoneSchema,
  customer_email: EmailSchema.optional().nullable(),
  table_number: z.number().int().min(1).max(9999).optional().nullable(),
  table_id: z.string().optional().nullable(),
  items: z.array(OrderItemSchema).min(1).max(50),
  total_amount: z.number().nonnegative(),
  payment_method: z.enum(["CARD", "CASH", "PAY_LATER", "STRIPE"]),
  payment_status: z.enum(["PAID", "UNPAID", "PROCESSING"]),
  source: z.enum(["qr", "counter", "pos", "admin"]).optional(),
  session_id: z.string().optional().nullable(),
  notes: z
    .string()
    .max(1000)
    .optional()
    .nullable()
    .transform((val) => (val ? sanitizeString(val) : null)),
});

// Menu item validation
export const MenuItemSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional().nullable(),
  price: z.number().nonnegative(),
  category: z.string().max(100).optional().nullable(),
  image_url: URLSchema.optional().nullable(),
  is_available: z.boolean().default(true),
  preparation_time: z.number().int().nonnegative().optional().nullable(),
});

// Staff invitation validation
export const StaffInvitationSchema = z.object({
  email: EmailSchema,
  role: z.enum(["owner", "manager", "staff", "kitchen_staff", "waiter"]),
  venue_id: VenueIdSchema,
  expires_in_days: z.number().int().min(1).max(30).default(7),
});

// Feedback validation
export const FeedbackAnswerSchema = z.object({
  question_id: z.string(),
  type: z.enum(["rating", "text", "multiple_choice"]),
  rating_value: z.number().int().min(1).max(5).optional().nullable(),
  text_value: z
    .string()
    .max(2000)
    .optional()
    .nullable()
    .transform((val) => (val ? sanitizeHTML(val) : null)),
  answer_choice: z.string().max(255).optional().nullable(),
});

export const CreateFeedbackResponseSchema = z.object({
  order_id: UUIDSchema,
  venue_id: VenueIdSchema,
  answers: z.array(FeedbackAnswerSchema).min(1).max(20),
  metadata: z.record(z.unknown()).optional(),
});

// Inventory validation
export const IngredientSchema = z.object({
  name: z.string().min(1).max(255),
  sku: z.string().max(100).optional().nullable(),
  unit: z.string().min(1).max(50),
  cost_per_unit: z.number().nonnegative(),
  on_hand: z.number().nonnegative().default(0),
  par_level: z.number().nonnegative().default(0),
  reorder_level: z.number().nonnegative().default(0),
  supplier: z.string().max(255).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
});

// Table validation
export const TableSchema = z.object({
  venue_id: VenueIdSchema,
  table_number: z.number().int().min(1).max(9999),
  label: z.string().max(50).optional().nullable(),
  capacity: z.number().int().min(1).max(100),
  is_active: z.boolean().default(true),
});

// Pagination helpers
export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.string().max(50).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

/**
 * Validate and sanitize request body
 */
export async function validateRequest<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; error: string; details?: unknown }> {
  try {
    const body = await request.json();
    const validated = schema.parse(body);
    return { success: true, data: validated };
  } catch (_error) {
    if (_error instanceof z.ZodError) {
      return {
        success: false,
        error: "Validation failed",
        details: _error.errors,
      };
    }
    return {
      success: false,
      error: "Invalid request body",
    };
  }
}
