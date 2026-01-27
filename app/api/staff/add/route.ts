import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { staffService } from "@/lib/services/StaffService";
import { enforceResourceLimit } from "@/lib/enforce-tier-limits";
import { z } from "zod";
import { NextResponse } from "next/server";
import { ApiResponse } from "@/lib/api/standard-response";

export const runtime = "nodejs";

const addStaffSchema = z.object({
  name: z.string().min(1).max(100),
  role: z.string().optional(),
});

/**
 * POST: Add staff member to a venue
 */
export const POST = createUnifiedHandler(
  async (req, context) => {
    const { body, venueId, venue } = context;
    const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;

    // 1. Check Tier Limits
    const currentStaff = await staffService.getStaff(normalizedVenueId);
    const limitCheck = await enforceResourceLimit(
      venue.owner_user_id,
      normalizedVenueId,
      "maxStaff",
      currentStaff.length,
      req.headers
    );

    if (!limitCheck.allowed) {
      return limitCheck.response as unknown as NextResponse<ApiResponse<unknown>>;
    }

    // 2. Add Staff
    const staff = await staffService.addStaff(normalizedVenueId, body);
    return staff;
  },
  {
    requireVenueAccess: true,
    schema: addStaffSchema,
    requireRole: ["owner", "manager"],
  }
);
