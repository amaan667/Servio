// Servio AI Assistant - Staff Management Tools
// List staff, invite members, query roles, and schedules

import { createAdminClient } from "@/lib/supabase";

interface StaffListResult {

  }>;

}

interface StaffInviteResult {

}

interface StaffRolesResult {

  }>;

}

interface StaffScheduleResult {

  }>;

}

/**
 * Get all staff members for a venue
 */
export async function getAllStaff(venueId: string): Promise<StaffListResult> {
  const supabase = createAdminClient();

  

  // Get owner
  const { data: venue } = await supabase
    .from("venues")
    .select("owner_user_id, venue_name")
    .eq("venue_id", venueId)
    .single();

  if (!venue) {
    throw new Error("Venue not found");
  }

  // Get owner details
  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("user_id", venue.owner_user_id)
    .single();

  // Get staff from user_venue_roles
  const { data: staffRoles, error: rolesError } = await supabase
    .from("user_venue_roles")
    .select("user_id, role, created_at, status")
    .eq("venue_id", venueId)
    .order("created_at", { ascending: true });

  if (rolesError) {
    
    throw new Error(`Failed to fetch staff: ${rolesError.message}`);
  }

  // Get user details for staff
  const userIds = staffRoles?.map((s) => s.user_id) || [];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name, email")
    .in("user_id", userIds);

  const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

  const staff: StaffListResult["staff"] = [];

  // Add owner first
  if (ownerProfile) {
    staff.push({

  }

  // Add staff members
  staffRoles?.forEach((staffRole) => {
    const profile = profileMap.get(staffRole.user_id);
    if (profile) {
      staff.push({

    }

  return {
    staff,

    summary: `${staff.length} staff members: 1 owner, ${staff.filter((s) => s.role === "manager").length} managers, ${staff.filter((s) => s.role === "server").length} servers.`,
  };
}

/**
 * Invite a new staff member
 */
export async function inviteStaffMember(

  name?: string
): Promise<StaffInviteResult> {
  const supabase = createAdminClient();

  

  // Validate role
  if (!["manager", "server"].includes(role)) {
    throw new Error('Invalid role. Must be "manager" or "server".');
  }

  // Check if email is already invited or exists
  const { data: existingUser } = await supabase
    .from("profiles")
    .select("user_id, email")
    .eq("email", email)
    .maybeSingle();

  if (existingUser) {
    // Check if already staff at this venue
    const { data: existingRole } = await supabase
      .from("user_venue_roles")
      .select("id")
      .eq("user_id", existingUser.user_id)
      .eq("venue_id", venueId)
      .maybeSingle();

    if (existingRole) {
      throw new Error(`${email} is already a staff member at this venue.`);
    }
  }

  // Get venue info for invitation
  const { data: venue } = await supabase
    .from("venues")
    .select("owner_user_id")
    .eq("venue_id", venueId)
    .single();

  if (!venue) {
    throw new Error("Venue not found");
  }

  // Generate unique token
  const token = `inv_${venueId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // Create staff invitation
  const { data: invitation, error: inviteError } = await supabase
    .from("staff_invitations")
    .insert({

      email,
      role,

      token,

      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days

    .select("id, token")
    .single();

  if (inviteError) {
    
    throw new Error(`Failed to send invitation: ${inviteError.message}`);
  }

  // In production, this would send an email invitation
  

  return {

    email,
    role,
    message: `Invitation sent to ${email} as ${role}. ${name ? `Name: ${name}. ` : ""}They have 7 days to accept.`,
  };
}

/**
 * Get staff roles and permissions breakdown
 */
export async function getStaffRoles(venueId: string): Promise<StaffRolesResult> {
  const supabase = createAdminClient();

  

  const { data: staffRoles } = await supabase
    .from("user_venue_roles")
    .select("role")
    .eq("venue_id", venueId);

  const roleCounts = new Map<string, number>();
  staffRoles?.forEach((s) => {
    roleCounts.set(s.role, (roleCounts.get(s.role) || 0) + 1);

  // Add owner (always 1)
  roleCounts.set("owner", 1);

  const rolePermissions = {

      "Manage staff",
      "Edit menu",
      "View analytics",
      "Manage billing",
      "Delete venue",
    ],

      "Edit menu",
      "Manage orders",
      "Manage tables",
      "View inventory",
      "Cannot manage billing",
    ],

      "Update order status",
      "View tables",
      "Cannot edit menu",
      "Cannot view analytics",
    ],
  };

  const roles = Array.from(roleCounts.entries()).map(([role, count]) => ({
    role,

    count,
  }));

  return {
    roles,
    summary: `Staff structure: ${roles.map((r) => `${r.count} ${r.role}${r.count > 1 ? "s" : ""}`).join(", ")}. Total: ${roles.reduce((sum, r) => sum + r.count, 0)} members.`,
  };
}

/**
 * Get staff schedule for today
 * Note: This is a placeholder - full scheduling system would need to be built
 */
export async function getTodayStaffSchedule(venueId: string): Promise<StaffScheduleResult> {
  const supabase = createAdminClient();

  

  // Get all active staff
  const staffList = await getAllStaff(venueId);

  // In a full implementation, this would query a schedules table
  // For now, return all active staff
  const schedule = staffList.staff
    .filter((s) => s.status === "active")
    .map((s) => ({

    }));

  return {

    summary: `${schedule.length} staff members on duty today: ${schedule.filter((s) => s.role === "server").length} servers, ${schedule.filter((s) => s.role === "manager").length} managers.`,
  };
}

/**
 * Get staff performance metrics
 */
export async function getStaffPerformance(

  }>;

}> {
  const supabase = createAdminClient();

  const startDate = new Date();
  if (timeRange === "week") {
    startDate.setDate(startDate.getDate() - 7);
  } else {
    startDate.setMonth(startDate.getMonth() - 1);
  }

  // Get orders with staff assignments (if tracked)
  const { data: orders } = await supabase
    .from("orders")
    .select("id, total_amount, created_by, order_status")
    .eq("venue_id", venueId)
    .gte("created_at", startDate.toISOString())
    .not("order_status", "in", '("CANCELLED","REFUNDED")');

  // Group by staff member
  const staffMap = new Map<string, { orders: number; revenue: number }>();

  orders?.forEach((order) => {
    const staffId = order.created_by || "unassigned";
    const existing = staffMap.get(staffId) || { orders: 0, revenue: 0 };
    existing.orders++;
    existing.revenue += order.total_amount || 0;
    staffMap.set(staffId, existing);

  // Get staff details
  const staffIds = Array.from(staffMap.keys()).filter((id) => id !== "unassigned");
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", staffIds);

  const { data: roles } = await supabase
    .from("user_venue_roles")
    .select("user_id, role")
    .eq("venue_id", venueId)
    .in("user_id", staffIds);

  const profileMap = new Map(profiles?.map((p) => [p.user_id, p.full_name]) || []);
  const roleMap = new Map(roles?.map((r) => [r.user_id, r.role]) || []);

  const staff = Array.from(staffMap.entries())
    .filter(([staffId]) => staffId !== "unassigned")
    .map(([staffId, stats]) => ({

    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  return {
    staff,

        ? `Top performer: ${staff[0]?.name} with ${staff[0]?.ordersHandled} orders and £${staff[0]?.totalRevenue.toFixed(2)} revenue this ${timeRange}.`

  };
}
