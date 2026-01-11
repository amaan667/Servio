// Servio AI Assistant - QR Code Management Tools
// Generate, manage, and export QR codes for tables and counters

import { createAdminClient } from "@/lib/supabase";

interface QRCodeGenerationResult {

  }>;

}

interface QRCodeListResult {

  }>;

  }>;

}

/**
 * Generate QR code for a specific table
 */
export async function generateTableQRCode(

  const qrUrl = `${baseUrl}/order?venue=${venueId}&table=${encodeURIComponent(tableLabel)}`;

  return {

        id: `qr-${tableLabel}`, // Just a unique ID for the QR code

      },
    ],
    message: `QR code generated for ${tableLabel}. View it on the QR Codes page to download.`,
  };
}

/**
 * Generate QR codes for multiple tables in bulk
 */
export async function generateBulkTableQRCodes(

  prefix?: string,

  }

  const qrCodes: QRCodeGenerationResult["qrCodes"] = [];
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://servio.uk";

  // Generate QR codes for the range (no database tables required)
  for (let i = startNumber; i <= endNumber; i++) {
    const label = `${actualPrefix} ${i}`;
    const paramName = type === "table" ? "table" : "counter";
    qrCodes.push({
      id: `qr-${type}-${i}`,
      label,
      type,
      url: `${baseUrl}/order?venue=${venueId}&${paramName}=${encodeURIComponent(label)}`,

  }

  return {

    qrCodes,
    message: `Generated ${qrCodes.length} QR codes for ${actualPrefix} ${startNumber}-${endNumber}. View them on the QR Codes page to download.`,
  };
}

/**
 * Generate QR code for counter orders
 * NOTE: This only generates the QR code URL, it does NOT create the counter in the database
 */
export async function generateCounterQRCode(

  const qrUrl = `${baseUrl}/order?venue=${venueId}&counter=${encodeURIComponent(counterLabel)}`;

  return {

        id: `qr-${counterLabel}`,

      },
    ],
    message: `QR code generated for counter "${counterLabel}". View it on the QR Codes page to download.`,
  };
}

/**
 * List all QR codes for a venue
 */
export async function listAllQRCodes(venueId: string): Promise<QRCodeListResult> {
  const supabase = createAdminClient();

  

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://servio.uk";

  // Get all tables
  const { data: tables } = await supabase
    .from("tables")
    .select("id, label, is_active")
    .eq("venue_id", venueId)
    .eq("is_active", true)
    .order("label", { ascending: true });

  // Get all counters
  const { data: counters } = await supabase
    .from("counters")
    .select("id, name, is_active")
    .eq("venue_id", venueId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  const tableQRs =
    tables?.map((table) => ({

      qrUrl: `${baseUrl}/order?venue=${venueId}&table=${encodeURIComponent(table.label)}`,

    })) || [];

  const counterQRs =
    counters?.map((counter) => ({

      qrUrl: `${baseUrl}/order?venue=${venueId}&counter=${encodeURIComponent(counter.name)}`,

    })) || [];

  return {

    summary: `Found ${tableQRs.length} table QR codes and ${counterQRs.length} counter QR codes.`,
  };
}

/**
 * Generate PDF export data for QR codes
 * Returns data that can be used to generate PDF
 */
export async function prepareQRCodePDFData(venueId: string): Promise<{

    tables: Array<{ label: string; url: string }>;
    counters: Array<{ label: string; url: string }>;
  };

}> {
  const qrData = await listAllQRCodes(venueId);
  const supabase = createAdminClient();

  const { data: venue } = await supabase
    .from("venues")
    .select("venue_name")
    .eq("venue_id", venueId)
    .single();

  return {

      tables: qrData.tables.map((t) => ({ label: t.label, url: t.qrUrl })),
      counters: qrData.counters.map((c) => ({ label: c.label, url: c.qrUrl })),
    },
    message: `QR code data prepared for PDF export. ${qrData.tables.length} tables and ${qrData.counters.length} counters ready to download.`,
  };
}
