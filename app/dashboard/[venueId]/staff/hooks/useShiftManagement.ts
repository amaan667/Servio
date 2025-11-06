import { useState, useEffect } from "react";
import { buildIsoFromLocal, addDaysISO } from "@/lib/time";
import { LegacyShift } from "./useStaffManagement";
import { supabaseBrowser } from "@/lib/supabase";

export function useShiftManagement(venueId: string, _staff: unknown[]) {
  const [allShifts, setAllShifts] = useState<LegacyShift[]>([]);
  const [shiftsLoaded, setShiftsLoaded] = useState(false);
  const [editingShiftFor, setEditingShiftFor] = useState<string | null>(null);

  // Load shifts on component mount - Direct Supabase query
  useEffect(() => {
    const loadShifts = async () => {
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
          const shifts = shiftsData.map((shift: any) => ({
            id: shift.id,
            staff_id: shift.staff_id,
            start_time: shift.start_time,
            end_time: shift.end_time,
            area: shift.area,
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

    if (!shiftsLoaded) {
      loadShifts();
    }
  }, [venueId, shiftsLoaded]);

  const addShift = async (staffId: string, startTime: string, endTime: string, area?: string) => {
    try {
      const supabase = supabaseBrowser();
      const { data: newShift, error } = await supabase
        .from("shifts")
        .insert({
          venue_id: venueId,
          staff_id: staffId,
          start_time: startTime,
          end_time: endTime,
          area: area || null,
        })
        .select(
          `
          *,
          staff:staff_id (
            name,
            role
          )
        `
        )
        .single();

      if (error) {
        throw new Error(error.message || "Failed to add shift");
      }

      // Transform to match LegacyShift format
      const shift: LegacyShift = {
        id: newShift.id,
        staff_id: newShift.staff_id,
        start_time: newShift.start_time,
        end_time: newShift.end_time,
        area: newShift.area,
        staff_name: (newShift.staff as any)?.name || "",
        staff_role: (newShift.staff as any)?.role || "",
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
      const { error } = await supabase.from("shifts").delete().eq("id", shiftId);

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
