/**
 * Export Service
 * Provides functionality to export analytics data in various formats
 */

import { ExportFormat, GeneratedReport } from "@/lib/analytics/types";

export class ExportService {
  private static readonly CSV_BOM = "\uFEFF";

  /**
   * Export data to CSV format
   */
  static exportToCsv<T extends Record<string, unknown>>(
    data: T[],
    _filename: string,
    columns?: (keyof T)[]
  ): string {
    if (data.length === 0) {
      return "";
    }

    // Determine columns to export
    const keys = columns || (Object.keys(data[0] || {}) as (keyof T)[]);

    // Build CSV header
    const headers = keys.map((key) => this.escapeCsvCell(String(key))).join(",");

    // Build CSV rows
    const rows = data.map((row) =>
      keys
        .map((key) => {
          const value = row[key];
          return this.escapeCsvCell(this.formatCellValue(value));
        })
        .join(",")
    );

    // Combine and create blob
    const csv = [this.CSV_BOM, headers, ...rows].join("\n");
    return csv;
  }

  /**
   * Download data as CSV file
   */
  static downloadAsCsv<T extends Record<string, unknown>>(
    data: T[],
    filename: string,
    columns?: (keyof T)[]
  ): void {
    const csv = this.exportToCsv(data, filename, columns);
    this.downloadFile(csv, `${filename}.csv`, "text/csv;charset=utf-8;");
  }

  /**
   * Export report data to CSV
   */
  static exportReportToCsv(report: GeneratedReport, filename?: string): void {
    const data = report.data;
    const name = filename || `${report.type}_report`;

    // Add summary as first rows if available
    const summaryRows = Object.entries(report.summary).map(([key, value]) => ({
      [key]: value,
      _isSummary: "true",
    }));

    // Filter out summary columns from main data
    const cleanData = data.map((row) => {
      const clean: Record<string, unknown> = {};
      Object.entries(row).forEach(([key, value]) => {
        if (key !== "_isSummary") {
          clean[key] = value;
        }
      });
      return clean;
    });

    this.downloadAsCsv(cleanData, name);
  }

  /**
   * Export data to JSON format
   */
  static exportToJson<T>(data: T, _filename: string): string {
    return JSON.stringify(data, null, 2);
  }

  /**
   * Download data as JSON file
   */
  static downloadAsJson<T>(data: T, filename: string): void {
    const json = this.exportToJson(data, filename);
    this.downloadFile(json, `${filename}.json`, "application/json;charset=utf-8;");
  }

  /**
   * Generate HTML report
   */
  static generateHtmlReport(report: GeneratedReport): string {
    const styles = `
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .summary h2 { margin-top: 0; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #4CAF50; color: white; }
        tr:nth-child(even) { background-color: #f2f2f2; }
        .timestamp { color: #666; font-size: 12px; }
      </style>
    `;

    const summaryHtml = Object.entries(report.summary)
      .map(([key, value]) => `<p><strong>${this.formatTitle(key)}:</strong> ${value}</p>`)
      .join("");

    const tableHeaders =
      report.data && report.data.length > 0 ? Object.keys(report.data[0] || {}) : [];
    const tableRows = report.data
      .map((row) => `<tr>${tableHeaders.map((header) => `<td>${row[header]}</td>`).join("")}</tr>`)
      .join("");

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${this.formatTitle(report.type)} Report</title>
          ${styles}
        </head>
        <body>
          <h1>${this.formatTitle(report.type)} Report</h1>
          <p class="timestamp">Generated: ${new Date(report.generatedAt).toLocaleString()}</p>
          <div class="summary">
            <h2>Summary</h2>
            ${summaryHtml}
          </div>
          ${
            tableHeaders.length > 0
              ? `
            <table>
              <thead>
                <tr>${tableHeaders.map((h) => `<th>${this.formatTitle(h)}</th>`).join("")}</tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
          `
              : ""
          }
        </body>
      </html>
    `;
  }

  /**
   * Download report as HTML
   */
  static downloadReportAsHtml(report: GeneratedReport, filename?: string): void {
    const html = this.generateHtmlReport(report);
    const name = filename || `${report.type}_report`;
    this.downloadFile(html, `${name}.html`, "text/html;charset=utf-8;");
  }

  /**
   * Get export format from file extension
   */
  static getFormatFromFilename(filename: string): ExportFormat {
    const ext = filename.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "csv":
        return "csv";
      case "xlsx":
      case "xls":
        return "excel";
      case "pdf":
        return "pdf";
      default:
        return "csv";
    }
  }

  /**
   * Export report in specified format
   */
  static exportReport(
    report: GeneratedReport,
    format: ExportFormat = "csv",
    filename?: string
  ): void {
    switch (format) {
      case "csv":
        this.exportReportToCsv(report, filename);
        break;
      case "excel":
        // For Excel, we use CSV as a fallback (would need library like xlsx for true Excel)
        this.exportReportToCsv(report, filename);
        break;
      case "pdf":
        // For PDF, we use HTML as a fallback (would need library like jsPDF for true PDF)
        this.downloadReportAsHtml(report, filename);
        break;
    }
  }

  // ========================================
  // HELPER METHODS
  // ========================================

  /**
   * Escape special characters for CSV
   */
  private static escapeCsvCell(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Format cell value for CSV
   */
  private static formatCellValue(value: unknown): string {
    if (value === null || value === undefined) {
      return "";
    }
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return String(value);
  }

  /**
   * Format title from snake_case or camelCase
   */
  private static formatTitle(text: string): string {
    return text
      .replace(/_/g, " ")
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  /**
   * Trigger file download
   */
  private static downloadFile(content: string, filename: string, mimeType: string): void {
    if (typeof window === "undefined") {
      return; // Server-side guard
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

/**
 * Download CSV helper for direct data export
 */
export function downloadCsv<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  columns?: (keyof T)[]
): void {
  ExportService.downloadAsCsv(data, filename, columns);
}

/**
 * Download report helper
 */
export function downloadReport(
  report: GeneratedReport,
  format: ExportFormat = "csv",
  filename?: string
): void {
  ExportService.exportReport(report, format, filename);
}
