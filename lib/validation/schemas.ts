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
  id: z.string().uuid().optional(),
  venue_id: VenueIdSchema,
  name: z.string().min(1, "Name is required").max(200, "Name too long"),
  description: z.string().max(1000, "Description too long").optional().nullable(),
  price: PriceSchema,
  category: z.string().min(1, "Category is required").max(100, "Category too long"),
  image_url: z.string().url("Invalid image URL").optional().nullable(),
  is_available: z.boolean().default(true),
  dietary_info: z
    .array(z.enum(["vegetarian", "vegan", "gluten-free", "dairy-free", "nut-free"]))
    .optional()
    .nullable(),
  allergens: z.array(z.string()).optional().nullable(),
});

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
  menu_item_id: z.string().uuid(),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  price: PriceSchema,
  special_instructions: z.string().max(500, "Instructions too long").optional(),
});

export const CreateOrderSchema = z.object({
  venue_id: VenueIdSchema,
  table_number: z.string().max(50, "Table number too long").optional().nullable(),
  items: z.array(OrderItemSchema).min(1, "At least one item required"),
  total_amount: PriceSchema,
  payment_method: PaymentMethodSchema,
  customer_name: z.string().max(200, "Name too long").optional(),
  customer_phone: PhoneSchema,
  special_requests: z.string().max(1000, "Requests too long").optional(),
});

// ============================================================================
// Table Schemas
// ============================================================================

export const TableStatusSchema = z.enum(["AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING"]);

export const TableSchema = z.object({
  id: z.string().uuid().optional(),
  venue_id: VenueIdSchema,
  label: z.string().min(1, "Table label required").max(50, "Label too long"),
  capacity: z.number().int().min(1, "Capacity must be at least 1").max(50, "Capacity too high"),
  status: TableStatusSchema.default("AVAILABLE"),
  current_session_id: z.string().uuid().optional().nullable(),
});

// ============================================================================
// Staff Schemas
// ============================================================================

export const StaffRoleSchema = z.enum(["manager", "kitchen_staff", "waiter", "host"]);

export const InviteStaffSchema = z.object({
  venue_id: VenueIdSchema,
  email: EmailSchema,
  role: StaffRoleSchema,
  invited_by: UserIdSchema,
});

// ============================================================================
// Feedback Schemas
// ============================================================================

export const FeedbackTypeSchema = z.enum(["stars", "multiple_choice", "paragraph"]);

export const CreateFeedbackQuestionSchema = z.object({
  venue_id: VenueIdSchema,
  prompt: z.string().min(3, "Question too short").max(500, "Question too long"),
  type: FeedbackTypeSchema,
  choices: z.array(z.string()).optional(),
  is_active: z.boolean().default(true),
});

// ============================================================================
// Analytics Schemas
// ============================================================================

export const TimePeriodSchema = z.enum(["7d", "30d", "3m", "1y", "custom"]);

export const DateRangeSchema = z.object({
  start: z.string().datetime("Invalid start date"),
  end: z.string().datetime("Invalid end date"),
});

// ============================================================================
// Inventory Schemas
// ============================================================================

export const IngredientSchema = z.object({
  id: z.string().uuid().optional(),
  venue_id: VenueIdSchema,
  name: z.string().min(1, "Name required").max(200, "Name too long"),
  unit: z.string().max(50, "Unit too long"),
  on_hand: z.number().min(0, "Quantity cannot be negative"),
  min_quantity: z.number().min(0, "Minimum quantity cannot be negative"),
  cost_per_unit: PriceSchema,
});

export const StockAdjustmentSchema = z.object({
  ingredient_id: z.string().uuid(),
  delta: z.number().int(),
  reason: z.string().max(500, "Reason too long").optional(),
});

// ============================================================================
// Validation Helper Functions
// ============================================================================

/**
 * Safely parse and validate data with a Zod schema
 * Returns { success: true, data } or { success: false, errors }
 */
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
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
    field: err.path.join("."),
    message: err.message,
  }));
}
