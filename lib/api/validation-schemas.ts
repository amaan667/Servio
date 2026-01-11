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
// Venue ID can be a UUID or prefixed with "venue-" (e.g., "venue-1e02af4d")
const venueId = z.string().refine(
  (val) => {
    // Accept UUID format
    if (z.string().uuid().safeParse(val).success) return true;
    // Accept "venue-" prefix format
    if (val.startsWith("venue-") && val.length > 6) return true;
    return false;
  },
  { message: "Invalid venue ID format. Must be a UUID or start with 'venue-'" }
);
const nonEmptyString = z.string().min(1, "Cannot be empty");
const positiveNumber = z.number().positive("Must be positive");
const nonNegativeNumber = z.number().nonnegative("Cannot be negative");
const email = z.string().email("Invalid email format");
// More flexible phone validation - accepts various formats
const phone = z
  .string()
  .min(1, "Phone number is required")
  .refine(
    (val) => {
      // Remove all non-digit characters except +
      const cleaned = val.replace(/[^\d+]/g, "");
      // Must have at least 7 digits
      const digitsOnly = cleaned.replace(/\+/g, "");
      return digitsOnly.length >= 7 && digitsOnly.length <= 15;
    },
    { message: "Phone number must be between 7 and 15 digits" }
  );
const url = z.string().url("Invalid URL format");

/**
 * Pagination schemas
 */
export const paginationSchema = z.object({

/**
 * Order schemas
 */
export const orderItemSchema = z.object({
  menu_item_id: uuid.or(z.null()), // Allow null for items without menu_item_id

  specialInstructions: z.string().optional().nullable(), // Accept both camelCase and snake_case for backward compatibility

export const createOrderSchema = z.object({

    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((val) => (val !== null && val !== undefined ? String(val) : undefined)),
  items: z.array(orderItemSchema).min(1, "At least one item required"),

      "offline",
      "deferred",
      "pay_later",
      "pay_at_till",
      "STRIPE",
      "CASH",
      "CARD",
      "PAY_LATER",
    ])
    .optional(),

export const updateOrderStatusSchema = z.object({

  status: z.enum(["PLACED", "PREPARING", "READY", "SERVED", "COMPLETED", "CANCELLED"]),

/**
 * Menu schemas
 */
export const menuItemSchema = z.object({

export const createMenuItemSchema = menuItemSchema.extend({

export const updateMenuItemSchema = menuItemSchema.partial().extend({

/**
 * Table schemas
 */
export const createTableSchema = z.object({

export const updateTableSchema = z.object({

  status: z.enum(["AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING"]).optional(),

/**
 * Staff schemas
 */
export const createStaffInvitationSchema = z.object({

  role: z.enum(["owner", "manager", "staff", "kitchen"]),

/**
 * Inventory schemas
 */
export const ingredientSchema = z.object({

  unit: z.enum(["kg", "g", "L", "mL", "piece", "box", "pack"]),

export const createIngredientSchema = ingredientSchema.extend({

/**
 * Reservation schemas
 */
export const createReservationSchema = z.object({

/**
 * Payment schemas
 */
export const createPaymentIntentSchema = z.object({

  currency: z.enum(["usd", "eur", "gbp"]).default("usd"),
  payment_method: z.enum(["card", "cash", "pay_later"]).optional(),

/**
 * Feedback schemas
 */
export const feedbackResponseSchema = z.object({

  answer_type: z.enum(["stars", "multiple_choice", "paragraph"]),

export const submitFeedbackSchema = z.object({

  answers: z.array(feedbackResponseSchema).min(1, "At least one answer required"),

/**
 * AI Chat schemas
 */
export const aiChatSchema = z.object({

/**
 * Generic ID parameter schema
 */
export const idParamSchema = z.object({

/**
 * Venue ID parameter schema
 */
export const venueIdParamSchema = z.object({

/**
 * Table action schemas
 */
export const tableActionSchema = z.object({

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

/**
 * Helper to validate request body
 */
export async function validateBody<T extends z.ZodType>(

  } catch (error) {
    if (error instanceof z.ZodError) {
      throw error;
    }
    throw new Error("Validation failed");
  }
}

/**
 * Helper to validate query parameters
 * Throws ZodError on validation failure
 */
export function validateQuery<T extends z.ZodType>(

  query: Record<string, unknown>
): z.infer<T> {
  try {
    return schema.parse(query);
  } catch (error) {
    // Re-throw ZodError as-is for proper error handling
    if (error instanceof z.ZodError) {
      throw error;
    }
    // Wrap other errors
    throw new Error("Validation failed");
  }
}

/**
 * Helper to validate route parameters
 */
export function validateParams<T extends z.ZodType>(

  params: Record<string, unknown>
): z.infer<T> {
  return schema.parse(params);
}
