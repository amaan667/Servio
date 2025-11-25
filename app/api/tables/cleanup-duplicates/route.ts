import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';

export const runtime = "nodejs";

// POST /api/tables/cleanup-duplicates - Remove duplicate tables
export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // CRITICAL: Rate limiting
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return NextResponse.json(
          {
            error: 'Too many requests',
            message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
          },
          { status: 429 }
        );
      }

      const body = await req.json();
      const venue_id = context.venueId || body.venue_id;

      if (!venue_id) {
        return NextResponse.json({ ok: false, error: "venue_id is required" }, { status: 400 });
      }

    // Use admin client - no auth needed
    const { createAdminClient } = await import("@/lib/supabase");
    const supabase = createAdminClient();

    // Get all tables for this venue
    const { data: tables, error: tablesError } = await supabase
      .from("tables")
      .select("id, label, created_at")
      .eq("venue_id", venue_id)
      .eq("is_active", true)
      .order("label");

    if (tablesError) {
      logger.error("[CLEANUP DUPLICATES] Tables error:", tablesError);
      return NextResponse.json({ ok: false, error: tablesError.message }, { status: 500 });
    }

    if (!tables || tables.length === 0) {
      return NextResponse.json({ ok: true, message: "No tables found", duplicates_removed: 0 });
    }

    // Group tables by label to find duplicates
    const tablesByLabel = new Map<string, unknown[]>();
    tables.forEach((table: { label: string }) => {
      if (!tablesByLabel.has(table.label)) {
        tablesByLabel.set(table.label, []);
      }
      tablesByLabel.get(table.label)!.push(table);
    });

    // Find duplicates (keep the oldest one, remove the rest)
    const duplicatesToRemove: string[] = [];
    tablesByLabel.forEach((tablesWithSameLabel, _label) => {
      if (tablesWithSameLabel.length > 1) {
        // Sort by created_at, keep the oldest
        const sorted = tablesWithSameLabel.sort((a, b) => {
          const aCreated = (a as { id: string; created_at?: string }).created_at;
          const bCreated = (b as { id: string; created_at?: string }).created_at;
          return new Date(aCreated || 0).getTime() - new Date(bCreated || 0).getTime();
        });

        // Mark all but the first (oldest) for removal
        for (let i = 1; i < sorted.length; i++) {
          const table = sorted[i] as { id: string };
          duplicatesToRemove.push(table.id);
        }
      }
    });

    if (duplicatesToRemove.length === 0) {
      return NextResponse.json({ ok: true, message: "No duplicates found", duplicates_removed: 0 });
    }

    // Check for active orders and reservations before removing duplicates
    const { data: activeOrders, error: ordersError } = await supabase
      .from("orders")
      .select("table_id")
      .in("table_id", duplicatesToRemove)
      .eq("venue_id", venue_id)
      .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"]);

    if (ordersError) {
      logger.error("[CLEANUP DUPLICATES] Error checking active orders:", ordersError);
      return NextResponse.json(
        { ok: false, error: "Failed to check for active orders" },
        { status: 500 }
      );
    }

    const { data: activeReservations, error: reservationsError } = await supabase
      .from("reservations")
      .select("table_id")
      .in("table_id", duplicatesToRemove)
      .eq("venue_id", venue_id)
      .eq("status", "BOOKED");

    if (reservationsError) {
      logger.error("[CLEANUP DUPLICATES] Error checking active reservations:", reservationsError);
      return NextResponse.json(
        { ok: false, error: "Failed to check for active reservations" },
        { status: 500 }
      );
    }

    // Filter out tables that have active orders or reservations
    const tablesWithActiveOrders = new Set(activeOrders?.map((o: { table_id: string }) => o.table_id) || []);
    const tablesWithActiveReservations = new Set(activeReservations?.map((r: { table_id: string }) => r.table_id) || []);

    const safeToRemove = duplicatesToRemove.filter(
      (tableId) =>
        !tablesWithActiveOrders.has(tableId) && !tablesWithActiveReservations.has(tableId)
    );

    if (safeToRemove.length === 0) {
      return NextResponse.json({
        ok: true,
        message:
          "No duplicate tables can be safely removed (all have active orders or reservations)",
        duplicates_removed: 0,
      });
    }

    if (safeToRemove.length < duplicatesToRemove.length) {
      // Empty block
    }

    // Remove duplicate tables that are safe to remove
    const { error: deleteError } = await supabase.from("tables").delete().in("id", safeToRemove);

    if (deleteError) {
      logger.error("[CLEANUP DUPLICATES] Delete error:", deleteError);
      return NextResponse.json({ ok: false, error: deleteError.message }, { status: 500 });
    }

      return NextResponse.json({
        ok: true,
        message: `Successfully removed ${safeToRemove.length} duplicate tables`,
        duplicates_removed: safeToRemove.length,
      });
    } catch (_error) {
      logger.error("[CLEANUP DUPLICATES] Unexpected error:", {
        error: _error instanceof Error ? _error.message : "Unknown _error",
      });
      return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
    }
  }
);
