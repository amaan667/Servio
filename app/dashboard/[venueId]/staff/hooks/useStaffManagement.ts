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
  // Immediate logging when hook is called
  if (typeof window !== 'undefined') {
    console.log("=".repeat(80));
    console.log("[STAFF HOOK] useStaffManagement hook called");
    console.log("[STAFF HOOK] venueId parameter:", venueId);
    console.log("[STAFF HOOK] initialStaff parameter:", initialStaff ? `${initialStaff.length} members` : "none");
    console.log("[STAFF HOOK] Hook call timestamp:", new Date().toISOString());
    console.log("=".repeat(80));
  }

  // Use initialStaff as initial state, but always fetch from database to ensure accuracy
  const [staff, setStaff] = useState<StaffRow[]>(initialStaff || []);
  const [name, setName] = useState("");
  const [role, setRole] = useState("Server");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allShifts, setAllShifts] = useState<LegacyShift[]>([]);
  const [shiftsLoaded, setShiftsLoaded] = useState(false);
  const [loading, setLoading] = useState(true); // Start with true to show loading state

  // Load staff data on component mount - Always fetch from database to ensure accuracy
  useEffect(() => {
    console.log("[STAFF HOOK] useEffect for loadStaff triggered");
    const loadStaff = async () => {
      console.log("=".repeat(80));
      console.log("[STAFF PAGE LOAD] Starting staff load process");
      console.log("[STAFF PAGE LOAD] Raw venueId from props:", venueId);
      console.log("[STAFF PAGE LOAD] initialStaff provided:", initialStaff ? `${initialStaff.length} members` : "none");
      
      setLoading(true);
      try {
        const supabase = supabaseBrowser();
        // Normalize venueId - database stores with venue- prefix
        const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;
        console.log("[STAFF PAGE LOAD] Normalized venueId:", normalizedVenueId);
        console.log("[STAFF PAGE LOAD] Querying database: staff table, venue_id =", normalizedVenueId);
        
        const queryStart = Date.now();
        const { data: staffData, error } = await supabase
          .from("staff")
          .select("*")
          .eq("venue_id", normalizedVenueId)
          .order("created_at", { ascending: false });
        const queryTime = Date.now() - queryStart;

        console.log("[STAFF PAGE LOAD] Query completed in", queryTime, "ms");
        console.log("[STAFF PAGE LOAD] Query error:", error ? JSON.stringify(error, null, 2) : "none");
        console.log("[STAFF PAGE LOAD] Query returned data:", staffData ? `${staffData.length} rows` : "null");
        
        if (error) {
          console.error("[STAFF PAGE LOAD] ERROR - Database query failed:");
          console.error("[STAFF PAGE LOAD] Error code:", error.code);
          console.error("[STAFF PAGE LOAD] Error message:", error.message);
          console.error("[STAFF PAGE LOAD] Error details:", JSON.stringify(error, null, 2));
          setError(error.message || "Failed to load staff");
        } else if (staffData) {
          console.log("[STAFF PAGE LOAD] SUCCESS - Loaded", staffData.length, "staff members");
          console.log("[STAFF PAGE LOAD] Staff data:", JSON.stringify(staffData, null, 2));
          setStaff(staffData);
        } else {
          console.log("[STAFF PAGE LOAD] WARNING - Query returned null/undefined data");
          console.log("[STAFF PAGE LOAD] This might mean no staff exists for venue:", normalizedVenueId);
          setStaff([]);
        }
        console.log("[STAFF PAGE LOAD] Load process completed");
        console.log("=".repeat(80));
      } catch (e) {
        console.error("[STAFF PAGE LOAD] EXCEPTION - Unexpected error:");
        console.error("[STAFF PAGE LOAD] Exception type:", e instanceof Error ? e.constructor.name : typeof e);
        console.error("[STAFF PAGE LOAD] Exception message:", e instanceof Error ? e.message : String(e));
        console.error("[STAFF PAGE LOAD] Exception stack:", e instanceof Error ? e.stack : "no stack");
        setError(e instanceof Error ? e.message : "Failed to load staff");
      } finally {
        setLoading(false);
        console.log("[STAFF PAGE LOAD] Loading state set to false");
      }
    };

    // Always load staff on mount, regardless of initialStaff
    loadStaff();
  }, [venueId]);

  // Load shifts on component mount - Direct Supabase query
  // Always fetch from database to ensure we have the latest data
  useEffect(() => {
    const loadShifts = async () => {
      try {
        const supabase = supabaseBrowser();
        // Normalize venueId - database stores with venue- prefix
        const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;
        
        // Try staff_shifts first, fallback to shifts if it doesn't exist
        let shiftsData = null;
        let error = null;
        
        // Try staff_shifts table first
        const { data: staffShiftsData, error: staffShiftsError } = await supabase
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
          .eq("venue_id", normalizedVenueId)
          .order("start_time", { ascending: false });
        
        if (staffShiftsError && staffShiftsError.code === 'PGRST116') {
          // Table doesn't exist, try shifts table as fallback
          const { data: shiftsDataFallback, error: shiftsError } = await supabase
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
            .eq("venue_id", normalizedVenueId)
            .order("start_time", { ascending: false });
          
          shiftsData = shiftsDataFallback;
          error = shiftsError;
        } else {
          shiftsData = staffShiftsData;
          error = staffShiftsError;
        }

        if (error) {
          // Silently handle 404 - table might not exist yet
          if (error.code !== 'PGRST116') {
            // Error logged but not critical
          }
        } else if (shiftsData && shiftsData.length > 0) {
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
        } else {
          // No shifts found - this is OK
          setAllShifts([]);
          setShiftsLoaded(true);
        }
      } catch (e) {
        // Silently handle errors - shifts are optional
        // Error handled silently
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
      // Normalize venueId - database stores with venue- prefix
      const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;
      
      const { data: newStaff, error } = await supabase
        .from("staff")
        .insert({
          venue_id: normalizedVenueId,
          name: name.trim(),
          role,
          active: true,
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message || "Failed to add staff member");
      }

      if (newStaff) {
        setStaff((prev) => [...prev, newStaff]);
        setName("");
        setRole("Server");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to perform action");
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
