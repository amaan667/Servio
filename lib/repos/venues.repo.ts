/**
 * _Venues Repository
 * Centralized data access for venues
 */

import { createServerSupabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type VenueInsert = Database["public"]["Tables"]["venues"]["Insert"];
type VenueUpdate = Database["public"]["Tables"]["venues"]["Update"] & {
  settings?: Record<string, unknown> | null;
};

export class VenuesRepo {
  /**
   * Get venue by ID
   */
  static async findById(venueId: string) {
    const supabase = await createServerSupabase();
    return supabase.from("venues").select("*").eq("venue_id", venueId).single();
  }

  /**
   * Get venues by owner
   */
  static async listByOwner(ownerId: string) {
    const supabase = await createServerSupabase();
    return supabase
      .from("venues")
      .select("*")
      .eq("owner_user_id", ownerId)
      .order("created_at", { ascending: true });
  }

  /**
   * Create venue
   */
  static async create(venue: VenueInsert) {
    const supabase = await createServerSupabase();
    return supabase.from("venues").insert(venue).select().single();
  }

  /**
   * Update venue
   */
  static async update(venueId: string, updates: VenueUpdate) {
    const supabase = await createServerSupabase();
    return supabase.from("venues").update(updates).eq("venue_id", venueId).select().single();
  }

  /**
   * Delete venue
   */
  static async delete(venueId: string) {
    const supabase = await createServerSupabase();
    return supabase.from("venues").delete().eq("venue_id", venueId);
  }

  /**
   * Check if user owns venue
   */
  static async isOwner(venueId: string, userId: string) {
    const supabase = await createServerSupabase();
    const { data } = await supabase
      .from("venues")
      .select("venue_id")
      .eq("venue_id", venueId)
      .eq("owner_user_id", userId)
      .maybeSingle();

    return !!data;
  }

  /**
   * Get venue settings
   */
  static async getSettings(venueId: string) {
    const supabase = await createServerSupabase();
    return supabase.from("venues").select("settings").eq("venue_id", venueId).single();
  }

  /**
   * Update venue settings
   */
  static async updateSettings(venueId: string, settings: Record<string, unknown>) {
    return this.update(venueId, { settings });
  }
}
