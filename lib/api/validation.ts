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

export const CreateOrderSchema = z.object({

    .transform((val) => sanitizeString(val, 255)),

  payment_method: z.enum(["CARD", "CASH", "PAY_LATER", "STRIPE"]),
  payment_status: z.enum(["PAID", "UNPAID", "PROCESSING"]),
  source: z.enum(["qr", "counter", "pos", "admin"]).optional(),

// Menu item validation
export const MenuItemSchema = z.object({

// Staff invitation validation
export const StaffInvitationSchema = z.object({

  role: z.enum(["owner", "manager", "staff", "kitchen_staff", "waiter"]),

// Feedback validation
export const FeedbackAnswerSchema = z.object({

  type: z.enum(["rating", "text", "multiple_choice"]),

export const CreateFeedbackResponseSchema = z.object({

// Inventory validation
export const IngredientSchema = z.object({

// Table validation
export const TableSchema = z.object({

// Pagination helpers
export const PaginationSchema = z.object({

  sortOrder: z.enum(["asc", "desc"]).default("desc"),

/**
 * Validate and sanitize request body
 */
export async function validateRequest<T>(

): Promise<{ success: true; data: T } | { success: false; error: string; details?: unknown }> {
  try {
    const body = await request.json();
    const validated = schema.parse(body);
    return { success: true, data: validated };
  } catch (_error) {
    if (_error instanceof z.ZodError) {
      return {

      };
    }
    return {

    };
  }
}
