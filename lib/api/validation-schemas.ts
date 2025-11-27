/**
 * API Input Validation Schemas
 * 
 * Centralized Zod schemas for all API route inputs.
 * This ensures consistent validation across the entire application.
 */

import { z } from "zod";

/**
 * Common validation patterns
 */
const uuid = z.string().uuid("Invalid UUID format");
const nonEmptyString = z.string().min(1, "Cannot be empty");
const positiveNumber = z.number().positive("Must be positive");
const nonNegativeNumber = z.number().nonnegative("Cannot be negative");
const email = z.string().email("Invalid email format");
const phone = z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format");
const url = z.string().url("Invalid URL format");

/**
 * Pagination schemas
 */
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

/**
 * Order schemas
 */
export const orderItemSchema = z.object({
  menu_item_id: uuid,
  quantity: positiveNumber.int(),
  price: nonNegativeNumber,
  item_name: nonEmptyString,
  special_instructions: z.string().optional(),
});

export const createOrderSchema = z.object({
  venue_id: uuid,
  customer_name: nonEmptyString.max(100),
  customer_phone: phone,
  customer_email: email.optional(),
  table_number: z.string().optional(),
  items: z.array(orderItemSchema).min(1, "At least one item required"),
  total_amount: nonNegativeNumber,
  payment_mode: z.enum(["STRIPE", "CASH", "CARD", "PAY_LATER"]).optional(),
  special_instructions: z.string().max(500).optional(),
});

export const updateOrderStatusSchema = z.object({
  order_id: uuid,
  status: z.enum(["PLACED", "PREPARING", "READY", "SERVED", "COMPLETED", "CANCELLED"]),
});

/**
 * Menu schemas
 */
export const menuItemSchema = z.object({
  name: nonEmptyString.max(100),
  description: z.string().max(500).optional(),
  price: nonNegativeNumber,
  category: nonEmptyString.max(50),
  image_url: url.optional(),
  is_available: z.boolean().default(true),
});

export const createMenuItemSchema = menuItemSchema.extend({
  venue_id: uuid,
});

export const updateMenuItemSchema = menuItemSchema.partial().extend({
  id: uuid,
});

/**
 * Table schemas
 */
export const createTableSchema = z.object({
  venue_id: uuid,
  table_number: nonEmptyString.max(20),
  capacity: positiveNumber.int().max(50),
  qr_code: z.string().optional(),
});

export const updateTableSchema = z.object({
  table_id: uuid,
  table_number: z.string().max(20).optional(),
  capacity: z.number().int().positive().max(50).optional(),
  status: z.enum(["AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING"]).optional(),
});

/**
 * Staff schemas
 */
export const createStaffInvitationSchema = z.object({
  venue_id: uuid,
  email: email,
  role: z.enum(["owner", "manager", "staff", "kitchen"]),
  name: nonEmptyString.max(100).optional(),
});

/**
 * Inventory schemas
 */
export const ingredientSchema = z.object({
  name: nonEmptyString.max(100),
  unit: z.enum(["kg", "g", "L", "mL", "piece", "box", "pack"]),
  current_stock: nonNegativeNumber,
  min_stock: nonNegativeNumber,
  cost_per_unit: nonNegativeNumber.optional(),
});

export const createIngredientSchema = ingredientSchema.extend({
  venue_id: uuid,
});

/**
 * Reservation schemas
 */
export const createReservationSchema = z.object({
  venue_id: uuid,
  customer_name: nonEmptyString.max(100),
  customer_phone: phone,
  customer_email: email.optional(),
  reservation_time: z.string().datetime(),
  party_size: positiveNumber.int().max(50),
  special_requests: z.string().max(500).optional(),
});

/**
 * Payment schemas
 */
export const createPaymentIntentSchema = z.object({
  order_id: uuid,
  amount: positiveNumber,
  currency: z.enum(["usd", "eur", "gbp"]).default("usd"),
  payment_method: z.enum(["card", "cash", "pay_later"]).optional(),
});

/**
 * Feedback schemas
 */
export const feedbackResponseSchema = z.object({
  order_id: uuid.optional(),
  question_id: uuid,
  answer_type: z.enum(["stars", "multiple_choice", "paragraph"]),
  answer_stars: z.number().int().min(1).max(5).optional(),
  answer_choice: z.string().optional(),
  answer_text: z.string().max(600).optional(),
});

export const submitFeedbackSchema = z.object({
  venue_id: uuid,
  order_id: uuid.optional(),
  answers: z.array(feedbackResponseSchema).min(1, "At least one answer required"),
});

/**
 * AI Chat schemas
 */
export const aiChatSchema = z.object({
  message: nonEmptyString.max(2000),
  conversation_id: uuid.optional(),
  context: z.record(z.unknown()).optional(),
});

/**
 * Generic ID parameter schema
 */
export const idParamSchema = z.object({
  id: uuid,
});

/**
 * Venue ID parameter schema
 */
export const venueIdParamSchema = z.object({
  venueId: uuid,
});

/**
 * Table action schemas
 */
export const tableActionSchema = z.object({
  action: z.enum([
    "start_preparing",
    "mark_ready",
    "mark_served",
    "mark_awaiting_bill",
    "close_table",
    "reserve_table",
    "occupy_table",
    "move_table",
    "merge_table",
    "unmerge_table",
    "cancel_reservation",
  ]),
  table_id: uuid,
  order_id: uuid.optional(),
  destination_table_id: uuid.optional(),
  customer_name: z.string().max(100).optional(),
  reservation_time: z.string().datetime().optional(),
  reservation_duration: z.number().int().positive().optional(),
  reservation_id: uuid.optional(),
});

/**
 * Helper to validate request body
 */
export async function validateBody<T extends z.ZodType>(
  schema: T,
  body: unknown
): Promise<z.infer<T>> {
  return schema.parse(body);
}

/**
 * Helper to validate query parameters
 */
export function validateQuery<T extends z.ZodType>(
  schema: T,
  query: Record<string, unknown>
): z.infer<T> {
  return schema.parse(query);
}

/**
 * Helper to validate route parameters
 */
export function validateParams<T extends z.ZodType>(
  schema: T,
  params: Record<string, unknown>
): z.infer<T> {
  return schema.parse(params);
}

