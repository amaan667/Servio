import { useState, useEffect, useCallback } from "react";
import { LegacyShift } from "./useStaffManagement";
import { normalizeVenueId } from "@/lib/utils/venueId";

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

  const loadShifts = useCallback(async () => {
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
  }, [venueId]);

  // Load shifts on mount
  useEffect(() => {
    if (shiftsLoaded) return;
    loadShifts();
  }, [shiftsLoaded, loadShifts]);

  const reloadShifts = useCallback(async () => {
    await loadShifts();
  }, [loadShifts]);

  const addShift = async (
    staffId: string,
    startTime: string,
    endTime: string,
    area?: string
  ) => {
    try {
      const normalized = normalizeVenueId(venueId);
      const res = await fetch("/api/staff/shifts/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          venue_id: normalized,
          staff_id: staffId,
          start_time: startTime,
          end_time: endTime,
          area: area || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to add shift");
      }

      // Reload shifts from server to get full data with staff names
      await reloadShifts();
      setEditingShiftFor(null);
    } catch (_err) {
      // Error silently handled
    }
  };

  const updateShift = async (
    shiftId: string,
    updates: { start_time?: string; end_time?: string; area?: string }
  ) => {
    try {
      const res = await fetch("/api/staff/shifts/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: shiftId, ...updates }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to update shift");
      }

      // Reload shifts from server to get accurate data
      await reloadShifts();
    } catch (_err) {
      throw _err;
    }
  };

  const deleteShift = async (shiftId: string) => {
    try {
      const res = await fetch("/api/staff/shifts/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: shiftId }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to delete shift");
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
    updateShift,
    deleteShift,
    reloadShifts,
  };
}
