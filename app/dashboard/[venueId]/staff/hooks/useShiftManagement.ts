import { useState, useEffect } from "react";
import { LegacyShift } from "./useStaffManagement";
import { supabaseBrowser } from "@/lib/supabase";
import { normalizeVenueId } from "@/lib/utils/venueId";

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

interface ApiShiftRow {
  id: string;
  staff_id: string;
  start_time: string;
  end_time: string;
  area?: string | null;
  staff_name?: string;
  staff_role?: string;
}

function toLegacyShift(row: ApiShiftRow): LegacyShift {
  return {
    id: row.id,
    staff_id: row.staff_id,
    start_time: row.start_time,
    end_time: row.end_time,
    area: row.area ?? undefined,
    staff_name: row.staff_name ?? "Unknown",
    staff_role: row.staff_role ?? "Unknown",
  };
}

export function useShiftManagement(venueId: string, _staff: unknown[]) {
  const [allShifts, setAllShifts] = useState<LegacyShift[]>([]);
  const [shiftsLoaded, setShiftsLoaded] = useState(false);
  const [editingShiftFor, setEditingShiftFor] = useState<string | null>(null);

  // Load shifts via API (single server path)
  useEffect(() => {
    if (shiftsLoaded) return;

    const loadShifts = async () => {
      try {
        const normalized = normalizeVenueId(venueId);
        if (!normalized) return;

        const res = await fetch(
          `/api/staff/shifts/list?venue_id=${encodeURIComponent(normalized)}`,
          { credentials: "include" }
        );
        const json = await res.json();

        if (json.success && Array.isArray(json.data?.shifts)) {
          setAllShifts(json.data.shifts.map((s: ApiShiftRow) => toLegacyShift(s)));
          setShiftsLoaded(true);
        }
      } catch (_e) {
        // Shifts are optional; silently skip
      }
    };

    loadShifts();
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
