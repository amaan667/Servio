import { useState, useEffect, useCallback } from "react";
import { normalizeVenueId } from "@/lib/utils/venueId";

export type StaffRow = {
  id: string;
  name: string;
  role: string;
  active: boolean;
  created_at: string;
};

export type LegacyShift = {
  id: string;
  staff_id: string;
  start_time: string;
  end_time: string;
  area?: string;
  staff_name: string;
  staff_role: string;
};

export interface StaffCounts {
  total_staff: number;
  active_staff: number;
  unique_roles: number;
  active_shifts_count: number;
}

export function useStaffManagement(
  venueId: string,
  initialStaff?: StaffRow[],
  _initialCounts?: StaffCounts
) {
  // Hook initialized

  // Use initialStaff as initial state, but always fetch from database to ensure accuracy
  const [staff, setStaff] = useState<StaffRow[]>(initialStaff || []);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load staff data using API route to ensure proper authentication and RLS
  const loadStaff = useCallback(async () => {
    setLoading(true);
    try {
      const normalizedVenueId = normalizeVenueId(venueId) ?? venueId;

      const url = new URL("/api/staff/list", window.location.origin);
      url.searchParams.set("venueId", normalizedVenueId);

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMessage =
          data.error?.message || data.error || data.message || "Failed to load staff";

        setError(errorMessage);
        setStaff([]);
      } else if (data.data?.staff) {
        const staffData = data.data.staff;
        setStaff(staffData);
      } else if (data.staff) {
        // Handle direct staff array in data (legacy format)
        setStaff(data.staff);
      } else if (Array.isArray(data.data)) {
        // Handle array directly in data.data
        setStaff(data.data);
      } else {
        setStaff([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load staff");
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }, [venueId, initialStaff]);

  // Load staff on component mount
  useEffect(() => {
    // Always load staff on mount, regardless of initialStaff
    loadStaff();
  }, [loadStaff]);

  const toggleStaffActive = useCallback(
    async (staffId: string, currentActive: boolean) => {
      try {
        const newActive = !currentActive;
        const normalizedVenueId = normalizeVenueId(venueId) ?? venueId;
        const url = new URL("/api/staff/toggle", window.location.origin);
        url.searchParams.set("venueId", normalizedVenueId);
        const res = await fetch(url.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ id: staffId, active: newActive }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            data.error?.message || data.error || data.message || "Failed to toggle staff status"
          );
        }
        setStaff((prev) => prev.map((s) => (s.id === staffId ? { ...s, active: newActive } : s)));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to toggle staff status");
      }
    },
    [venueId]
  );

  return {
    staff,
    setStaff,
    error,
    setError,
    loading,
    toggleStaffActive,
    reloadStaff: loadStaff,
  };
}
