import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';
import { success, apiErrors } from '@/lib/api/standard-response';

export const runtime = 'nodejs';

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    console.log("=".repeat(80));
    console.log("[STAFF DELETE API] Request received");
    console.log("[STAFF DELETE API] Context venueId:", context.venueId);
    console.log("[STAFF DELETE API] Request URL:", req.url);
    
    try {
      // CRITICAL: Rate limiting
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        console.log("[STAFF DELETE API] Rate limit exceeded");
        return apiErrors.rateLimit(
          Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
        );
      }

      const body = await req.json().catch(() => ({}));
      console.log("[STAFF DELETE API] Request body:", JSON.stringify(body, null, 2));
      const { id } = body;

      if (!id) {
        console.log("[STAFF DELETE API] VALIDATION FAILED - id is required");
        return apiErrors.badRequest('id required');
      }

      // Normalize venueId - database stores with venue- prefix
      const normalizedVenueId = context.venueId.startsWith("venue-") 
        ? context.venueId 
        : `venue-${context.venueId}`;
      console.log("[STAFF DELETE API] Normalized venueId:", normalizedVenueId);
      console.log("[STAFF DELETE API] Staff ID to delete:", id);

      const admin = createAdminClient();

      // Use soft deletion instead of hard deletion for forever count
      const deleteStart = Date.now();
      const { data, error } = await admin
        .from('staff')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('venue_id', normalizedVenueId)
        .select(); // Select to verify deletion
      const deleteTime = Date.now() - deleteStart;
      
      console.log("[STAFF DELETE API] Delete query completed in", deleteTime, "ms");
      console.log("[STAFF DELETE API] Query error:", error ? JSON.stringify(error, null, 2) : "none");
      console.log("[STAFF DELETE API] Rows affected:", data ? data.length : 0);
        
      if (error) {
        console.error("[STAFF DELETE API] ERROR - Database update failed:");
        console.error("[STAFF DELETE API] Error code:", error.code);
        console.error("[STAFF DELETE API] Error message:", error.message);
        console.error("[STAFF DELETE API] Error details:", error.details);
        console.log("=".repeat(80));
        return apiErrors.badRequest(error.message);
      }
      
      if (!data || data.length === 0) {
        console.error("[STAFF DELETE API] ERROR - No rows updated (staff member not found or already deleted)");
        console.log("=".repeat(80));
        return apiErrors.badRequest("Staff member not found or already deleted");
      }
      
      console.log("[STAFF DELETE API] SUCCESS - Staff member soft-deleted");
      console.log("[STAFF DELETE API] Deleted staff data:", JSON.stringify(data[0], null, 2));
      console.log("[STAFF DELETE API] Returning success response");
      console.log("=".repeat(80));
      return success({ success: true });
    } catch (e) {
      console.error("[STAFF DELETE API] EXCEPTION - Unexpected error:");
      console.error("[STAFF DELETE API] Exception type:", e instanceof Error ? e.constructor.name : typeof e);
      console.error("[STAFF DELETE API] Exception message:", e instanceof Error ? e.message : String(e));
      console.error("[STAFF DELETE API] Exception stack:", e instanceof Error ? e.stack : "no stack");
      console.log("=".repeat(80));
      return apiErrors.internal(
        e instanceof Error ? e.message : "Unknown error"
      );
    }
  }
);
