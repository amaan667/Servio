import dynamic from "next/dynamic";
import { requirePageAuth } from "@/lib/auth/page-auth-helper";
import { createServerSupabaseReadOnly } from "@/lib/supabase";
import { logger } from "@/lib/logger";

const QRCodeClientPage = dynamic(() => import("./page.client"), {
  ssr: false,
  loading: () => null,
});

export interface QRCodeStats {
  totalQRCodes: number;
  activeCodes: number;
  tableCount: number;
  counterCount: number;
  tablePickupCount: number;
}

export interface QRCodePageData {
  venueName: string;
  stats: QRCodeStats;
  tables: Array<{ id: string; label: string; table_number: string | number | null }>;
  counters: Array<{ id: string; name: string }>;
}

async function fetchQRCodeData(venueId: string): Promise<QRCodePageData> {
  const startTime = Date.now();
  let venueName = "My Venue";
  let tables: Array<{ id: string; label: string; table_number: string | number | null }> = [];
  let counters: Array<{ id: string; name: string }> = [];

  try {
    const supabase = await createServerSupabaseReadOnly();

    // Fetch venue name
    const { data: venueData } = await supabase
      .from("venues")
      .select("venue_name")
      .eq("venue_id", venueId)
      .single();

    if (venueData?.venue_name) {
      venueName = venueData.venue_name;
    }

    // Fetch tables
    const { data: tablesData, error: tablesError } = await supabase
      .from("tables")
      .select("id, label, table_number")
      .eq("venue_id", venueId);

    if (tablesError) {
      logger.error("[QR Codes] Error fetching tables:", { error: tablesError.message, venueId });
    } else if (tablesData) {
      tables = tablesData;
    }

    // Fetch counters
    const { data: countersData, error: countersError } = await supabase
      .from("counters")
      .select("id, name")
      .eq("venue_id", venueId);

    if (countersError) {
      logger.error("[QR Codes] Error fetching counters:", { error: countersError.message, venueId });
    } else if (countersData) {
      counters = countersData;
    }

    // Calculate statistics
    const tableCount = tables.filter((t) => t.label || t.table_number).length;
    const counterCount = counters.filter((c) => c.name).length;
    const tablePickupCount = 0; // No separate table_pickup table, same as tables
    const totalQRCodes = tableCount + counterCount + tablePickupCount;
    const activeCodes = totalQRCodes; // All are considered active

    const stats: QRCodeStats = {
      totalQRCodes,
      activeCodes,
      tableCount,
      counterCount,
      tablePickupCount,
    };

    const duration = Date.now() - startTime;
    logger.info("[QR Codes] Data fetched successfully", {
      venueId,
      stats,
      duration: `${duration}ms`,
    });

    return {
      venueName,
      stats,
      tables,
      counters,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("[QR Codes] Error fetching QR code data:", {
      error: errorMessage,
      venueId,
      duration: `${Date.now() - startTime}ms`,
    });

    // Return default data on error
    return {
      venueName,
      stats: {
        totalQRCodes: 0,
        activeCodes: 0,
        tableCount: 0,
        counterCount: 0,
        tablePickupCount: 0,
      },
      tables: [],
      counters: [],
    };
  }
}

export default async function QRCodePage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;

  // Server-side auth check
  const auth = await requirePageAuth(venueId).catch(() => null);

  // Fetch QR code data server-side
  const qrData = await fetchQRCodeData(venueId);

  // Log all auth information for browser console
  const authInfo = {
    hasAuth: !!auth,
    userId: auth?.user?.id,
    email: auth?.user?.email,
    tier: auth?.tier ?? "starter",
    role: auth?.role ?? "viewer",
    venueId: auth?.venueId ?? venueId,
    timestamp: new Date().toISOString(),
    page: "QR Codes",
  };

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__PLATFORM_AUTH__ = ${JSON.stringify(authInfo)};`,
        }}
      />
      <QRCodeClientPage
        venueId={venueId}
        tier={auth?.tier ?? "starter"}
        role={auth?.role ?? "viewer"}
        venueName={qrData.venueName}
        stats={qrData.stats}
        initialTables={qrData.tables}
        initialCounters={qrData.counters}
      />
    </>
  );
}
