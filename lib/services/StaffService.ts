/**
 * Staff Service
 * Handles all staff management, roles, and shifts business logic
 */

import { BaseService } from "./BaseService";
import { createSupabaseClient } from "@/lib/supabase";

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
          .from("v_staff_members")
          .select("*")
          .eq("venue_id", venueId);

        if (error) {
          // Fallback to manual join if view doesn't exist
          const { data: fallback, error: fallbackError } = await supabase
            .from("staff")
            .select("*, profiles!inner(email, full_name)")
            .eq("venue_id", venueId);
          
          if (fallbackError) throw fallbackError;
          return fallback || [];
        }
        return data || [];
      },
      300
    );
  }

  /**
   * Toggle staff active status
   */
  async toggleStaffStatus(staffId: string, venueId: string, active: boolean): Promise<void> {
    const supabase = await createSupabaseClient();
    const { error } = await supabase
      .from("staff")
      .update({ active })
      .eq("id", staffId)
      .eq("venue_id", venueId);

    if (error) throw error;
    await this.invalidateCachePattern(`staff:*:${venueId}:*`);
  }

  /**
   * Create staff invitation
   */
  async inviteStaff(
    venueId: string,
    email: string,
    role: string,
    invitedBy: string
  ): Promise<Record<string, unknown>> {
    const supabase = await createSupabaseClient();
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
   * Add staff member
   */
  async addStaff(
    venueId: string,
    data: { name: string; role?: string }
  ): Promise<StaffMember> {
    const supabase = await createSupabaseClient();
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
