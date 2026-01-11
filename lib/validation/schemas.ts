import { z } from "zod";

/**
 * Centralized validation schemas for the entire application
 * Provides type-safe validation with Zod
 */

// ============================================================================
// Common Schemas
// ============================================================================

export const VenueIdSchema = z.string().uuid("Invalid venue ID format");

export const UserIdSchema = z.string().uuid("Invalid user ID format");

export const EmailSchema = z.string().email("Invalid email format");

export const PhoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format")
  .optional();

export const PriceSchema = z.number().min(0, "Price must be non-negative");

export const PercentageSchema = z
  .number()
  .min(0, "Percentage must be at least 0")
  .max(100, "Percentage cannot exceed 100");

// ============================================================================
// Menu Item Schemas
// ============================================================================

export const MenuItemSchema = z.object({

  name: z.string().min(1, "Name is required").max(200, "Name too long"),
  description: z.string().max(1000, "Description too long").optional().nullable(),

  category: z.string().min(1, "Category is required").max(100, "Category too long"),

    .array(z.enum(["vegetarian", "vegan", "gluten-free", "dairy-free", "nut-free"]))
    .optional()
    .nullable(),

export const CreateMenuItemSchema = MenuItemSchema.omit({ id: true });

export const UpdateMenuItemSchema = MenuItemSchema.partial().required({ id: true, venue_id: true });

// ============================================================================
// Order Schemas
// ============================================================================

export const OrderStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "SERVED",
  "COMPLETED",
  "CANCELLED",
]);

export const PaymentMethodSchema = z.enum(["cash", "card", "online", "demo"]);

export const OrderItemSchema = z.object({

  quantity: z.number().int().min(1, "Quantity must be at least 1"),

  special_instructions: z.string().max(500, "Instructions too long").optional(),

export const CreateOrderSchema = z.object({

  table_number: z.string().max(50, "Table number too long").optional().nullable(),
  items: z.array(OrderItemSchema).min(1, "At least one item required"),

  customer_name: z.string().max(200, "Name too long").optional(),

  special_requests: z.string().max(1000, "Requests too long").optional(),

// ============================================================================
// Table Schemas
// ============================================================================

export const TableStatusSchema = z.enum(["AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING"]);

export const TableSchema = z.object({

  label: z.string().min(1, "Table label required").max(50, "Label too long"),
  capacity: z.number().int().min(1, "Capacity must be at least 1").max(50, "Capacity too high"),

// ============================================================================
// Staff Schemas
// ============================================================================

export const StaffRoleSchema = z.enum(["manager", "kitchen_staff", "waiter", "host"]);

export const InviteStaffSchema = z.object({

// ============================================================================
// Feedback Schemas
// ============================================================================

export const FeedbackTypeSchema = z.enum(["stars", "multiple_choice", "paragraph"]);

export const CreateFeedbackQuestionSchema = z.object({

  prompt: z.string().min(3, "Question too short").max(500, "Question too long"),

// ============================================================================
// Analytics Schemas
// ============================================================================

export const TimePeriodSchema = z.enum(["7d", "30d", "3m", "1y", "custom"]);

export const DateRangeSchema = z.object({

// ============================================================================
// Inventory Schemas
// ============================================================================

export const IngredientSchema = z.object({

  name: z.string().min(1, "Name required").max(200, "Name too long"),
  unit: z.string().max(50, "Unit too long"),
  on_hand: z.number().min(0, "Quantity cannot be negative"),
  min_quantity: z.number().min(0, "Minimum quantity cannot be negative"),

export const StockAdjustmentSchema = z.object({

  reason: z.string().max(500, "Reason too long").optional(),

// ============================================================================
// Validation Helper Functions
// ============================================================================

/**
 * Safely parse and validate data with a Zod schema
 * Returns { success: true, data } or { success: false, errors }
 */
export function validateData<T>(

): { success: true; data: T } | { success: false; errors: z.ZodError } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (_error) {
    if (_error instanceof z.ZodError) {
      return { success: false, errors: _error };
    }
    throw _error;
  }
}

/**
 * Validate and return errors in a user-friendly format
 */
export function getValidationErrors(error: z.ZodError): Array<{ field: string; message: string }> {
  return error.errors.map((err) => ({

  }));
}
