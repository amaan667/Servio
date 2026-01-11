import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";

export const runtime = "nodejs";

// POST /api/tables/cleanup-duplicates - Remove duplicate tables
export const POST = withUnifiedAuth(async (req: NextRequest, context) => {
  try {
    // STEP 1: Rate limiting (ALWAYS FIRST)
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
    }

    // STEP 2: Get venueId from context
    const venueId = context.venueId;

    if (!venueId) {
      return apiErrors.badRequest("venue_id is required");
    }

    // STEP 3: Business logic - Fetch and cleanup duplicate tables
    const supabase = createAdminClient();

    const { data: tables, error: fetchError } = await supabase
      .from("tables")
      .select("*")
      .eq("venue_id", venueId)
      .eq("is_active", true);

    if (fetchError) {
      
      return apiErrors.database(
        "Failed to fetch tables",
        isDevelopment() ? fetchError.message : undefined
      );
    }

    if (!tables || tables.length === 0) {
      return success({ message: "No tables found", duplicates_removed: 0 });
    }

    // Group tables by label to find duplicates
    const tablesByLabel = new Map<
      string,
      Array<{ id: string; created_at?: string; label: string }>
    >();
    tables.forEach((table: { label: string; id: string; created_at?: string }) => {
      if (!tablesByLabel.has(table.label)) {
        tablesByLabel.set(table.label, []);
      }
      tablesByLabel.get(table.label)!.push(table);

    // Find duplicates (keep the oldest one, remove the rest)
    const duplicatesToRemove: string[] = [];
    tablesByLabel.forEach((tablesWithSameLabel, _label) => {
      if (tablesWithSameLabel.length > 1) {
        // Sort by created_at, keep the oldest
        const sorted = tablesWithSameLabel.sort((a, b) => {
          const aCreated = a.created_at;
          const bCreated = b.created_at;
          return new Date(aCreated || 0).getTime() - new Date(bCreated || 0).getTime();

        // Mark all but the first (oldest) for removal
        for (let i = 1; i < sorted.length; i++) {
          duplicatesToRemove.push(sorted[i].id);
        }
      }

    if (duplicatesToRemove.length === 0) {
      return success({ message: "No duplicates found", duplicates_removed: 0 });
    }

    // Check for active orders and reservations before removing duplicates
    const { data: activeOrders, error: ordersError } = await supabase
      .from("orders")
      .select("table_id")
      .in("table_id", duplicatesToRemove)
      .eq("venue_id", venueId)
      .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"]);

    if (ordersError) {
      
      return apiErrors.database(
        "Failed to check for active orders",
        isDevelopment() ? ordersError.message : undefined
      );
    }

    const { data: activeReservations, error: reservationsError } = await supabase
      .from("reservations")
      .select("table_id")
      .in("table_id", duplicatesToRemove)
      .eq("venue_id", venueId)
      .eq("status", "BOOKED");

    if (reservationsError) {
      
      return apiErrors.database(
        "Failed to check for active reservations",
        isDevelopment() ? reservationsError.message : undefined
      );
    }

    // Filter out tables that have active orders or reservations
    const tablesWithActiveOrders = new Set(
      activeOrders?.map((o: { table_id: string }) => o.table_id) || []
    );
    const tablesWithActiveReservations = new Set(
      activeReservations?.map((r: { table_id: string }) => r.table_id) || []
    );

    const safeToRemove = duplicatesToRemove.filter(
      (tableId) =>
        !tablesWithActiveOrders.has(tableId) && !tablesWithActiveReservations.has(tableId)
    );

    if (safeToRemove.length === 0) {
      return success({

    }

    // Remove duplicate tables that are safe to remove
    const { error: deleteError } = await supabase.from("tables").delete().in("id", safeToRemove);

    if (deleteError) {
      
      return apiErrors.database(
        "Failed to remove duplicate tables",
        isDevelopment() ? deleteError.message : undefined
      );
    }

    

    return success({
      message: `Successfully removed ${safeToRemove.length} duplicate tables`,

  } catch (error) {

    if (isZodError(error)) {
      return handleZodError(error);
    }

    return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
  }
