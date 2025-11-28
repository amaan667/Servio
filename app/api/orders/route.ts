import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createSupabaseClient } from "@/lib/supabase";
import { apiLogger, logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { isDevelopment } from '@/lib/env';
import { success, apiErrors, isZodError, handleZodError } from '@/lib/api/standard-response';
import { validateBody, createOrderSchema } from '@/lib/api/validation-schemas';

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
// GET handler for orders - Migrated to withUnifiedAuth
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

      // venueId comes from context (already verified by withUnifiedAuth)
      const venueId = context.venueId;

      const supabase = await createSupabaseClient();

      let query = supabase
        .from("orders")
        .select("*")
        .eq("venue_id", venueId)
        .order("created_at", { ascending: false });

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
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
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
  payment_mode?: "online" | "pay_later" | "pay_at_till";
  payment_method?: "demo" | "stripe" | "till" | null;
  // NOTE: session_id is NOT a database column - it's only used for client-side tracking
  source?: "qr" | "counter"; // Order source - qr for table orders, counter for counter orders
  stripe_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  scheduled_for?: string | null;
  prep_lead_minutes?: number;
};

// Legacy helper - use apiErrors instead
function bad(msg: string, status = 400) {
  if (status === 403) return apiErrors.forbidden(msg);
  if (status === 404) return apiErrors.notFound(msg);
  if (status === 500) return apiErrors.internal(msg);
  return apiErrors.badRequest(msg);
}

// Function to create KDS tickets for an order
async function createKDSTickets(
  supabase: SupabaseClient,
  order: { id: string; venue_id: string; items?: Array<Record<string, unknown>> }
) {
  try {
    // First, ensure KDS stations exist for this venue
    const { data: existingStations } = await supabase
      .from("kds_stations")
      .select("id, station_type")
      .eq("venue_id", order.venue_id)
      .eq("is_active", true);

    if (!existingStations || existingStations.length === 0) {
      logger.debug("[KDS TICKETS] No stations found, creating default stations for venue", {
        extra: { venueId: order.venue_id },
      });

      // Create default stations
      const defaultStations = [
        { name: "Expo", type: "expo", order: 0, color: "#3b82f6" },
        { name: "Grill", type: "grill", order: 1, color: "#ef4444" },
        { name: "Fryer", type: "fryer", order: 2, color: "#f59e0b" },
        { name: "Barista", type: "barista", order: 3, color: "#8b5cf6" },
        { name: "Cold Prep", type: "cold", order: 4, color: "#06b6d4" },
      ];

      for (const station of defaultStations) {
        await supabase.from("kds_stations").upsert(
          {
            venue_id: order.venue_id,
            station_name: station.name,
            station_type: station.type,
            display_order: station.order,
            color_code: station.color,
            is_active: true,
          },
          {
            onConflict: "venue_id,station_name",
          }
        );
      }

      // Fetch stations again
      const { data: stations } = await supabase
        .from("kds_stations")
        .select("id, station_type")
        .eq("venue_id", order.venue_id)
        .eq("is_active", true);

      if (!stations || stations.length === 0) {
        throw new Error("Failed to create KDS stations");
      }

      if (existingStations) {
        existingStations.push(...stations);
      }
    }

    // Get the expo station (default for all items)
    if (!existingStations || existingStations.length === 0) {
      throw new Error("No KDS stations available");
    }

    const expoStation =
      existingStations.find(
        (s: Record<string, unknown>) => (s as { station_type?: string }).station_type === "expo"
      ) || existingStations[0];

    if (!expoStation) {
      throw new Error("No KDS station available");
    }

    // Get customer name from order
    const customerName = (order as Record<string, unknown>).customer_name as string | undefined;
    const tableNumber = (order as Record<string, unknown>).table_number as number | null;

    // Get actual table label if table_id exists
    let tableLabel = customerName || "Guest"; // Default to customer name
    const tableId = (order as Record<string, unknown>).table_id as string | undefined;

    if (tableId) {
      const { data: tableData } = await supabase
        .from("tables")
        .select("label")
        .eq("id", tableId)
        .single();

      if (tableData?.label) {
        tableLabel = tableData.label;
      }
    } else if (tableNumber) {
      tableLabel = `Table ${tableNumber}`;
    }

    // Create tickets for each order item
    const items = Array.isArray(order.items) ? (order.items as Array<Record<string, unknown>>) : [];

    for (const item of items) {
      const itemData = item as {
        item_name?: string;
        quantity?: string | number;
        specialInstructions?: string;
      };

      // Smart station routing based on item name
      const itemName = (itemData.item_name || "").toLowerCase();
      let assignedStation = expoStation;

      // Route to appropriate station based on item keywords
      if (
        itemName.includes("coffee") ||
        itemName.includes("latte") ||
        itemName.includes("cappuccino") ||
        itemName.includes("espresso") ||
        itemName.includes("tea") ||
        itemName.includes("drink")
      ) {
        const baristaStation = existingStations.find(
          (s: Record<string, unknown>) =>
            (s as { station_type?: string }).station_type === "barista"
        );
        if (baristaStation) assignedStation = baristaStation;
      } else if (
        itemName.includes("burger") ||
        itemName.includes("steak") ||
        itemName.includes("chicken") ||
        itemName.includes("grill")
      ) {
        const grillStation = existingStations.find(
          (s: Record<string, unknown>) => (s as { station_type?: string }).station_type === "grill"
        );
        if (grillStation) assignedStation = grillStation;
      } else if (
        itemName.includes("fries") ||
        itemName.includes("chips") ||
        itemName.includes("fried") ||
        itemName.includes("fryer")
      ) {
        const fryerStation = existingStations.find(
          (s: Record<string, unknown>) => (s as { station_type?: string }).station_type === "fryer"
        );
        if (fryerStation) assignedStation = fryerStation;
      } else if (
        itemName.includes("salad") ||
        itemName.includes("sandwich") ||
        itemName.includes("cold")
      ) {
        const coldStation = existingStations.find(
          (s: Record<string, unknown>) => (s as { station_type?: string }).station_type === "cold"
        );
        if (coldStation) assignedStation = coldStation;
      }

      const ticketData = {
        venue_id: order.venue_id,
        order_id: order.id,
        station_id: (assignedStation as { id: string }).id,
        item_name: itemData.item_name || "Unknown Item",
        quantity:
          typeof itemData.quantity === "string"
            ? parseInt(itemData.quantity)
            : itemData.quantity || 1,
        special_instructions: itemData.specialInstructions || null,
        modifiers: (itemData as { modifiers?: unknown }).modifiers || null,
        table_number: tableNumber,
        table_label: tableLabel,
        status: "new",
      };

      const { error: ticketError } = await supabase.from("kds_tickets").insert(ticketData);

      if (ticketError) {
        logger.error("[KDS TICKETS] Failed to create ticket for item:", {
          error: { item, context: ticketError },
        });
        throw ticketError;
      }
    }

    logger.debug("[KDS TICKETS] Successfully created KDS tickets", {
      data: { count: items.length, orderId: order.id },
    });
  } catch (_error) {
    logger.error("[KDS TICKETS] Error creating KDS tickets:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    throw _error;
  }
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
export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    const requestId = Math.random().toString(36).substring(7);
    const startTime = Date.now();

    // Use logger.info (not logger.debug - that's stripped in production!)

    logger.info(
      `🎯🎯🎯 [ORDERS API ${requestId}] NEW ORDER SUBMISSION at ${new Date().toISOString()} 🎯🎯🎯`
    );

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
      
      // Verify venue_id matches authenticated context (security check)
      if (body.venue_id && body.venue_id !== context.venueId) {
        logger.warn("[ORDERS POST] Venue ID mismatch", {
          provided: body.venue_id,
          authenticated: context.venueId,
          userId: context.user.id,
        });
        return apiErrors.forbidden("Venue ID mismatch");
      }
      
      // Use venueId from context (already verified by withUnifiedAuth)
      const venueId = context.venueId;

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
      if (isZodError(validationError)) {
        return handleZodError(validationError);
      }
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

    // Use authenticated client
    const supabase = await createSupabaseClient();

    // Verify venue exists (venue access already verified by withUnifiedAuth)
    const { data: venue, error: venueErr } = await supabase
      .from("venues")
      .select("venue_id")
      .eq("venue_id", venueId)
      .maybeSingle();

    if (venueErr) {
      return bad(`Failed to verify venue: ${venueErr.message}`, 500);
    }

    if (!venue) {
      // Venue should exist (verified by withUnifiedAuth), but if it doesn't, return error
      logger.error("[ORDERS POST] Venue not found despite auth check", {
        venueId,
        userId: context.user.id,
      });
      return bad("Venue not found", 404);
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
        return bad(`Failed to check existing tables: ${lookupError.message}`, 500);
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
              return bad(`Failed to create table: ${tableCreateErr.message}`, 500);
            }
          } else {
            return bad(`Failed to create table: ${tableCreateErr.message}`, 500);
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
    const orderSource = ((body as { source?: "qr" | "counter" }).source) || "qr" as "qr" | "counter"; // Default to 'qr' if not provided

    const payload: OrderPayload = {
      venue_id: venueId,
      table_number,
      table_id: tableId, // Add table_id to the payload
      customer_name: validatedOrderBody.customer_name.trim(),
      customer_phone: validatedOrderBody.customer_phone.trim(), // Required field, already validated
      items: safeItems,
      total_amount: finalTotal,
      notes: (body as { notes?: string }).notes ?? null,
      order_status: ((body as { order_status?: "PLACED" | "ACCEPTED" | "IN_PREP" | "READY" | "SERVING" | "COMPLETED" | "CANCELLED" | "REFUNDED" }).order_status) || "IN_PREP", // Default to IN_PREP so it shows in Live Orders immediately
      payment_status: ((body as { payment_status?: "UNPAID" | "PAID" | "TILL" | "REFUNDED" }).payment_status) || "UNPAID", // Use provided status or default to 'UNPAID'
      payment_mode: validatedOrderBody.payment_mode || "online", // New field for payment mode
      payment_method: ((body as { payment_method?: "demo" | "stripe" | "till" | null }).payment_method ?? null) as "demo" | "stripe" | "till" | null,
      // NOTE: session_id is NOT a database column - don't include in payload
      source: orderSource, // Use source from client (based on QR code URL: ?table=X -> 'qr', ?counter=X -> 'counter')
    };

    // Check for duplicate orders (idempotency check)
    // Look for orders with same customer, table, venue, and recent timestamp (within 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: existingOrder, error: duplicateCheckError } = await supabase
      .from("orders")
      .select("id, created_at, order_status, payment_status")
      .eq("venue_id", venueId)
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

    const { data: inserted, error: insertErr } = await supabase
      .from("orders")
      .insert(payload)
      .select("*");

    if (insertErr) {
      logger.error("[ORDER CREATION DEBUG] ===== INSERT FAILED =====");
      logger.error("[ORDER CREATION DEBUG] Error details:", { value: insertErr });

      // Try to provide more specific error messages
      let errorMessage = insertErr.message;
      if (insertErr.code === "23505") {
        errorMessage = "Order already exists with this ID";
      } else if (insertErr.code === "23503") {
        errorMessage = "Referenced venue or table does not exist";
      } else if (insertErr.code === "23514") {
        errorMessage = "Data validation failed - check required fields";
      }

      return bad(`Insert failed: ${errorMessage}`, 400);
    }

    if (!inserted || inserted.length === 0) {
      logger.error("❌❌❌ NO DATA RETURNED FROM INSERT ❌❌❌", { requestId });
      return bad("Order creation failed - no data returned", 500);
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
        // Update existing session to ORDERING status
        const { error: sessionUpdateError } = await supabase
          .from("table_sessions")
          .update({
            status: "ORDERING",
            order_id: inserted[0].id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingSession.id);

        if (sessionUpdateError) {
          logger.error("[ORDERS] Error updating session status:", { error: sessionUpdateError });
        }
      } else {
        // Create new session with ORDERING status
        const { error: sessionCreateError } = await supabase.from("table_sessions").insert({
          table_id: tableId,
          venue_id: venueId,
          status: "ORDERING",
          order_id: inserted[0].id,
          opened_at: new Date().toISOString(),
        });

        if (sessionCreateError) {
          logger.error("[ORDERS] Error creating table session:", { error: sessionCreateError });
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
        return bad("Order creation failed: No order data returned from database", 500);
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
      await createKDSTickets(supabase, inserted[0]);
    } catch (kdsError) {
      logger.warn("[ORDER CREATION DEBUG] KDS ticket creation failed (non-critical):", {
        value: kdsError,
      });
      // Don't fail the order creation if KDS tickets fail
    }

    const duration = Date.now() - startTime;

    logger.info("✅✅✅ ORDER CREATED SUCCESSFULLY ✅✅✅", {
      orderId: inserted[0].id,
      customer: inserted[0].customer_name,
      venue: inserted[0].venue_id,
      table: inserted[0].table_number,
      total: inserted[0].total_amount,
      duration: `${duration}ms`,
      requestId,
    });

    return NextResponse.json(response);
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      const duration = Date.now() - startTime;

      logger.error("❌❌❌ ORDER CREATION FAILED ❌❌❌", {
        error: errorMessage,
        stack: errorStack,
        duration: `${duration}ms`,
        requestId,
        venueId: context.venueId,
        userId: context.user.id,
      });

      // Check if it's an authentication/authorization error
      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
        return NextResponse.json(
          {
            ok: false,
            error: errorMessage.includes("Unauthorized") ? "Unauthorized" : "Forbidden",
            message: errorMessage,
          },
          { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
        );
      }

      // Return generic error in production, detailed in development
      return apiErrors.internal(
        "Failed to create order",
        isDevelopment() ? { message: errorMessage, stack: errorStack } : undefined
      );
    }
  },
  {
    // Extract venueId from body
    extractVenueId: async (req) => {
      try {
        const body = await req.json();
        return body?.venue_id || body?.venueId || null;
      } catch {
        return null;
      }
    },
  }
);
