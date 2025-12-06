import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';
import { success, apiErrors } from '@/lib/api/standard-response';

export const runtime = "nodejs";

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    console.log("=".repeat(80));
    console.log("[STAFF ADD API] Request received");
    console.log("[STAFF ADD API] Context venueId:", context.venueId);
    console.log("[STAFF ADD API] Request URL:", req.url);
    
    try {
      // CRITICAL: Rate limiting
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        console.log("[STAFF ADD API] Rate limit exceeded");
        return apiErrors.rateLimit(
          Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
        );
      }

      const body = await req.json().catch(() => ({}));
      console.log("[STAFF ADD API] Request body:", JSON.stringify(body, null, 2));
      const { name, role } = body || {};

      if (!name) {
        console.log("[STAFF ADD API] VALIDATION FAILED - name is required");
        return apiErrors.badRequest('name is required');
      }

      // Normalize venueId - database stores with venue- prefix
      const normalizedVenueId = context.venueId.startsWith("venue-") 
        ? context.venueId 
        : `venue-${context.venueId}`;
      console.log("[STAFF ADD API] Normalized venueId:", normalizedVenueId);

      const insertData = { venue_id: normalizedVenueId, name, role: role || "Server", active: true };
      console.log("[STAFF ADD API] Insert data:", JSON.stringify(insertData, null, 2));

      const admin = createAdminClient();
      const queryStart = Date.now();
      const { data, error } = await admin
        .from("staff")
        .insert([insertData])
        .select("*");
      const queryTime = Date.now() - queryStart;
      
      console.log("[STAFF ADD API] Database query completed in", queryTime, "ms");
      console.log("[STAFF ADD API] Query error:", error ? JSON.stringify(error, null, 2) : "none");
      console.log("[STAFF ADD API] Query returned data:", data ? `${data.length} rows` : "null");
      
      if (error) {
        console.error("[STAFF ADD API] ERROR - Database insert failed:");
        console.error("[STAFF ADD API] Error code:", error.code);
        console.error("[STAFF ADD API] Error message:", error.message);
        console.error("[STAFF ADD API] Error details:", error.details);
        console.error("[STAFF ADD API] Error hint:", error.hint);
        console.error("[STAFF ADD API] Full error:", JSON.stringify(error, null, 2));
        return apiErrors.badRequest(error.message || "Failed to add staff member");
      }
      
      if (!data || data.length === 0) {
        console.error("[STAFF ADD API] ERROR - No data returned from insert");
        return apiErrors.internal("Failed to create staff member - no data returned");
      }
      
      console.log("[STAFF ADD API] SUCCESS - Staff member created");
      console.log("[STAFF ADD API] Created staff data:", JSON.stringify(data[0], null, 2));
      console.log("[STAFF ADD API] Returning success response");
      console.log("=".repeat(80));
      return success(data[0]);
    } catch (e) {
      console.error("[STAFF ADD API] EXCEPTION - Unexpected error:");
      console.error("[STAFF ADD API] Exception type:", e instanceof Error ? e.constructor.name : typeof e);
      console.error("[STAFF ADD API] Exception message:", e instanceof Error ? e.message : String(e));
      console.error("[STAFF ADD API] Exception stack:", e instanceof Error ? e.stack : "no stack");
      console.log("=".repeat(80));
      return apiErrors.internal(
        e instanceof Error ? e.message : "Unknown error"
      );
    }
  }
);
