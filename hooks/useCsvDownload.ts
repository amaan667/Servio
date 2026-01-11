/**
 * CSV Download Hook
 *
 * Provides functionality to download CSV files from the browser.
 * Handles blob creation, temporary anchor elements, and cleanup.
 */

import { useState, useCallback } from "react";

export interface CsvDownloadOptions {

}

/**
 * Downloads a CSV file to the user's device
 *
 * @param options - Download options containing filename and CSV content
 *
 * @example
 * ```typescript
 * downloadCSV({
 *   filename: 'analytics-2024-01-15.csv',
 *   csv: 'Name,Age\nJohn,30\nJane,25'
 * });
 * ```
 */
export function downloadCSV({ filename, csv }: CsvDownloadOptions): void {
  try {
    // Validate inputs
    if (!filename || !csv) {
      
      return;
    }

    // Ensure filename has .csv extension
    const sanitizedFilename = filename.endsWith(".csv") ? filename : `${filename}.csv`;

    // Create blob with CSV content and UTF-8 encoding
    const blob = new Blob([csv], {

    // Create temporary URL for the blob
    const url = URL.createObjectURL(blob);

    // Create temporary anchor element
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = sanitizedFilename;
    anchor.style.display = "none";

    // Add to DOM, trigger download, then remove
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    // Clean up the URL object
    URL.revokeObjectURL(url);
  } catch (_error) {
    

    // Fallback: try to open in new window (may not work in all browsers)
    try {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      // Note: We don't revoke this URL immediately as the new window might need it
      // It will be garbage collected when the window closes
    } catch (fallbackError) {
      
    }
  }
}

/**
 * Generates a timestamped filename for CSV exports
 *
 * @param prefix - Filename prefix (e.g., 'servio-analytics')
 * @param date - Optional date to use (defaults to current date)
 * @returns Formatted filename string
 */
export function generateTimestampedFilename(prefix: string, date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${prefix}-${year}-${month}-${day}.csv`;
}

/**
 * React hook for CSV download functionality
 * Provides download function and loading state
 */
export function useCsvDownload() {
  const [isDownloading, setIsDownloading] = useState(false);

  const download = useCallback((options: CsvDownloadOptions) => {
    setIsDownloading(true);

    try {
      downloadCSV(options);
    } finally {
      // Reset loading state after a short delay to show feedback
      setTimeout(() => {
        setIsDownloading(false);
      }, 1000);
    }
  }, []);

  return {

    isDownloading,
  };
}
