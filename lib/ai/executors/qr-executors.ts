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

      after: [{ label: normalizedLabel, type: "table" }],

        description: `Will generate QR code for ${normalizedLabel}`,
      },
    };
  }

  const result = await generateTableQRCode(venueId, normalizedLabel);

  return {

      tableLabel: normalizedLabel, // Pass normalized table label for navigation
      navigateTo: `/dashboard/${venueId}/qr-codes?table=${encodeURIComponent(normalizedLabel)}`,
      table: normalizedLabel, // Pass table name for navigation tool
    },

  };
}

/**
 * Execute bulk QR code generation for tables
 */
export async function executeQRGenerateBulk(
  params: { startNumber: number; endNumber: number; prefix: string | null; type: "table" | "counter" | null },

      after: Array.from({ length: Math.min(count, 5) }, (_, i) => ({
        label: `${prefix} ${params.startNumber + i}`,
      })),

        description: `Will generate ${count} QR codes for ${prefix} ${params.startNumber}-${params.endNumber}`,
      },
    };
  }

  const result = await generateBulkTableQRCodes(venueId, params.startNumber, params.endNumber, prefix, type);

  return {

      prefix,
      type,
      navigateTo: `/dashboard/${venueId}/qr-codes?bulkPrefix=${encodeURIComponent(prefix)}&bulkCount=${result.qrCodes.length}&bulkType=${type}`,
    },

  };
}

/**
 * Execute counter QR code generation
 */
export async function executeQRGenerateCounter(
  params: { counterLabel: string },

      "Counter label is required. Please specify a name for the counter (e.g., 'Counter 1' or 'Takeaway Counter').",
      "INVALID_PARAMS"
    );
  }

  if (preview) {
    return {

      after: [{ label: params.counterLabel, type: "counter" }],

        description: `Will generate QR code for counter "${params.counterLabel}"`,
      },
    };
  }

  const result = await generateCounterQRCode(venueId, params.counterLabel);

  return {

      counterLabel: params.counterLabel, // Pass counter label for navigation
      navigateTo: `/dashboard/${venueId}/qr-codes?counter=${encodeURIComponent(params.counterLabel)}`,
      counter: params.counterLabel, // Pass counter name for navigation tool
    },

  };
}

/**
 * Execute QR code listing
 */
export async function executeQRList(
  _params: Record<string, never>,

    },

  };
}

/**
 * Execute QR code PDF export preparation
 */
export async function executeQRExportPDF(
  _params: Record<string, never>,

        description: `Will prepare PDF with ${data.tables.length} table QR codes and ${data.counters.length} counter QR codes`,
      },
    };
  }

  const result = await prepareQRCodePDFData(venueId);

  return {

    },

  };
}
