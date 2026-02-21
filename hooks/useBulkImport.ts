/**
 * useBulkImport Hook
 *
 * React hook for importing data from CSV/Excel files with validation,
 * preview support, and staged imports.
 */

import { useState, useCallback } from "react";
import { BulkOperationResult } from "@/lib/bulk-operations/types";
import { bulkImportService } from "@/lib/services/BulkImportService";

export interface UseBulkImportOptions {
  venueId: string;
  entityType: "menu_items" | "inventory_items" | "tables" | "orders";
  onSuccess?: (result: BulkOperationResult) => void;
  onError?: (error: Error) => void;
}

export interface ImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  sampleErrors: Array<{ row: number; field: string; message: string }>;
  columnMapping: Record<string, string>;
}

export interface UseBulkImportReturn {
  isLoading: boolean;
  isPreview: boolean;
  preview: ImportPreview | null;
  progress: { completed: number; total: number; percent: number } | null;
  result: BulkOperationResult | null;
  error: Error | null;
  parseCSV: (csvContent: string) => Promise<ImportPreview | null>;
  importData: (
    columnMapping: Record<string, string>,
    options?: { previewFirst?: boolean }
  ) => Promise<BulkOperationResult | null>;
  downloadTemplate: () => void;
  reset: () => void;
}

export function useBulkImport(options: UseBulkImportOptions): UseBulkImportReturn {
  const { venueId, entityType, onSuccess, onError } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [isPreview, setIsPreview] = useState(true);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [progress, setProgress] = useState<{
    completed: number;
    total: number;
    percent: number;
  } | null>(null);
  const [result, setResult] = useState<BulkOperationResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [csvContent, setCsvContent] = useState<string>("");

  const parseCSV = useCallback(
    async (content: string): Promise<ImportPreview | null> => {
      setIsLoading(true);
      setError(null);
      setCsvContent(content);

      try {
        const previewResult = await bulkImportService.generatePreview(content, entityType, {});

        setPreview({
          totalRows: previewResult.totalRows,
          validRows: previewResult.validRows,
          invalidRows: previewResult.invalidRows,
          sampleErrors: previewResult.preview
            .filter((r) => !r.isValid)
            .flatMap((r) => r.errors.map((e) => ({ row: r.rowNumber, field: e, message: e })))
            .slice(0, 10),
          columnMapping: previewResult.suggestedMappings,
        });
        setIsPreview(true);
        return preview;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [entityType, onError]
  );

  const importData = useCallback(
    async (
      _columnMapping: Record<string, string>,
      _opts?: { previewFirst?: boolean }
    ): Promise<BulkOperationResult | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/bulk/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            venueId,
            entityType,
            format: "csv",
            generateTemplate: false,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Import failed");
        }

        const data = await response.json();
        setResult(data);
        setIsPreview(false);
        onSuccess?.(data);
        return data;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [venueId, entityType, onSuccess, onError]
  );

  const downloadTemplate = useCallback(() => {
    const template = bulkImportService.generateTemplateCSV(entityType);
    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${entityType}_template.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [entityType]);

  const reset = useCallback(() => {
    setIsLoading(false);
    setIsPreview(true);
    setPreview(null);
    setProgress(null);
    setResult(null);
    setError(null);
    setCsvContent("");
  }, []);

  return {
    isLoading,
    isPreview,
    preview,
    progress,
    result,
    error,
    parseCSV,
    importData,
    downloadTemplate,
    reset,
  };
}
