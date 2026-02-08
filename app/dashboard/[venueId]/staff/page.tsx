import StaffClientPage from "./page.client";
import { createAdminClient } from "@/lib/supabase";
import { requirePageAuth } from "@/lib/auth/page-auth-helper";
import { logger } from "@/lib/monitoring/structured-logger";
import type { StaffRow } from "./hooks/useStaffManagement";

interface StaffStats {
  total_staff: number;
  owners: number;
  managers: number;
  staff_count: number;
  active_staff: number;
}

/**
 * Fetch staff members and statistics for a venue
 */
async function fetchStaffData(venueId: string): Promise<{ staff: StaffRow[]; stats: StaffStats } | null> {
  try {
    const supabase = createAdminClient();

    // Fetch all staff for this venue from the staff table
    const { data: staffData, error } = await supabase
      .from("staff")
      .select("id, venue_id, user_id, role, name, email, active, created_at")
      .eq("venue_id", venueId);

    if (error) {
      logger.error("Failed to fetch staff data", { venueId, error: error.message });
      return null;
    }

    // Transform to StaffRow format
    const staff: StaffRow[] = (staffData || []).map((s) => ({
      id: s.id,
      name: s.name || s.email || s.user_id,
      role: s.role || "staff",
      active: s.active !== false,
      created_at: s.created_at,
    }));

    // Calculate statistics
    const stats: StaffStats = {
      total_staff: staff.length,
      owners: staff.filter((s) => s.role === "owner").length,
      managers: staff.filter((s) => s.role === "manager").length,
      staff_count: staff.filter((s) => s.role === "staff" || s.role === "server" || s.role === "kitchen").length,
      active_staff: staff.filter((s) => s.active !== false).length,
    };

    return { staff, stats };
  } catch (error) {
    logger.error("Error fetching staff data", { venueId, error: error instanceof Error ? error.message : "Unknown error" });
    return null;
  }
}

export default async function StaffPage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;

  // Server-side auth check - staff management requires owner or manager
  const auth = await requirePageAuth(venueId, {
    requireRole: ["owner", "manager"],
  }).catch(() => null);

  // Fetch initial staff data on server
  let initialStaff: StaffRow[] | undefined;
  let initialStats: StaffStats | undefined;

  try {
    const staffData = await fetchStaffData(venueId);
    if (staffData) {
      initialStaff = staffData.staff;
      initialStats = staffData.stats;
    }
  } catch (error) {
    logger.error("Failed to load initial staff data", { venueId, error });
  }

  return (
    <StaffClientPage
      venueId={venueId}
      tier={auth?.tier ?? "starter"}
      role={auth?.role ?? "viewer"}
      initialStaff={initialStaff}
      initialStats={initialStats}
    />
  );
}
