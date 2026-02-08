/**
 * Staff Service
 * Handles all staff management, roles, and shifts business logic
 */

import { BaseService } from "./BaseService";
import { createSupabaseClient, createClient } from "@/lib/supabase";

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
   * Get all staff for a venue.
   * Queries both normalized (venue-xxx) and raw (xxx) venue_id so list stays in sync
   * with DB regardless of how venue_id was stored (legacy or different code path).
   */
  async getStaff(venueId: string): Promise<StaffMember[]> {
    const cacheKey = this.getCacheKey("staff:list", venueId);
    const rawVenueId = venueId.startsWith("venue-") ? venueId.slice(6) : venueId;

    return this.withCache(
      cacheKey,
      async () => {
        const supabase = await createSupabaseClient();
        const { data: byNormalized, error: errNorm } = await supabase
          .from("staff")
          .select("*")
          .eq("venue_id", venueId)
          .neq("role", "owner");
        if (errNorm) throw errNorm;

        let byRaw: unknown[] = [];
        if (rawVenueId !== venueId) {
          const res = await supabase
            .from("staff")
            .select("*")
            .eq("venue_id", rawVenueId)
            .neq("role", "owner");
          if (res.error) throw res.error;
          byRaw = res.data ?? [];
        }

        const seen = new Set<string>();
        const rows: Array<Record<string, unknown>> = [];
        for (const row of (byNormalized ?? []).concat(byRaw)) {
          const r = row as Record<string, unknown>;
          const id = r.id as string;
          if (id && !seen.has(id)) {
            seen.add(id);
            rows.push(r);
          }
        }

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
    const supabase = await createClient();
    const { error } = await supabase
      .from("staff")
      .update({ active })
      .eq("id", staffId)
      .eq("venue_id", venueId)

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
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("staff_invitations")
      .insert({
        venue_id: venueId,
        email: email.toLowerCase().trim(),
        role,
        invited_by: invitedBy,
        status: "pending",
        token: crypto.randomUUID(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      })
      .select()
      .single();

    if (error) throw error;
    return data as Record<string, unknown>;
  }

  /**
   * Add staff member (uses admin client to satisfy RLS; caller must enforce venue access)
   */
  async addStaff(venueId: string, data: { name: string; role?: string }): Promise<StaffMember> {
    const supabase = await createClient();
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

  /** Invalidate staff list cache (e.g. after delete). Call from API routes. */
  async invalidateStaffListCache(): Promise<void> {
    await this.invalidateCachePattern("staff:*");
  }
}

export const staffService = new StaffService();
