// Servio AI Assistant - QR Code Management Tools
// Generate, manage, and export QR codes for tables and counters

import { createClient } from "@/lib/supabase";
import { aiLogger } from "@/lib/logger";

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
  const supabase = await createClient();

  aiLogger.info(`[AI QR] Generating QR code for table: ${tableLabel}`);

  // Check if table exists
  const { data: existingTable, error: fetchError } = await supabase
    .from("tables")
    .select("id, label, table_number, venue_id")
    .eq("venue_id", venueId)
    .eq("label", tableLabel)
    .eq("is_active", true)
    .maybeSingle();

  if (fetchError) {
    aiLogger.error("[AI QR] Error fetching table:", fetchError);
    throw new Error(`Failed to fetch table: ${fetchError.message}`);
  }

  // Get venue slug for URL
  const { data: venue } = await supabase
    .from("venues")
    .select("slug, venue_name")
    .eq("venue_id", venueId)
    .single();

  if (!venue) {
    throw new Error("Venue not found");
  }

  let tableId = existingTable?.id;
  let tableNumber = existingTable?.table_number;

  // If table doesn't exist, create it
  if (!existingTable) {
    // Extract table number from label (e.g., "Table 5" -> 5)
    const numberMatch = tableLabel.match(/\d+/);
    tableNumber = numberMatch ? parseInt(numberMatch[0]) : Math.floor(Math.random() * 1000);

    const { data: newTable, error: createError } = await supabase
      .from("tables")
      .insert({
        venue_id: venueId,
        label: tableLabel,
        table_number: tableNumber,
        seats: 4, // Default
        status: "available",
        is_active: true,
      })
      .select("id")
      .single();

    if (createError) {
      aiLogger.error("[AI QR] Error creating table:", createError);
      throw new Error(`Failed to create table: ${createError.message}`);
    }

    tableId = newTable.id;
    aiLogger.info(`[AI QR] Created new table: ${tableLabel}`);
  }

  // Generate QR URL
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://servio.uk";
  const qrUrl = `${baseUrl}/order?venue=${venue.slug}&table=${tableLabel}`;

  return {
    success: true,
    qrCodes: [
      {
        id: tableId,
        label: tableLabel,
        type: "table",
        url: qrUrl,
      },
    ],
    message: `QR code generated for ${tableLabel}. URL: ${qrUrl}`,
  };
}

/**
 * Generate QR codes for multiple tables in bulk
 */
export async function generateBulkTableQRCodes(
  venueId: string,
  startNumber: number,
  endNumber: number
): Promise<QRCodeGenerationResult> {
  const supabase = await createClient();

  aiLogger.info(`[AI QR] Generating bulk QR codes for tables ${startNumber}-${endNumber}`);

  if (startNumber < 1 || endNumber < startNumber || endNumber - startNumber > 100) {
    throw new Error("Invalid range. Please specify 1-100 tables.");
  }

  // Get venue slug
  const { data: venue } = await supabase
    .from("venues")
    .select("slug, venue_name")
    .eq("venue_id", venueId)
    .single();

  if (!venue) {
    throw new Error("Venue not found");
  }

  const qrCodes: QRCodeGenerationResult["qrCodes"] = [];
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://servio.uk";

  // Get existing tables to avoid duplicates
  const { data: existingTables } = await supabase
    .from("tables")
    .select("table_number, label, id")
    .eq("venue_id", venueId)
    .eq("is_active", true);

  const existingNumbers = new Set(existingTables?.map((t) => t.table_number) || []);

  // Create tables in batch
  const tablesToCreate = [];
  for (let i = startNumber; i <= endNumber; i++) {
    if (!existingNumbers.has(i)) {
      tablesToCreate.push({
        venue_id: venueId,
        label: `Table ${i}`,
        table_number: i,
        seats: 4,
        status: "available",
        is_active: true,
      });
    }
  }

  if (tablesToCreate.length > 0) {
    const { data: newTables, error: createError } = await supabase
      .from("tables")
      .insert(tablesToCreate)
      .select("id, label, table_number");

    if (createError) {
      aiLogger.error("[AI QR] Error creating tables:", createError);
      throw new Error(`Failed to create tables: ${createError.message}`);
    }

    // Add new tables to results
    newTables?.forEach((table) => {
      qrCodes.push({
        id: table.id,
        label: table.label,
        type: "table",
        url: `${baseUrl}/order?venue=${venue.slug}&table=${encodeURIComponent(table.label)}`,
      });
    });
  }

  // Add existing tables to results
  existingTables?.forEach((table) => {
    if (table.table_number >= startNumber && table.table_number <= endNumber) {
      qrCodes.push({
        id: table.id,
        label: table.label,
        type: "table",
        url: `${baseUrl}/order?venue=${venue.slug}&table=${encodeURIComponent(table.label)}`,
      });
    }
  });

  return {
    success: true,
    qrCodes: qrCodes.sort((a, b) => {
      const numA = parseInt(a.label.match(/\d+/)?.[0] || "0");
      const numB = parseInt(b.label.match(/\d+/)?.[0] || "0");
      return numA - numB;
    }),
    message: `Generated ${qrCodes.length} QR codes for tables ${startNumber}-${endNumber}. ${tablesToCreate.length} new tables created.`,
  };
}

/**
 * Generate QR code for counter orders
 */
export async function generateCounterQRCode(
  venueId: string,
  counterLabel: string
): Promise<QRCodeGenerationResult> {
  const supabase = await createClient();

  aiLogger.info(`[AI QR] Generating QR code for counter: ${counterLabel}`);

  // Get venue slug
  const { data: venue } = await supabase
    .from("venues")
    .select("slug, venue_name")
    .eq("venue_id", venueId)
    .single();

  if (!venue) {
    throw new Error("Venue not found");
  }

  // Check if counter exists
  const { data: existingCounter } = await supabase
    .from("counters")
    .select("id, name")
    .eq("venue_id", venueId)
    .eq("name", counterLabel)
    .maybeSingle();

  let counterId = existingCounter?.id;

  // Create counter if doesn't exist
  if (!existingCounter) {
    const { data: newCounter, error: createError } = await supabase
      .from("counters")
      .insert({
        venue_id: venueId,
        name: counterLabel,
        is_active: true,
      })
      .select("id")
      .single();

    if (createError) {
      aiLogger.error("[AI QR] Error creating counter:", createError);
      throw new Error(`Failed to create counter: ${createError.message}`);
    }

    counterId = newCounter.id;
    aiLogger.info(`[AI QR] Created new counter: ${counterLabel}`);
  }

  // Generate QR URL
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://servio.uk";
  const qrUrl = `${baseUrl}/order?venue=${venue.slug}&counter=${encodeURIComponent(counterLabel)}`;

  return {
    success: true,
    qrCodes: [
      {
        id: counterId,
        label: counterLabel,
        type: "counter",
        url: qrUrl,
      },
    ],
    message: `QR code generated for counter "${counterLabel}". URL: ${qrUrl}`,
  };
}

/**
 * List all QR codes for a venue
 */
export async function listAllQRCodes(venueId: string): Promise<QRCodeListResult> {
  const supabase = await createClient();

  aiLogger.info(`[AI QR] Listing all QR codes for venue: ${venueId}`);

  // Get venue slug
  const { data: venue } = await supabase
    .from("venues")
    .select("slug, venue_name")
    .eq("venue_id", venueId)
    .single();

  if (!venue) {
    throw new Error("Venue not found");
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://servio.uk";

  // Get all tables
  const { data: tables } = await supabase
    .from("tables")
    .select("id, label, status, is_active")
    .eq("venue_id", venueId)
    .eq("is_active", true)
    .order("table_number", { ascending: true });

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
      qrUrl: `${baseUrl}/order?venue=${venue.slug}&table=${encodeURIComponent(table.label)}`,
      status: table.status || "available",
    })) || [];

  const counterQRs =
    counters?.map((counter) => ({
      id: counter.id,
      label: counter.name,
      qrUrl: `${baseUrl}/order?venue=${venue.slug}&counter=${encodeURIComponent(counter.name)}`,
      status: "active",
    })) || [];

  return {
    tables: tableQRs,
    counters: counterQRs,
    summary: `Found ${tableQRs.length} table QR codes and ${counterQRs.length} counter QR codes for ${venue.venue_name}.`,
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
  const supabase = await createClient();

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
