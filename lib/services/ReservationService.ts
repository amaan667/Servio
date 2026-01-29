/**
 * Reservation Service
 * Handles all guest reservations and bookings
 */

import { BaseService } from "./BaseService";
import { createSupabaseClient } from "@/lib/supabase";

export interface Reservation {
  id: string;
  venue_id: string;
  customer_name: string;
  customer_phone?: string | null;
  customer_email?: string | null;
  party_size: number;
  start_at: string;
  end_at: string;
  status: "BOOKED" | "CHECKED_IN" | "CANCELLED" | "NO_SHOW" | "COMPLETED";
  table_id?: string | null;
  notes?: string | null;
}

export class ReservationService extends BaseService {
  /**
   * Get reservations for a venue
   */
  async getReservations(
    venueId: string,
    filters?: { status?: string; date?: string }
  ): Promise<Reservation[]> {
    const supabase = await createSupabaseClient();
    let query = supabase
      .from("reservations")
      .select("*")
      .eq("venue_id", venueId)
      .order("start_at", { ascending: true });

    if (filters?.status) query = query.eq("status", filters.status);

    if (filters?.date) {
      const start = new Date(filters.date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(filters.date);
      end.setHours(23, 59, 59, 999);
      query = query.gte("start_at", start.toISOString()).lte("start_at", end.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  /**
   * Create a new reservation
   */
  async createReservation(venueId: string, data: Partial<Reservation>): Promise<Reservation> {
    const supabase = await createSupabaseClient();
    const { data: reservation, error } = await supabase
      .from("reservations")
      .insert({
        ...data,
        venue_id: venueId,
        status: "BOOKED",
      })
      .select()
      .single();

    if (error) throw error;
    return reservation;
  }
}

export const reservationService = new ReservationService();
