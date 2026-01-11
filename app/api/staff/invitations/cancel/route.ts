import { NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { z } from "zod";
import { validateBody } from "@/lib/api/validation-schemas";

export const runtime = "nodejs";

const cancelInvitationSchema = z.object({

// POST /api/staff/invitations/cancel - Cancel an invitation
export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Validate input
      const body = await validateBody(cancelInvitationSchema, await req.json());
      const venue_id = context.venueId || body.venue_id || body.venueId;

      if (!venue_id) {
        return apiErrors.badRequest("Venue ID is required");
      }

      // STEP 3: Business logic
      const user = context.user;
      const supabase = await createServerSupabase();

      // Verify venue access (must be owner or admin)
      const { data: venueAccess } = await supabase
        .from("venues")
        .select("venue_id")
        .eq("venue_id", venue_id)
        .eq("owner_user_id", user.id)
        .maybeSingle();

      const { data: staffAccess } = await supabase
        .from("user_venue_roles")
        .select("role")
        .eq("venue_id", venue_id)
        .eq("user_id", user.id)
        .in("role", ["owner", "admin"])
        .maybeSingle();

      if (!venueAccess && !staffAccess) {
        
        return apiErrors.forbidden("Insufficient permissions");
      }

      // Check if staff_invitations table exists
      try {
        await supabase.from("staff_invitations").select("id").limit(1);
      } catch (tableError: unknown) {
        const errorMessage = tableError instanceof Error ? tableError.message : "Unknown error";
        const errorCode =
          tableError && typeof tableError === "object" && "code" in tableError
            ? String(tableError.code)

        } else {
          
          return apiErrors.database("Database error. Please try again.");
        }
      }

      // Get invitation details - verify it belongs to the venue
      const { data: invitation, error: fetchInvitationError } = await supabase
        .from("staff_invitations")
        .select("venue_id, status")
        .eq("id", body.id)
        .eq("venue_id", venue_id)
        .single();

      if (fetchInvitationError) {
        
        return apiErrors.notFound("Invitation not found");
      }

      // Check if invitation can be cancelled
      if (invitation.status !== "pending") {
        return apiErrors.badRequest("Only pending invitations can be cancelled");
      }

      // Cancel invitation
      const { error: updateError } = await supabase
        .from("staff_invitations")
        .update({

        .eq("id", body.id);

      if (updateError) {
        
        return apiErrors.database(
          "Failed to cancel invitation",
          isDevelopment() ? updateError.message : undefined
        );
      }

      

      // STEP 4: Return success response
      return success({

    } catch (error) {

      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
    }
  },
  {
    // Extract venueId from body

        const body = await req.json().catch(() => ({}));
        return (
          (body as { venue_id?: string; venueId?: string })?.venue_id ||
          (body as { venue_id?: string; venueId?: string })?.venueId ||
          null
        );
      } catch {
        return null;
      }
    },
  }
);
