import { useState, useEffect } from "react";
import { buildIsoFromLocal, addDaysISO } from "@/lib/time";
import { LegacyShift } from "./useStaffManagement";
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
            staff:staff_id (
              name,
              role
            )
          `
          )
          .eq("venue_id", venueId)
          .order("start_time", { ascending: false });

        if (error) {
          // Silently handle 404 - table might not exist yet
          if (error.code !== 'PGRST116') {
            // Error handled silently
          }
        } else if (shiftsData) {
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
      const shiftData = newShift as ShiftWithStaff;
      const shift: LegacyShift = {
        id: shiftData.id,
        staff_id: shiftData.staff_id,
        start_time: shiftData.start_time,
        end_time: shiftData.end_time,
        area: shiftData.area || undefined,
        staff_name: shiftData.staff?.name || "",
        staff_role: shiftData.staff?.role || "",
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
