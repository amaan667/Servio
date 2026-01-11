// Servio AI Assistant - QR Code Tool Executors

import { AIExecutionResult, AIPreviewDiff, AIAssistantError } from "@/types/ai-assistant";
import {
  generateTableQRCode,
  generateBulkTableQRCodes,
  generateCounterQRCode,
  listAllQRCodes,
  prepareQRCodePDFData,
} from "../tools/qr-tools";

/**
 * Execute QR code generation for a single table
 */
export async function executeQRGenerateTable(
  params: { tableLabel: string },
  venueId: string,
  _userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  // Validate required parameters
  if (!params.tableLabel || params.tableLabel.trim() === "") {
    throw new AIAssistantError(
      "Table label is required. Please specify a name for the table (e.g., 'Table 5' or 'VIP 3').",
      "INVALID_PARAMS"
    );
  }

  // Normalize table label: ensure proper capitalization
  let normalizedLabel = params.tableLabel.trim();
  // If it starts with "table" (case-insensitive), capitalize it properly
  if (normalizedLabel.toLowerCase().startsWith("table ")) {
    const number = normalizedLabel.substring(6).trim();
    normalizedLabel = `Table ${number}`;
  } else if (normalizedLabel.toLowerCase().startsWith("vip ")) {
    const number = normalizedLabel.substring(4).trim();
    normalizedLabel = `VIP ${number}`;
  } else if (!normalizedLabel.match(/^[A-Z]/)) {
    // If it doesn't start with capital, capitalize first letter
    normalizedLabel = normalizedLabel.charAt(0).toUpperCase() + normalizedLabel.slice(1);
  }

  if (preview) {
    return {
      toolName: "qr.generate_table",
      before: [],
      after: [{ label: normalizedLabel, type: "table" }],
      impact: {
        itemsAffected: 1,
        description: `Will generate QR code for ${normalizedLabel}`,
      },
    };
  }

  const result = await generateTableQRCode(venueId, normalizedLabel);

  return {
    success: true,
    toolName: "qr.generate_table",
    result: {
      qrCode: result.qrCodes[0],
      message: result.message,
      tableLabel: normalizedLabel, // Pass normalized table label for navigation
      navigateTo: `/dashboard/${venueId}/qr-codes?table=${encodeURIComponent(normalizedLabel)}`,
      table: normalizedLabel, // Pass table name for navigation tool
    },
    auditId: "",
  };
}

/**
 * Execute bulk QR code generation for tables
 */
export async function executeQRGenerateBulk(
  params: { startNumber: number; endNumber: number; prefix: string | null; type: "table" | "counter" | null },
  venueId: string,
  _userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  const prefix = params.prefix || (params.type === "counter" ? "Counter" : "Table");
  const type = params.type || "table";
  
  if (preview) {
    const count = params.endNumber - params.startNumber + 1;
    return {
      toolName: "qr.generate_bulk",
      before: [],
      after: Array.from({ length: Math.min(count, 5) }, (_, i) => ({
        label: `${prefix} ${params.startNumber + i}`,
      })),
      impact: {
        itemsAffected: count,
        description: `Will generate ${count} QR codes for ${prefix} ${params.startNumber}-${params.endNumber}`,
      },
    };
  }

  const result = await generateBulkTableQRCodes(venueId, params.startNumber, params.endNumber, prefix, type);

  return {
    success: true,
    toolName: "qr.generate_bulk",
    result: {
      count: result.qrCodes.length,
      qrCodes: result.qrCodes,
      message: result.message,
      prefix,
      type,
      navigateTo: `/dashboard/${venueId}/qr-codes?bulkPrefix=${encodeURIComponent(prefix)}&bulkCount=${result.qrCodes.length}&bulkType=${type}`,
    },
    auditId: "",
  };
}

/**
 * Execute counter QR code generation
 */
export async function executeQRGenerateCounter(
  params: { counterLabel: string },
  venueId: string,
  _userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  // Validate required parameters
  if (!params.counterLabel || params.counterLabel.trim() === "") {
    throw new AIAssistantError(
      "Counter label is required. Please specify a name for the counter (e.g., 'Counter 1' or 'Takeaway Counter').",
      "INVALID_PARAMS"
    );
  }

  if (preview) {
    return {
      toolName: "qr.generate_counter",
      before: [],
      after: [{ label: params.counterLabel, type: "counter" }],
      impact: {
        itemsAffected: 1,
        description: `Will generate QR code for counter "${params.counterLabel}"`,
      },
    };
  }

  const result = await generateCounterQRCode(venueId, params.counterLabel);

  return {
    success: true,
    toolName: "qr.generate_counter",
    result: {
      qrCode: result.qrCodes[0],
      message: result.message,
      counterLabel: params.counterLabel, // Pass counter label for navigation
      navigateTo: `/dashboard/${venueId}/qr-codes?counter=${encodeURIComponent(params.counterLabel)}`,
      counter: params.counterLabel, // Pass counter name for navigation tool
    },
    auditId: "",
  };
}

/**
 * Execute QR code listing
 */
export async function executeQRList(
  _params: Record<string, never>,
  venueId: string,
  _userId: string,
  _preview: boolean
): Promise<AIExecutionResult> {
  const result = await listAllQRCodes(venueId);

  return {
    success: true,
    toolName: "qr.list_all",
    result: {
      tables: result.tables,
      counters: result.counters,
      summary: result.summary,
    },
    auditId: "",
  };
}

/**
 * Execute QR code PDF export preparation
 */
export async function executeQRExportPDF(
  _params: Record<string, never>,
  venueId: string,
  _userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  if (preview) {
    const data = await listAllQRCodes(venueId);
    return {
      toolName: "qr.export_pdf",
      before: [],
      after: [],
      impact: {
        itemsAffected: data.tables.length + data.counters.length,
        description: `Will prepare PDF with ${data.tables.length} table QR codes and ${data.counters.length} counter QR codes`,
      },
    };
  }

  const result = await prepareQRCodePDFData(venueId);

  return {
    success: true,
    toolName: "qr.export_pdf",
    result: {
      data: result.data,
      message: result.message,
    },
    auditId: "",
  };
}
