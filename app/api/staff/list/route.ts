import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { staffService } from "@/lib/services/StaffService";

export const runtime = "nodejs";

/**
 * GET: Fetch all staff members for a venue
 */
export const GET = createUnifiedHandler(
  async (_req, context) => {
    const rawVenueId = context.venueId;
    const normalizedVenueId = rawVenueId.startsWith("venue-") ? rawVenueId : `venue-${rawVenueId}`;
    
    const staff = await staffService.getStaff(normalizedVenueId);
    return { staff };
  },
  {
    requireVenueAccess: true,
    venueIdSource: "query",
  }
);
