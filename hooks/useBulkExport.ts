/**
 * useBulkExport Hook
 *
 * React hook for exporting data in bulk (CSV, JSON, Excel).
 */

import { useState, useCallback } from "react";
import { downloadCSV, generateTimestampedFilename } from "./useCsvDownload";

export interface UseBulkExportOptions {
  venueId: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export interface UseBulkExportReturn {
  isLoading: boolean;
  isExporting: boolean;
  error: Error | null;
  exportMenuItems: (format?: "csv" | "json") => Promise<void>;
  exportInventory: (format?: "csv" | "json") => Promise<void>;
  exportOrders: (format?: "csv" | "json", filters?: Record<string, unknown>) => Promise<void>;
  exportTables: (format?: "csv" | "json") => Promise<void>;
}

export function useBulkExport(options: UseBulkExportOptions): UseBulkExportReturn {
  const { venueId, onSuccess, onError } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const exportData = useCallback(
    async (
      entityType: string,
      format: "csv" | "json" = "csv",
      filters?: Record<string, unknown>
    ): Promise<void> => {
      setIsLoading(true);
      setIsExporting(true);
      setError(null);

      try {
        const response = await fetch("/api/bulk/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            venueId,
            entityType,
            format,
            filters,
            generateTemplate: false,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Export failed");
        }

        const data = await response.json();

        if (format === "csv" && data.data) {
          const csv = convertToCSV(data.data);
          const filename = generateTimestampedFilename(`${entityType}_export`);
          downloadCSV({ filename, csv });
        } else if (format === "json" && data.data) {
          const json = JSON.stringify(data.data, null, 2);
          const filename = generateTimestampedFilename(`${entityType}_export`).replace(
            ".csv",
            ".json"
          );
          downloadCSV({ filename, csv: json });
        }

        onSuccess?.();
      } catch (err) {
        const exportError = err instanceof Error ? err : new Error(String(err));
        setError(exportError);
        onError?.(exportError);
      } finally {
        setIsLoading(false);
        setIsExporting(false);
      }
    },
    [venueId, onSuccess, onError]
  );

  const exportMenuItems = useCallback(
    async (format?: "csv" | "json"): Promise<void> => {
      return exportData("menu_items", format);
    },
    [exportData]
  );

  const exportInventory = useCallback(
    async (format?: "csv" | "json"): Promise<void> => {
      return exportData("inventory_items", format);
    },
    [exportData]
  );

  const exportOrders = useCallback(
    async (format?: "csv" | "json", filters?: Record<string, unknown>): Promise<void> => {
      return exportData("orders", format, filters);
    },
    [exportData]
  );

  const exportTables = useCallback(
    async (format?: "csv" | "json"): Promise<void> => {
      return exportData("tables", format);
    },
    [exportData]
  );

  return {
    isLoading,
    isExporting,
    error,
    exportMenuItems,
    exportInventory,
    exportOrders,
    exportTables,
  };
}

/**
 * Convert data array to CSV
 */
function convertToCSV(data: Record<string, unknown>[]): string {
  if (!data || data.length === 0) return "";

  const headers = Object.keys(data[0] as object);
  const rows = data.map((row) =>
    headers
      .map((header) => {
        const value = row[header];
        if (value === null || value === undefined) return "";
        if (
          typeof value === "string" &&
          (value.includes(",") || value.includes('"') || value.includes("\n"))
        ) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return String(value);
      })
      .join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}
