import { useState, useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase";

interface ShiftWithStaff {
  id: string;
  staff_id: string;
  start_time: string;
  end_time: string;
  area: string | null;
  staff?: {
    name: string;
    role: string;
  } | null;
}

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
  // Use initialStaff directly, no empty array fallback to prevent flicker
  const [staff, setStaff] = useState<StaffRow[]>(initialStaff || []);
  const [name, setName] = useState("");
  const [role, setRole] = useState("Server");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allShifts, setAllShifts] = useState<LegacyShift[]>([]);
  const [staffLoaded, setStaffLoaded] = useState(false);
  const [shiftsLoaded, setShiftsLoaded] = useState(false);
  const [loading, setLoading] = useState(false); // Start with false to prevent flicker

  // Load staff data on component mount - Direct Supabase query
  // Always fetch from database to ensure we have the latest data
  useEffect(() => {
    const loadStaff = async () => {
      if (staffLoaded) return;

      try {
        const supabase = supabaseBrowser();
        const { data: staffData, error } = await supabase
          .from("staff")
          .select("*")
          .eq("venue_id", venueId)
          .order("created_at", { ascending: false });

        if (!error && staffData) {
          setStaff(staffData);
          setStaffLoaded(true);
        }
      } catch (_e) {
        // Error silently handled
      }
    };

    loadStaff();
  }, [venueId]);

  // Load shifts on component mount - Direct Supabase query
  // Always fetch from database to ensure we have the latest data
  useEffect(() => {
    const loadShifts = async () => {
      if (shiftsLoaded) return;

      try {
        const supabase = supabaseBrowser();
        const { data: shiftsData, error } = await supabase
          .from("shifts")
          .select(
            `
            *,
            staff:staff_id (
              name,
              role
            )
          `
          )
          .eq("venue_id", venueId)
          .order("start_time", { ascending: false });

        if (!error && shiftsData) {
          // Transform to match LegacyShift format
          const shifts = shiftsData.map((shift: ShiftWithStaff) => ({
            id: shift.id,
            staff_id: shift.staff_id,
            start_time: shift.start_time,
            end_time: shift.end_time,
            area: shift.area || undefined,
            staff_name: shift.staff?.name || "",
            staff_role: shift.staff?.role || "",
          }));
          setAllShifts(shifts);
          setShiftsLoaded(true);
        }
      } catch (_e) {
        // Error silently handled
      }
    };

    loadShifts();
  }, [venueId]);

  const addStaff = async () => {
    if (!name.trim()) {
      setError("Please enter a name");
      return;
    }

    setAdding(true);
    setError(null);

    try {
      const supabase = supabaseBrowser();
      const { data: newStaff, error } = await supabase
        .from("staff")
        .insert({
          venue_id: venueId,
          name: name.trim(),
          role,
          active: true,
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message || "Failed to add staff member");
      }

      setStaff((prev) => [...prev, newStaff]);
      setName("");
      setRole("Server");
    } catch (_err) {
      setError(_err instanceof Error ? _err.message : "Failed to perform action");
    } finally {
      setAdding(false);
    }
  };

  const toggleStaffActive = async (staffId: string, currentActive: boolean) => {
    try {
      const newActiveState = !currentActive;
      const supabase = supabaseBrowser();

      const { error } = await supabase
        .from("staff")
        .update({ active: newActiveState })
        .eq("id", staffId);

      if (error) {
        throw new Error(error.message || "Failed to toggle staff status");
      }

      // Update local state immediately
      setStaff((prev) =>
        prev.map((s) => (s.id === staffId ? { ...s, active: newActiveState } : s))
      );
    } catch (_err) {
      setError(_err instanceof Error ? _err.message : "Failed to toggle staff status");
    }
  };

  return {
    staff,
    setStaff,
    name,
    setName,
    role,
    setRole,
    adding,
    error,
    setError,
    allShifts,
    loading,
    addStaff,
    toggleStaffActive,
  };
}
