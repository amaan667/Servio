import { useState, useEffect } from "react";
import { LegacyShift } from "./useStaffManagement";
import { supabaseBrowser } from "@/lib/supabase";

interface ShiftWithStaff {

  } | null;
}

export function useShiftManagement(venueId: string, _staff: unknown[]) {
  const [allShifts, setAllShifts] = useState<LegacyShift[]>([]);
  const [shiftsLoaded, setShiftsLoaded] = useState(false);
  const [editingShiftFor, setEditingShiftFor] = useState<string | null>(null);

  // Load shifts on component mount - Direct Supabase query
  useEffect(() => {
    const loadShifts = async () => {
      try {
        const supabase = supabaseBrowser();
        // Use staff_shifts table (not shifts)
        const { data: shiftsData, error } = await supabase
          .from("staff_shifts")
          .select(
            `
            *,

              role
            )
          `
          )
          .eq("venue_id", venueId)
          .order("start_time", { ascending: false });

        if (error) {
          // Silently handle 404 - table might not exist yet
          if (error.code !== "PGRST116") {
            // Error handled silently
          }
        } else if (shiftsData) {
          // Transform to match LegacyShift format
          const shifts = shiftsData.map((shift: ShiftWithStaff) => ({

          }));
          setAllShifts(shifts);
          setShiftsLoaded(true);
        }
      } catch (e) {
        // Silently handle errors - shifts are optional
        // Error handled silently
      }
    };

    if (!shiftsLoaded) {
      loadShifts();
    }
  }, [venueId, shiftsLoaded]);

  const addShift = async (staffId: string, startTime: string, endTime: string, area?: string) => {
    try {
      const supabase = supabaseBrowser();
      // Use staff_shifts table (not shifts)
      const { data: newShift, error } = await supabase
        .from("staff_shifts")
        .insert({

        .select(
          `
          *,

            role
          )
        `
        )
        .single();

      if (error) {
        throw new Error(error.message || "Failed to add shift");
      }

      // Transform to match LegacyShift format
      const shiftData = newShift as ShiftWithStaff;
      const shift: LegacyShift = {

      };

      setAllShifts((prev) => [...prev, shift]);
      setEditingShiftFor(null);
    } catch (_err) {
      // Error silently handled
    }
  };

  const deleteShift = async (shiftId: string) => {
    try {
      const supabase = supabaseBrowser();
      // Use staff_shifts table (not shifts)
      const { error } = await supabase.from("staff_shifts").delete().eq("id", shiftId);

      if (error) {
        throw new Error(error.message || "Failed to delete shift");
      }

      setAllShifts((prev) => prev.filter((s) => s.id !== shiftId));
    } catch (_err) {
      // Error silently handled
    }
  };

  return {
    allShifts,
    setAllShifts,
    shiftsLoaded,
    editingShiftFor,
    setEditingShiftFor,
    addShift,
    deleteShift,
  };
}
