import TablesClientPage from "./page.client";
import { requirePageAuth } from "@/lib/auth/page-auth-helper";
import { createAdminClient } from "@/lib/supabase";
import logger from "@/lib/logger";

interface TableStats {
  total_tables: number;
  occupied: number;
  reserved: number;
  available: number;
}

interface TablesPageData {
  tables: Record<string, unknown>[];
  stats: TableStats;
  reservations: Record<string, unknown>[];
}

async function fetchTablesData(venueId: string): Promise<TablesPageData | null> {
  try {
    const supabase = createAdminClient();

    // Fetch all active tables
    const { data: tables, error: tablesError } = await supabase
      .from("tables")
      .select("id, label, seat_count, table_number, is_active, merged_with_table_id")
      .eq("venue_id", venueId)
      .eq("is_active", true)
      .order("table_number", { ascending: true, nullsFirst: false });

    if (tablesError) {
      logger.error("[TablesPage] Error fetching tables:", tablesError);
      return null;
    }

    // Filter out merged tables
    const activeTables = (tables || []).filter(
      (t: Record<string, unknown>) => t.merged_with_table_id == null
    );

    // Fetch active table sessions (OCCUPIED and FREE status)
    const { data: tableSessions, error: sessionsError } = await supabase
      .from("table_sessions")
      .select("*")
      .eq("venue_id", venueId)
      .in("status", ["FREE", "OCCUPIED", "ORDERING", "IN_PREP", "READY", "SERVED", "AWAITING_BILL"])
      .order("opened_at", { ascending: false });

    if (sessionsError) {
      logger.error("[TablesPage] Error fetching table sessions:", sessionsError);
    }

    // Fetch current reservations (BOOKED and CHECKED_IN within time window)
    const now = new Date();
    const { data: reservations, error: reservationsError } = await supabase
      .from("reservations")
      .select("*")
      .eq("venue_id", venueId)
      .in("status", ["BOOKED", "CHECKED_IN"])
      .gte("end_at", now.toISOString())
      .order("start_at", { ascending: true });

    if (reservationsError) {
      logger.error("[TablesPage] Error fetching reservations:", reservationsError);
    }

    // Calculate statistics
    let occupied = 0;
    let reserved = 0;
    const sessionTableIds = new Set((tableSessions || []).map((s: Record<string, unknown>) => s.table_id));
    const reservationTableIds = new Set((reservations || []).map((r: Record<string, unknown>) => r.table_id));

    for (const table of activeTables) {
      const tableId = (table as Record<string, unknown>).id as string;
      
      // Check if table has an OCCUPIED session
      const session = (tableSessions || []).find(
        (s: Record<string, unknown>) => s.table_id === tableId && s.status === "OCCUPIED"
      );
      
      // Check if table has an active reservation (within time window)
      const reservation = (reservations || []).find(
        (r: Record<string, unknown>) => {
          const rTableId = r.table_id as string;
          const startAt = new Date(r.start_at as string);
          const endAt = new Date(r.end_at as string);
          const leadTime = new Date(startAt.getTime() - 30 * 60 * 1000); // 30 min lead time
          return rTableId === tableId && now >= leadTime && now <= endAt;
        }
      );

      if (session) {
        occupied++;
      } else if (reservation) {
        reserved++;
      }
    }

    const stats: TableStats = {
      total_tables: activeTables.length,
      occupied,
      reserved,
      available: activeTables.length - occupied - reserved,
    };

    logger.info("[TablesPage] SSR data fetched successfully", {
      venueId,
      totalTables: activeTables.length,
      stats,
      reservationsCount: reservations?.length || 0,
    });

    return {
      tables: activeTables,
      stats,
      reservations: reservations || [],
    };
  } catch (error) {
    logger.error("[TablesPage] Unexpected error fetching tables data:", error);
    return null;
  }
}

export default async function TablesPage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;

  // Server-side auth check
  const auth = await requirePageAuth(venueId).catch(() => null);

  // Fetch initial tables data on server for SSR
  const initialData = await fetchTablesData(venueId);

  // Log all auth information for browser console
  const authInfo = {
    hasAuth: !!auth,
    userId: auth?.user?.id,
    email: auth?.user?.email,
    tier: auth?.tier ?? "starter",
    role: auth?.role ?? "viewer",
    venueId: auth?.venueId ?? venueId,
    timestamp: new Date().toISOString(),
    page: "Tables",
  };

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__PLATFORM_AUTH__ = ${JSON.stringify(authInfo)};`,
        }}
      />
      <TablesClientPage
        venueId={venueId}
        tier={auth?.tier ?? "starter"}
        role={auth?.role ?? "viewer"}
        initialTables={initialData?.tables || null}
        initialReservations={initialData?.reservations || null}
        initialStats={initialData?.stats || null}
      />
    </>
  );
}
