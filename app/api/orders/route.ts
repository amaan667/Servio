import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createSupabaseClient, createAdminClient } from "@/lib/supabase";
import { apiLogger, logger } from "@/lib/logger";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { validateBody, createOrderSchema } from "@/lib/api/validation-schemas";
import { createKDSTicketsWithAI } from "@/lib/orders/kds-tickets-unified";

export const runtime = "nodejs";

/**
 * @swagger
 * /api/orders:
 *   get:
 *     summary: Get orders for a venue
 *     tags: [Orders]
 *     parameters:
 *       - in: query
 *         name: venueId
 *         required: true
 *         schema:
 *           type: string
 *         description: Venue ID
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter by order status
 *     responses:
 *       200:
 *         description: List of orders
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 orders:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Order'
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET handler for orders - Requires auth
export const GET = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // CRITICAL: Rate limiting
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return NextResponse.json(
          {
            ok: false,
            error: "Too many requests",
            message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
          },
          { status: 429 }
        );
      }

      const { searchParams } = new URL(req.url);
      const status = searchParams.get("status");
      const limitParam = searchParams.get("limit");
      const offsetParam = searchParams.get("offset");

      // CRITICAL: Bound query to prevent unbounded data fetches
      // Default limit: 100 orders (reasonable for pilot scale)
      // Max limit: 500 orders (hard cap to prevent abuse)
      const limit = Math.min(limitParam ? parseInt(limitParam, 10) : 100, 500);
      const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

      // venueId comes from context (already verified by withUnifiedAuth)
      const venueId = context.venueId;

      const supabase = await createSupabaseClient();

      let query = supabase
        .from("orders")
        .select("*")
        .eq("venue_id", venueId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1); // CRITICAL: Bound query with pagination

      if (status) {
        query = query.eq("order_status", status);
      }

      const { data: orders, error } = await query;

      if (error) {
        apiLogger.error("[ORDERS GET] Database error:", {
          error: error.message,
          venueId,
        });
        return apiErrors.database(
          "Failed to fetch orders",
          isDevelopment() ? error.message : undefined
        );
      }

      return success({ orders: orders || [] });
    } catch (_error) {
      const errorMessage =
        _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;

      apiLogger.error("[ORDERS GET] Unexpected error:", {
        error: errorMessage,
        stack: errorStack,
      });

      return apiErrors.internal(
        "Failed to fetch orders",
        isDevelopment() ? { message: errorMessage, stack: errorStack } : undefined
      );
    }
  },
  {
    // Extract venueId from query string
    extractVenueId: async (req) => {
      const { searchParams } = new URL(req.url);
      return searchParams.get("venueId");
    },
  }
);

type OrderItem = {
  menu_item_id: string | null;
  quantity: number;
  price: number;
  item_name: string;
  specialInstructions?: string | null;
};

type OrderPayload = {
  venue_id: string;
  table_number?: number | null;
  table_id?: string | null; // Add table_id field
  customer_name: string;
  customer_phone: string; // Make required since database requires it
  items: OrderItem[];
  total_amount: number;
  notes?: string | null;
  order_status?:
    | "PLACED"
    | "ACCEPTED"
    | "IN_PREP"
    | "READY"
    | "SERVING"
    | "COMPLETED"
    | "CANCELLED"
    | "REFUNDED";
  payment_status?: "UNPAID" | "PAID" | "TILL" | "REFUNDED";
  payment_mode?: "online" | "deferred" | "offline";
  payment_method?: "PAY_NOW" | "PAY_LATER" | "PAY_AT_TILL" | string; // Standardized payment method values
  // NOTE: session_id is NOT a database column - it's only used for client-side tracking
  source?: "qr" | "counter"; // Order source - qr for table orders, counter for counter orders
  stripe_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  scheduled_for?: string | null;
  prep_lead_minutes?: number;
};

// Legacy helper - use apiErrors instead
function bad(msg: string, status = 400, requestId?: string) {
  // Log error using structured logger (Railway captures via next.config.mjs)
  logger.error(`[ORDERS API ${requestId || "unknown"}] Error`, { msg, status, requestId });
  if (status === 403) return apiErrors.forbidden(msg);
  if (status === 404) return apiErrors.notFound(msg);
  if (status === 500) return apiErrors.internal(msg);
  return apiErrors.badRequest(msg);
}

// Wrapper function for backward compatibility
async function createKDSTickets(
  supabase: SupabaseClient,
  order: {
    id: string;
    venue_id: string;
    items?: Array<Record<string, unknown>>;
    customer_name?: string;
    table_number?: number | null;
    table_id?: string;
  }
) {
  return createKDSTicketsWithAI(supabase, {
    id: order.id,
    venue_id: order.venue_id,
    items: order.items as Array<{
      item_name?: string;
      quantity?: string | number;
      specialInstructions?: string;
      modifiers?: unknown;
    }>,
    customer_name: order.customer_name,
    table_number: order.table_number,
    table_id: order.table_id,
  });
}

/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Create a new order
 *     tags: [Orders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - venue_id
 *               - customer_name
 *               - customer_phone
 *               - items
 *               - total_amount
 *             properties:
 *               venue_id:
 *                 type: string
 *               customer_name:
 *                 type: string
 *               customer_phone:
 *                 type: string
 *               table_number:
 *                 type: number
 *               items:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/OrderItem'
 *               total_amount:
 *                 type: number
 *               order_status:
 *                 type: string
 *                 enum: [PLACED, ACCEPTED, IN_PREP, READY, SERVING, COMPLETED, CANCELLED]
 *               payment_status:
 *                 type: string
 *                 enum: [UNPAID, PAID, TILL, REFUNDED]
 *     responses:
 *       200:
 *         description: Order created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 order:
 *                   $ref: '#/components/schemas/Order'
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();

  // Use logger.info for structured logging (Railway captures console.info via next.config.mjs)
  logger.info(`[ORDERS API ${requestId}] NEW ORDER SUBMISSION`, {
    timestamp: new Date().toISOString(),
    requestId,
  });

  try {
    // CRITICAL: Rate limiting
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Too many requests",
          message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
        },
        { status: 429 }
      );
    }

    const body = (await req.json()) as Partial<OrderPayload>;

    // Log received payload structure (for debugging 400 errors)
    logger.info(`[ORDERS API ${requestId}] Received request body`, {
      requestId,
      hasVenueId: !!body.venue_id,
      hasCustomerName: !!body.customer_name,
      hasCustomerPhone: !!body.customer_phone,
      hasItems: Array.isArray(body.items),
      itemsCount: Array.isArray(body.items) ? body.items.length : 0,
      hasTotalAmount: typeof body.total_amount === "number",
      totalAmount: body.total_amount,
      tableNumber: body.table_number,
      paymentMode: (body as { payment_mode?: string }).payment_mode,
      paymentStatus: (body as { payment_status?: string }).payment_status,
      orderStatus: (body as { order_status?: string }).order_status,
    });

    // Validate venue_id is provided
    if (!body.venue_id) {
      logger.error(`[ORDERS API ${requestId}] Missing venue_id in request`);
      return apiErrors.badRequest("venue_id is required");
    }

    const venueId = body.venue_id;

    // STEP 3: Validate input with Zod
    let validatedOrderBody: OrderPayload;
    try {
      const validatedBody = await validateBody(createOrderSchema, {
        ...body,
        venue_id: venueId, // Use venueId from context
      });

      // Use validated body for rest of function
      validatedOrderBody = validatedBody as OrderPayload;
    } catch (validationError) {
      // Log validation errors in detail for debugging 400 errors
      if (isZodError(validationError)) {
        logger.error(`[ORDERS API ${requestId}] Validation error`, {
          error: validationError.errors,
          receivedPayload: {
            venue_id: body.venue_id,
            customer_name: body.customer_name,
            customer_phone: body.customer_phone,
            items: Array.isArray(body.items)
              ? body.items.map((item: unknown) => ({
                  hasMenuItemId: !!(item as { menu_item_id?: unknown }).menu_item_id,
                  hasItemName: !!(item as { item_name?: unknown }).item_name,
                  hasQuantity: typeof (item as { quantity?: unknown }).quantity === "number",
                  hasPrice: typeof (item as { price?: unknown }).price === "number",
                }))
              : "not an array",
            total_amount: body.total_amount,
          },
        });
        return handleZodError(validationError);
      }
      logger.error(`[ORDERS API ${requestId}] Non-Zod validation error`, {
        error: validationError instanceof Error ? validationError.message : String(validationError),
        errorType:
          validationError instanceof Error
            ? validationError.constructor.name
            : typeof validationError,
        requestId,
      });
      return apiErrors.validation("Invalid order data");
    }

    logger.info("📥📥📥 REQUEST RECEIVED 📥📥📥", {
      customer: validatedOrderBody.customer_name,
      venue: venueId,
      table: validatedOrderBody.table_number,
      items: validatedOrderBody.items?.length,
      total: validatedOrderBody.total_amount,
      requestId,
    });

    logger.info("✅✅✅ ALL VALIDATIONS PASSED ✅✅✅", {
      customer: validatedOrderBody.customer_name,
      venue: venueId,
      items: validatedOrderBody.items?.length,
      total: validatedOrderBody.total_amount,
      requestId,
    });

    const tn = validatedOrderBody.table_number;
    const table_number = tn === null || tn === undefined ? null : Number.isFinite(tn) ? tn : null;

    // SECURITY: Public customer route for QR code orders
    // This route is intentionally public (customers are not authenticated)
    // We use admin client because RLS would block unauthenticated inserts
    // SAFETY MEASURES:
    // 1. Venue is verified to exist before any operations
    // 2. ALL queries explicitly filter by venue_id to prevent cross-venue access
    // 3. Rate limiting is applied to prevent abuse
    // 4. Input validation ensures venue_id matches the verified venue
    const supabase = createAdminClient();

    // CRITICAL: Verify venue exists and is valid before proceeding
    // This prevents orders from being created for non-existent or invalid venues
    const { data: venue, error: venueErr } = await supabase
      .from("venues")
      .select("venue_id")
      .eq("venue_id", venueId)
      .maybeSingle();

    if (venueErr) {
      logger.error(`[ORDERS API ${requestId}] Venue lookup error`, { error: venueErr, requestId });
      return bad(`Failed to verify venue: ${venueErr.message}`, 500, requestId);
    }

    if (!venue) {
      logger.error(`[ORDERS API ${requestId}] Venue not found`, { venueId, requestId });
      return bad("Venue not found", 404, requestId);
    }

    // Auto-create table if it doesn't exist (for QR code scenarios)
    let tableId = null;
    if (validatedOrderBody.table_number) {
      // Check if table exists - first try to find by table number directly
      const { data: existingTable, error: lookupError } = await supabase
        .from("tables")
        .select("id, label")
        .eq("venue_id", venueId)
        .eq("label", validatedOrderBody.table_number.toString())
        .eq("is_active", true)
        .maybeSingle();

      if (lookupError) {
        logger.error(`[ORDERS API ${requestId}] Failed to check existing tables`, {
          error: lookupError.message,
          requestId,
        });
        return bad(`Failed to check existing tables: ${lookupError.message}`, 500, requestId);
      }

      if (existingTable) {
        tableId = existingTable.id;
      } else {
        // Get group size from group session to determine seat count
        let seatCount = 4; // Default fallback
        try {
          const { data: groupSession } = await supabase
            .from("table_group_sessions")
            .select("total_group_size")
            .eq("venue_id", venueId)
            .eq("table_number", validatedOrderBody.table_number)
            .eq("is_active", true)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (groupSession && groupSession.total_group_size) {
            seatCount = groupSession.total_group_size;
          }
        } catch {
          // Error handled
        }

        // Insert new table. Avoid UPSERT because the database may not have
        // a unique constraint on (venue_id, label) in some environments.
        const { data: newTable, error: tableCreateErr } = await supabase
          .from("tables")
          .insert({
            venue_id: venueId,
            label: validatedOrderBody.table_number.toString(),
            seat_count: seatCount,
            area: null,
            is_active: true,
          })
          .select("id, label")
          .single();

        if (tableCreateErr) {
          // If it's a duplicate key error, try to fetch the existing table
          if (tableCreateErr.code === "23505") {
            const { data: existingTableAfterError } = await supabase
              .from("tables")
              .select("id, label")
              .eq("venue_id", venueId)
              .eq("label", validatedOrderBody.table_number.toString())
              .eq("is_active", true)
              .single();

            if (existingTableAfterError) {
              tableId = existingTableAfterError.id;
            } else {
              logger.error(`[ORDERS API ${requestId}] Failed to create table`, {
                error: tableCreateErr.message,
                requestId,
              });
              return bad(`Failed to create table: ${tableCreateErr.message}`, 500, requestId);
            }
          } else {
            logger.error(`[ORDERS API ${requestId}] Failed to create table`, {
              error: tableCreateErr.message,
              requestId,
            });
            return bad(`Failed to create table: ${tableCreateErr.message}`, 500, requestId);
          }
        } else {
          tableId = newTable.id;
        }

        // Only create session if we have a valid tableId
        if (tableId) {
          // Check if session already exists to prevent duplicates
          const { data: existingSession } = await supabase
            .from("table_sessions")
            .select("id")
            .eq("venue_id", venueId)
            .eq("table_id", tableId)
            .is("closed_at", null)
            .maybeSingle();

          if (!existingSession) {
            const { error: sessionErr } = await supabase.from("table_sessions").insert({
              venue_id: venueId,
              table_id: tableId,
              status: "FREE",
              opened_at: new Date().toISOString(),
              closed_at: null,
            });

            if (sessionErr) {
              // Don't fail the request if session creation fails
            }
          }
        }
      }
    }

    // Recompute total server-side for safety
    const computedTotal = (validatedOrderBody.items || []).reduce((sum, it) => {
      const qty = Number(it.quantity) || 0;
      const price = Number(it.price) || 0;
      return sum + qty * price;
    }, 0);
    const finalTotal =
      Math.abs(computedTotal - (validatedOrderBody.total_amount || 0)) < 0.01
        ? validatedOrderBody.total_amount!
        : computedTotal;

    const safeItems = (validatedOrderBody.items || []).map((it) => ({
      menu_item_id: it.menu_item_id ?? null,
      quantity: Number(it.quantity) || 0,
      price: Number(it.price) || 0, // Use 'price' field directly (includes modifier price)
      item_name: it.item_name,
      specialInstructions:
        ((it as Record<string, unknown>).special_instructions as string) ??
        (it as { specialInstructions?: string }).specialInstructions ??
        null,
      modifiers: (it as { modifiers?: unknown }).modifiers || null,
      modifierPrice: (it as { modifierPrice?: number }).modifierPrice || 0,
    }));

    // Use the source provided by the client (determined from URL parameters)
    // The client already determines this based on whether the QR code URL contains ?table=X or ?counter=X
    const orderSource =
      (body as { source?: "qr" | "counter" }).source || ("qr" as "qr" | "counter"); // Default to 'qr' if not provided

    const payload: OrderPayload = {
      venue_id: venueId,
      table_number,
      table_id: tableId, // Add table_id to the payload
      customer_name: validatedOrderBody.customer_name.trim(),
      customer_phone: validatedOrderBody.customer_phone.trim(), // Required field, already validated
      items: safeItems,
      total_amount: finalTotal,
      notes: (body as { notes?: string }).notes ?? null,
      order_status:
        (
          body as {
            order_status?:
              | "PLACED"
              | "ACCEPTED"
              | "IN_PREP"
              | "READY"
              | "SERVING"
              | "COMPLETED"
              | "CANCELLED"
              | "REFUNDED";
          }
        ).order_status || "PLACED", // Default to PLACED so orders show "waiting on kitchen" initially
      payment_status:
        (body as { payment_status?: "UNPAID" | "PAID" | "TILL" | "REFUNDED" }).payment_status ||
        "UNPAID", // Use provided status or default to 'UNPAID'
      payment_mode: validatedOrderBody.payment_mode || "online", // New field for payment mode
      payment_method: (() => {
        const method = (body as { payment_method?: string }).payment_method;
        // Map old values to standardized values
        if (!method) return "PAY_NOW"; // Default fallback
        const upperMethod = (method || "").toUpperCase();
        if (upperMethod === "DEMO" || upperMethod === "STRIPE" || upperMethod === "PAY_NOW")
          return "PAY_NOW";
        if (upperMethod === "TILL" || upperMethod === "PAY_AT_TILL") return "PAY_AT_TILL";
        if (upperMethod === "LATER" || upperMethod === "PAY_LATER") return "PAY_LATER";
        return "PAY_NOW"; // Default fallback
      })(),
      // NOTE: session_id is NOT a database column - don't include in payload
      source: orderSource, // Use source from client (based on QR code URL: ?table=X -> 'qr', ?counter=X -> 'counter')
      // NOTE: is_active is a generated column in the database, don't include it in insert
    };

    // Check for duplicate orders (idempotency check)
    // Look for orders with same customer, table, venue, and recent timestamp (within 5 minutes)
    // CRITICAL: All queries MUST filter by venue_id to prevent cross-venue data access
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: existingOrder, error: duplicateCheckError } = await supabase
      .from("orders")
      .select("id, created_at, order_status, payment_status")
      .eq("venue_id", venueId) // CRITICAL: Explicit venue filter
      .eq("customer_name", payload.customer_name)
      .eq("customer_phone", payload.customer_phone)
      .eq("table_number", payload.table_number)
      .gte("created_at", fiveMinutesAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (duplicateCheckError) {
      logger.warn("[ORDER API] Duplicate check failed:", { value: duplicateCheckError });
    }

    // If we found a recent duplicate, return it instead of creating a new one
    if (existingOrder) {
      logger.debug("[ORDER API] Found duplicate order, returning existing", {
        data: (existingOrder as Record<string, unknown>)?.id,
      });
      return NextResponse.json({
        ok: true,
        order: existingOrder,
        table_auto_created: tableId !== null,
        table_id: tableId,
        session_id: ((body as Record<string, unknown>).session_id as string) || null,
        source: orderSource,
        display_name:
          orderSource === "counter" ? `Counter ${table_number}` : `Table ${table_number}`,
        duplicate: true,
      });
    }

    // Final validation before insertion
    logger.debug("[ORDER CREATION DEBUG] Order details:", {
      data: {
        customer: payload.customer_name,
        table: payload.table_number,
        venueId: payload.venue_id,
      },
    });
    logger.debug("[ORDER CREATION DEBUG] Payment details:", {
      data: {
        status: payload.payment_status,
        method: payload.payment_method,
        source: payload.source,
        total: payload.total_amount,
        itemsCount: payload.items?.length || 0,
      },
    });

    // Clean payload: remove undefined values, ensure nulls, add timestamps
    // Database might require created_at/updated_at or have NOT NULL constraints
    const now = new Date().toISOString();
    const cleanPayload: Record<string, unknown> = {
      venue_id: payload.venue_id,
      table_number: payload.table_number ?? null,
      table_id: payload.table_id ?? null,
      customer_name: payload.customer_name,
      customer_phone: payload.customer_phone,
      customer_email:
        (validatedOrderBody as { customer_email?: string | null }).customer_email ?? null, // Include customer_email if provided
      items: payload.items,
      total_amount: payload.total_amount,
      notes: payload.notes ?? null,
      order_status: payload.order_status || "PLACED", // Default to PLACED so orders show "waiting on kitchen" initially
      payment_status: payload.payment_status || "UNPAID",
      payment_method: payload.payment_method || "PAY_NOW", // Ensure payment_method is always set (required by constraint)
      // Unified lifecycle defaults (canonical source of truth)
      kitchen_status: "PREPARING",
      service_status: "NOT_SERVED",
      completion_status: "OPEN",
      payment_mode: (() => {
        // Ensure payment_mode matches payment_method for constraint consistency
        const method = payload.payment_method || "PAY_NOW";
        const upperMethod = (method || "").toUpperCase();
        if (upperMethod === "PAY_NOW") return "online";
        if (upperMethod === "PAY_AT_TILL") return "offline";
        if (upperMethod === "PAY_LATER") return "deferred";
        // Default fallback
        return payload.payment_mode || "online";
      })(),
      source: payload.source || "qr",
      // NOTE: is_active is a GENERATED column in the database - computed automatically, DO NOT include in insert
      created_at: now,
      updated_at: now,
    };

    // Remove undefined fields (they break JSON serialization)
    Object.keys(cleanPayload).forEach((key) => {
      if (cleanPayload[key] === undefined) {
        delete cleanPayload[key];
      }
    });

    // Log the EXACT payload being inserted before database insert
    logger.info(`[ORDERS API ${requestId}] PAYLOAD BEFORE DATABASE INSERT`, {
      requestId,
      payloadKeys: Object.keys(cleanPayload),
      itemsCount: Array.isArray(cleanPayload.items) ? (cleanPayload.items as unknown[]).length : 0,
      payment_status: cleanPayload.payment_status,
      payment_mode: cleanPayload.payment_mode,
      payment_method: cleanPayload.payment_method,
      order_status: cleanPayload.order_status,
      venue_id: cleanPayload.venue_id,
      customer_name: cleanPayload.customer_name,
      customer_phone: cleanPayload.customer_phone,
      table_number: cleanPayload.table_number,
      table_id: cleanPayload.table_id,
      total_amount: cleanPayload.total_amount,
      source: cleanPayload.source,
      // is_active is a generated column, not included in payload
      created_at: cleanPayload.created_at,
      updated_at: cleanPayload.updated_at,
    });
    logger.debug("[ORDER CREATION DEBUG] Full cleaned payload", {
      payload: cleanPayload,
      requestId,
    });

    const { data: inserted, error: insertErr } = await supabase
      .from("orders")
      .insert(cleanPayload)
      .select("*");

    if (insertErr) {
      logger.error(`[ORDERS API ${requestId}] Database insert failed`, {
        errorCode: insertErr.code,
        errorMessage: insertErr.message,
        errorDetails: insertErr.details,
        errorHint: insertErr.hint,
        fullError: insertErr,
        payload: cleanPayload,
        requestId,
      });

      // Try to provide more specific error messages
      let errorMessage = insertErr.message || "Database insert failed";
      if (insertErr.code === "23505") {
        errorMessage = "Order already exists with this ID";
      } else if (insertErr.code === "23503") {
        errorMessage = `Referenced venue or table does not exist: ${insertErr.message}`;
      } else if (insertErr.code === "23514") {
        errorMessage = `Data validation failed: ${insertErr.message || "Check required fields"}`;
      } else if (insertErr.code === "23502") {
        errorMessage = `Required field is missing: ${insertErr.message || insertErr.hint || "Check all required fields"}`;
      } else if (insertErr.message) {
        errorMessage = insertErr.message;
        if (insertErr.hint) {
          errorMessage += ` (${insertErr.hint})`;
        }
      }

      logger.error(`[ORDERS API ${requestId}] Insert failed`, { errorMessage, requestId });
      return bad(`Insert failed: ${errorMessage}`, 400, requestId);
    }

    if (!inserted || inserted.length === 0) {
      logger.error("[ORDERS API] No data returned from insert", { requestId });
      return bad("Order creation failed - no data returned", 500, requestId);
    }
    logger.info("🎉🎉🎉 ORDER CREATED IN DATABASE 🎉🎉🎉", {
      orderId: inserted[0].id,
      customer: inserted[0].customer_name,
      table: inserted[0].table_number,
      requestId,
    });

    logger.debug("[ORDER CREATION DEBUG] Created order details:", {
      id: inserted[0].id,
      customer_name: inserted[0].customer_name,
      table_number: inserted[0].table_number,
      payment_status: inserted[0].payment_status,
      payment_method: inserted[0].payment_method,
      venue_id: inserted[0].venue_id,
    });

    // Note: items are embedded in orders payload in this schema; if you also mirror rows in order_items elsewhere, log success after that insert

    // Create or update table session to show table as occupied if we have a table
    if (tableId && inserted?.[0]?.id) {
      // First, check if there's an existing open session
      const { data: existingSession, error: checkError } = await supabase
        .from("table_sessions")
        .select("id, status")
        .eq("table_id", tableId)
        .is("closed_at", null)
        .maybeSingle();

      if (checkError) {
        // Error checking for existing session
      }

      if (existingSession) {
        // Update existing session to OCCUPIED status (table is now occupied with an order)
        const { error: sessionUpdateError } = await supabase
          .from("table_sessions")
          .update({
            status: "OCCUPIED",
            order_id: inserted[0].id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingSession.id);

        if (sessionUpdateError) {
          logger.error("[ORDERS] Error updating session status:", { error: sessionUpdateError });
        }
      } else {
        // Create new session with OCCUPIED status (table is now occupied with an order)
        const { error: sessionCreateError } = await supabase.from("table_sessions").insert({
          table_id: tableId,
          venue_id: venueId,
          status: "OCCUPIED",
          order_id: inserted[0].id,
          opened_at: new Date().toISOString(),
        });

        if (sessionCreateError) {
          logger.error("[ORDERS] Error creating table session:", { error: sessionCreateError });
        }
      }

      // Also update table_runtime_state to show table as OCCUPIED
      if (table_number) {
        const { error: runtimeStateError } = await supabase
          .from("table_runtime_state")
          .update({
            primary_status: "OCCUPIED",
            order_id: inserted[0].id,
            updated_at: new Date().toISOString(),
          })
          .eq("venue_id", venueId)
          .eq("label", `Table ${table_number}`);

        if (runtimeStateError) {
          logger.debug("[ORDERS] Error updating table runtime state (non-critical):", {
            error: runtimeStateError,
          });
        }
      }

      // Update by table_id if available
      if (tableId) {
        const { error: runtimeStateErrorById } = await supabase
          .from("table_runtime_state")
          .update({
            primary_status: "OCCUPIED",
            order_id: inserted[0].id,
            updated_at: new Date().toISOString(),
          })
          .eq("venue_id", venueId)
          .eq("table_id", tableId);

        if (runtimeStateErrorById) {
          logger.debug("[ORDERS] Error updating table runtime state by ID (non-critical):", {
            error: runtimeStateErrorById,
          });
        }
      }
    }

    // Ensure we have a valid order object
    let createdOrder;
    if (!inserted || inserted.length === 0 || !inserted[0]) {
      // Try to fetch the order we just created by querying the database

      const { data: fetchedOrder, error: fetchError } = await supabase
        .from("orders")
        .select("*")
        .eq("venue_id", venueId)
        .eq("customer_name", payload.customer_name)
        .eq("total_amount", payload.total_amount)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (fetchError || !fetchedOrder) {
        logger.error(
          `[ORDERS API ${requestId}] Order creation failed: No order data returned from database`,
          { fetchError, requestId }
        );
        return bad("Order creation failed: No order data returned from database", 500, requestId);
      }

      createdOrder = fetchedOrder;
    } else {
      createdOrder = inserted[0];
    }

    const response = {
      ok: true,
      order: createdOrder,
      table_auto_created: tableId !== null, // True if we auto-created a table
      table_id: tableId,
      session_id: ((body as Record<string, unknown>).session_id as string) || null, // Include session_id in response for client-side storage
      source: orderSource, // Include the correctly determined source
      display_name: orderSource === "counter" ? `Counter ${table_number}` : `Table ${table_number}`, // Include display name for UI
    };

    logger.debug("[ORDER CREATION DEBUG] Response data:", {
      data: JSON.stringify(response, null, 2),
    });

    // Create KDS tickets for the order
    try {
      const orderForTickets = createdOrder;
      const paymentMethod = String((orderForTickets as { payment_method?: unknown }).payment_method || "")
        .toUpperCase()
        .trim();
      const paymentStatus = String((orderForTickets as { payment_status?: unknown }).payment_status || "")
        .toUpperCase()
        .trim();

      // For PAY_NOW, only create KDS tickets once payment is confirmed.
      // This prevents kitchen work starting before card payment is actually completed.
      // For PAY_LATER and PAY_AT_TILL, create tickets immediately so kitchen can start.
      const shouldCreateTickets = paymentMethod !== "PAY_NOW" || paymentStatus === "PAID";

      if (shouldCreateTickets) {
        logger.info("[ORDER CREATION DEBUG] Creating KDS tickets for order:", {
          orderId: (orderForTickets as { id: string }).id,
          itemCount: Array.isArray((orderForTickets as { items?: unknown }).items)
            ? ((orderForTickets as { items: unknown[] }).items.length || 0)
            : 0,
          venueId: (orderForTickets as { venue_id: string }).venue_id,
          paymentMethod,
          paymentStatus,
          requestId,
        });
        await createKDSTickets(supabase, orderForTickets);
        logger.info("[ORDER CREATION DEBUG] ✅ KDS tickets created successfully", {
          orderId: (orderForTickets as { id: string }).id,
          requestId,
        });

        // Update order status to IN_PREP for Pay Later and Pay at Till orders
        // (Pay Now orders are updated to IN_PREP in Stripe webhook after payment confirmation)
        if (paymentMethod === "PAY_LATER" || paymentMethod === "PAY_AT_TILL") {
          const { error: statusUpdateError } = await supabase
            .from("orders")
            .update({
              order_status: "IN_PREP",
              kitchen_status: "PREPARING",
              service_status: "NOT_SERVED",
              completion_status: "OPEN",
              updated_at: new Date().toISOString(),
            })
            .eq("id", (orderForTickets as { id: string }).id)
            .eq("venue_id", (orderForTickets as { venue_id: string }).venue_id);

          if (statusUpdateError) {
            logger.error("[ORDER CREATION DEBUG] Failed to update order status to IN_PREP", {
              orderId: (orderForTickets as { id: string }).id,
              error: statusUpdateError,
          requestId,
        });
          } else {
            logger.info("[ORDER CREATION DEBUG] ✅ Updated order status to IN_PREP", {
              orderId: (orderForTickets as { id: string }).id,
              paymentMethod,
              requestId,
            });
          }
        }
      } else {
        logger.info("[ORDER CREATION DEBUG] Skipping KDS ticket creation for unpaid PAY_NOW order", {
          orderId: (orderForTickets as { id: string }).id,
          paymentMethod,
          paymentStatus,
          requestId,
        });
      }
    } catch (kdsError) {
      // Log detailed error but don't fail order creation
      const errorMessage = kdsError instanceof Error ? kdsError.message : JSON.stringify(kdsError);
      const errorStack = kdsError instanceof Error ? kdsError.stack : undefined;
      logger.error("[ORDER CREATION DEBUG] KDS ticket creation failed (non-critical)", {
        orderId: (createdOrder as { id: string }).id,
        error: errorMessage,
        stack: errorStack,
        orderItems: Array.isArray((createdOrder as { items?: unknown }).items)
          ? ((createdOrder as { items: unknown[] }).items.length || 0)
          : 0,
        venueId: (createdOrder as { venue_id: string }).venue_id,
        requestId,
        fullError: kdsError,
      });
      // Don't fail the order creation if KDS tickets fail - order is already created
    }

    const duration = Date.now() - startTime;

    logger.info("✅✅✅ ORDER CREATED SUCCESSFULLY ✅✅✅", {
      orderId: (createdOrder as { id: string }).id,
      customer: (createdOrder as { customer_name?: string }).customer_name,
      venue: (createdOrder as { venue_id: string }).venue_id,
      table: (createdOrder as { table_number?: unknown }).table_number,
      total: (createdOrder as { total_amount?: unknown }).total_amount,
      duration: `${duration}ms`,
      requestId,
    });

    return NextResponse.json(response);
  } catch (_error) {
    const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
    const errorStack = _error instanceof Error ? _error.stack : undefined;
    const duration = Date.now() - startTime;

    logger.error(`[ORDERS API ${requestId}] ORDER CREATION FAILED`, {
      error: errorMessage,
      stack: errorStack,
      duration: `${duration}ms`,
      requestId,
    });

    // Check if it's an authentication/authorization error
    if (errorMessage.includes("Unauthorized")) {
      return apiErrors.unauthorized(errorMessage);
    }
    if (errorMessage.includes("Forbidden")) {
      return apiErrors.forbidden(errorMessage);
    }

    // Return generic error in production, detailed in development
    return apiErrors.internal(
      "Failed to create order",
      isDevelopment() ? { message: errorMessage, stack: errorStack } : undefined
    );
  }
}
