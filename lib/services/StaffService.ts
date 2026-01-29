/**
 * Staff Service
 * Handles all staff management, roles, and shifts business logic
 */

import { BaseService } from "./BaseService";
import { createSupabaseClient, createAdminClient } from "@/lib/supabase";

export interface StaffMember {
  id: string;
  venue_id: string;
  user_id: string;
  role: string;
  name?: string | null;
  email: string;
  active: boolean;
  created_at: string;
}

export interface StaffShift {
  id: string;
  venue_id: string;
  staff_id: string;
  start_time: string;
  end_time?: string | null;
  status: string;
}

export class StaffService extends BaseService {
  /**
   * Get all staff for a venue
   */
  async getStaff(venueId: string): Promise<StaffMember[]> {
    const cacheKey = this.getCacheKey("staff:list", venueId);

    return this.withCache(
      cacheKey,
      async () => {
        const supabase = await createSupabaseClient();
        const { data, error } = await supabase
          .from("staff")
          .select("*")
          .eq("venue_id", venueId);

        if (error) throw error;
        const rows = (data || []) as Array<Record<string, unknown>>;
        return rows.map((row) => ({
          id: row.id,
          venue_id: row.venue_id,
          user_id: row.user_id ?? "",
          role: row.role ?? "Server",
          name: row.name ?? null,
          email: (row.email as string) ?? "",
          active: row.active !== false,
          created_at: row.created_at ?? new Date().toISOString(),
        })) as StaffMember[];
      },
      300
    );
  }

  /**
   * Toggle staff active status (uses admin client to satisfy RLS; caller must enforce venue access)
   */
  async toggleStaffStatus(staffId: string, venueId: string, active: boolean): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("staff")
      .update({ active })
      .eq("id", staffId)
      .eq("venue_id", venueId);

    if (error) throw error;
    await this.invalidateCachePattern(`staff:*:${venueId}:*`);
  }

  /**
   * Create staff invitation (uses admin client to satisfy RLS; caller must enforce venue access)
   */
  async inviteStaff(
    venueId: string,
    email: string,
    role: string,
    invitedBy: string
  ): Promise<Record<string, unknown>> {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("staff_invitations").insert({
      venue_id: venueId,
      email: email.toLowerCase().trim(),
      role,
      invited_by: invitedBy,
      status: "pending",
      token: crypto.randomUUID(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    }).select().single();

    if (error) throw error;
    return data as Record<string, unknown>;
  }

  /**
   * Add staff member (uses admin client to satisfy RLS; caller must enforce venue access)
   */
  async addStaff(
    venueId: string,
    data: { name: string; role?: string }
  ): Promise<StaffMember> {
    const supabase = createAdminClient();
    const { data: staff, error } = await supabase
      .from("staff")
      .insert({
        venue_id: venueId,
        name: data.name,
        role: data.role || "Server",
        active: true,
      })
      .select()
      .single();

    if (error) throw error;
    await this.invalidateCachePattern(`staff:*:${venueId}:*`);
    return staff as StaffMember;
  }
}

export const staffService = new StaffService();
