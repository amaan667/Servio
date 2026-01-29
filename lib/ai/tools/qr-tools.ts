// Servio AI Assistant - QR Code Management Tools
// Generate, manage, and export QR codes for tables and counters

import { createAdminClient } from "@/lib/supabase";

interface QRCodeGenerationResult {
  success: boolean;
  qrCodes: Array<{
    id: string;
    label: string;
    type: "table" | "counter";
    url: string;
  }>;
  message: string;
}

interface QRCodeListResult {
  tables: Array<{
    id: string;
    label: string;
    qrUrl: string;
    status: string;
  }>;
  counters: Array<{
    id: string;
    label: string;
    qrUrl: string;
    status: string;
  }>;
  summary: string;
}

/**
 * Generate QR code for a specific table
 */
export async function generateTableQRCode(
  venueId: string,
  tableLabel: string
): Promise<QRCodeGenerationResult> {
  // Generate QR URL (no database table required - QR works regardless)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://servio.uk";
  const qrUrl = `${baseUrl}/order?venue=${venueId}&table=${encodeURIComponent(tableLabel)}`;

  return {
    success: true,
    qrCodes: [
      {
        id: `qr-${tableLabel}`, // Just a unique ID for the QR code
        label: tableLabel,
        type: "table",
        url: qrUrl,
      },
    ],
    message: `QR code generated for ${tableLabel}. View it on the QR Codes page to download.`,
  };
}

/**
 * Generate QR codes for multiple tables in bulk
 */
export async function generateBulkTableQRCodes(
  venueId: string,
  startNumber: number,
  endNumber: number,
  prefix?: string,
  type: "table" | "counter" = "table"
): Promise<QRCodeGenerationResult> {
  const actualPrefix = prefix || (type === "table" ? "Table" : "Counter");

  if (startNumber < 1 || endNumber < startNumber || endNumber - startNumber > 100) {
    throw new Error("Invalid range. Please specify 1-100 items.");
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
    });
  }

  return {
    success: true,
    qrCodes,
    message: `Generated ${qrCodes.length} QR codes for ${actualPrefix} ${startNumber}-${endNumber}. View them on the QR Codes page to download.`,
  };
}

/**
 * Generate QR code for counter orders
 * NOTE: This only generates the QR code URL, it does NOT create the counter in the database
 */
export async function generateCounterQRCode(
  venueId: string,
  counterLabel: string
): Promise<QRCodeGenerationResult> {
  // Generate QR URL (no database counter required - QR works regardless)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://servio.uk";
  const qrUrl = `${baseUrl}/order?venue=${venueId}&counter=${encodeURIComponent(counterLabel)}`;

  return {
    success: true,
    qrCodes: [
      {
        id: `qr-${counterLabel}`,
        label: counterLabel,
        type: "counter",
        url: qrUrl,
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
      id: table.id,
      label: table.label,
      qrUrl: `${baseUrl}/order?venue=${venueId}&table=${encodeURIComponent(table.label)}`,
      status: "active",
    })) || [];

  const counterQRs =
    counters?.map((counter) => ({
      id: counter.id,
      label: counter.name,
      qrUrl: `${baseUrl}/order?venue=${venueId}&counter=${encodeURIComponent(counter.name)}`,
      status: "active",
    })) || [];

  return {
    tables: tableQRs,
    counters: counterQRs,
    summary: `Found ${tableQRs.length} table QR codes and ${counterQRs.length} counter QR codes.`,
  };
}

/**
 * Generate PDF export data for QR codes
 * Returns data that can be used to generate PDF
 */
export async function prepareQRCodePDFData(venueId: string): Promise<{
  success: boolean;
  data: {
    venueName: string;
    tables: Array<{ label: string; url: string }>;
    counters: Array<{ label: string; url: string }>;
  };
  message: string;
}> {
  const qrData = await listAllQRCodes(venueId);
  const supabase = createAdminClient();

  const { data: venue } = await supabase
    .from("venues")
    .select("venue_name")
    .eq("venue_id", venueId)
    .single();

  return {
    success: true,
    data: {
      venueName: venue?.venue_name || "Venue",
      tables: qrData.tables.map((t) => ({ label: t.label, url: t.qrUrl })),
      counters: qrData.counters.map((c) => ({ label: c.label, url: c.qrUrl })),
    },
    message: `QR code data prepared for PDF export. ${qrData.tables.length} tables and ${qrData.counters.length} counters ready to download.`,
  };
}
