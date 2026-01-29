/**
 * @fileoverview Venue repository for database operations
 * @module lib/repositories/venue-repository
 */

import { BaseRepository } from "./base-repository";
import { SupabaseClient } from "@supabase/supabase-js";

export interface Venue {
  venue_id: string;
  name: string;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  logo_url?: string;
  owner_user_id: string;
  organization_id?: string;
  settings?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export class VenueRepository extends BaseRepository<Venue> {
  protected tableName = "venues";

  constructor(supabase: SupabaseClient) {
    super(supabase);
  }

  /**
   * Find venues by owner
   */
  async findByOwner(userId: string): Promise<Venue[]> {
    return this.findAll(
      {
        owner_user_id: userId,
      } as Partial<Venue>,
      {
        orderBy: { column: "created_at", ascending: true },
      }
    );
  }

  /**
   * Find venue by ID (override to use venue_id instead of id)
   */
  async findById(venueId: string): Promise<Venue | null> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select("*")
        .eq("venue_id", venueId)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null;

        throw error;
      }

      return data as Venue;
    } catch (_error) {
      throw _error;
    }
  }

  /**
   * Update venue settings
   */
  async updateSettings(venueId: string, settings: Record<string, unknown>): Promise<Venue | null> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .update({
          settings,
          updated_at: new Date().toISOString(),
        })
        .eq("venue_id", venueId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data as Venue;
    } catch (_error) {
      throw _error;
    }
  }
}
