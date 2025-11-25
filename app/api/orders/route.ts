import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createSupabaseClient } from "@/lib/supabase";
import { apiLogger, logger } from "@/lib/logger";

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
// GET handler for orders
export async function GET(req: NextRequest) {
  try {
    // CRITICAL: Add authentication
    const { requireAuthForAPI } = await import("@/lib/auth/api");
    const authResult = await requireAuthForAPI(req);
    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized", message: authResult.error || "Authentication required" },
        { status: 401 }
      );
    }

    // CRITICAL: Add rate limiting
    const { rateLimit, RATE_LIMITS } = await import("@/lib/rate-limit");
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
    const venueId = searchParams.get("venueId");
    const status = searchParams.get("status");

    if (!venueId) {
      return NextResponse.json({ ok: false, error: "venueId is required" }, { status: 400 });
    }

    // CRITICAL: Verify venue access
    const { requireVenueAccessForAPI } = await import("@/lib/auth/api");
    const venueAccessResult = await requireVenueAccessForAPI(venueId, req);
    if (!venueAccessResult.success) {
      return venueAccessResult.response;
    }

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
      apiLogger.error("Error fetching orders:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, orders: orders || [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown server error";
    apiLogger.error("GET orders error:", { error: e });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

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

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
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
export async function POST(req: Request) {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();

  // Use logger.info (not logger.debug - that's stripped in production!)

  logger.info(
    `🎯🎯🎯 [ORDERS API ${requestId}] NEW ORDER SUBMISSION at ${new Date().toISOString()} 🎯🎯🎯`
  );

  try {
    const body = (await req.json()) as Partial<OrderPayload>;

    logger.info("📥📥📥 REQUEST RECEIVED 📥📥📥", {
      customer: body.customer_name,
      venue: body.venue_id,
      table: body.table_number,
      items: body.items?.length,
      total: body.total_amount,
      requestId,
    });

    if (!body.venue_id || typeof body.venue_id !== "string") {
      return bad("venue_id is required");
    }

    if (!body.customer_name || !body.customer_name.trim()) {
      return bad("customer_name is required");
    }

    if (!body.customer_phone || !body.customer_phone.trim()) {
      return bad("customer_phone is required");
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return bad("items must be a non-empty array");
    }

    if (typeof body.total_amount !== "number" || isNaN(body.total_amount)) {
      return bad("total_amount must be a number");
    }

    logger.info("✅✅✅ ALL VALIDATIONS PASSED ✅✅✅", {
      customer: body.customer_name,
      venue: body.venue_id,
      items: body.items?.length,
      total: body.total_amount,
      requestId,
    });

    const tn = body.table_number;
    const table_number = tn === null || tn === undefined ? null : Number.isFinite(tn) ? tn : null;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return bad("Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY", 500);
    }
    // Use authenticated client (service role key removed for security)
    const supabase = await createSupabaseClient();
    // Note: If service role is truly needed here, add proper admin auth check
    // const supabase = createClient(
    //   process.env.NEXT_PUBLIC_SUPABASE_URL!,
    //   process.env.SUPABASE_SERVICE_ROLE_KEY!,
    //   {
    //     auth: {
    //       autoRefreshToken: false,
    //       persistSession: false,
    //     },
    //   }
    // );

    // Verify venue exists, create if it doesn't (for demo purposes)
    const { data: venue, error: venueErr } = await supabase
      .from("venues")
      .select("venue_id")
      .eq("venue_id", body.venue_id)
      .maybeSingle();

    if (venueErr) {
      return bad(`Failed to verify venue: ${venueErr.message}`, 500);
    }

    if (!venue) {
      // Create a default venue for demo purposes
      const { error: createErr } = await supabase
        .from("venues")
        .insert({
          venue_id: body.venue_id,
          name: "Demo Restaurant",
          business_type: "restaurant",
          owner_user_id: null, // No owner for demo venue
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("venue_id")
        .single();

      if (createErr) {
        return bad(`Failed to create demo venue: ${createErr.message}`, 500);
      }
    }

    // Auto-create table if it doesn't exist (for QR code scenarios)
    let tableId = null;
    if (body.table_number) {
      // Check if table exists - first try to find by table number directly
      const { data: existingTable, error: lookupError } = await supabase
        .from("tables")
        .select("id, label")
        .eq("venue_id", body.venue_id)
        .eq("label", body.table_number.toString())
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
            .eq("venue_id", body.venue_id)
            .eq("table_number", body.table_number)
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
            venue_id: body.venue_id,
            label: body.table_number.toString(),
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
              .eq("venue_id", body.venue_id)
              .eq("label", body.table_number.toString())
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
            .eq("venue_id", body.venue_id)
            .eq("table_id", tableId)
            .is("closed_at", null)
            .maybeSingle();

          if (!existingSession) {
            const { error: sessionErr } = await supabase.from("table_sessions").insert({
              venue_id: body.venue_id,
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
    const computedTotal = body.items.reduce((sum, it) => {
      const qty = Number(it.quantity) || 0;
      const price = Number(it.price) || 0;
      return sum + qty * price;
    }, 0);
    const finalTotal =
      Math.abs(computedTotal - (body.total_amount || 0)) < 0.01
        ? body.total_amount!
        : computedTotal;

    const safeItems = body.items.map((it) => ({
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
    const orderSource = body.source || "qr"; // Default to 'qr' if not provided

    const payload: OrderPayload = {
      venue_id: body.venue_id,
      table_number,
      table_id: tableId, // Add table_id to the payload
      customer_name: body.customer_name.trim(),
      customer_phone: body.customer_phone!.trim(), // Required field, already validated
      items: safeItems,
      total_amount: finalTotal,
      notes: body.notes ?? null,
      order_status: body.order_status || "IN_PREP", // Default to IN_PREP so it shows in Live Orders immediately
      payment_status: body.payment_status || "UNPAID", // Use provided status or default to 'UNPAID'
      payment_mode: body.payment_mode || "online", // New field for payment mode
      payment_method: body.payment_method || null,
      // NOTE: session_id is NOT a database column - don't include in payload
      source: orderSource, // Use source from client (based on QR code URL: ?table=X -> 'qr', ?counter=X -> 'counter')
    };

    // Check for duplicate orders (idempotency check)
    // Look for orders with same customer, table, venue, and recent timestamp (within 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: existingOrder, error: duplicateCheckError } = await supabase
      .from("orders")
      .select("id, created_at, order_status, payment_status")
      .eq("venue_id", payload.venue_id)
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
          venue_id: body.venue_id,
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
        .eq("venue_id", payload.venue_id)
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
  } catch (e: unknown) {
    const error = e as Error;
    const duration = Date.now() - startTime;

    logger.error("❌❌❌ ORDER CREATION FAILED ❌❌❌", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : "No stack",
      duration: `${duration}ms`,
      requestId,
    });

    const msg =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Unknown server error";
    return bad(`Server error: ${msg}`, 500);
  }
}
