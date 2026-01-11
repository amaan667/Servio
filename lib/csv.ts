/**
 * CSV Export Utility
 *
 * Provides a typed helper for generating CSV files from data arrays.
 * Handles proper escaping, BOM for UTF-8 compatibility, and null/undefined values.
 */

export interface CsvColumn<T extends Record<string, unknown>> {

}

/**
 * Converts an array of objects to CSV format
 *
 * @param rows - Array of objects to convert to CSV
 * @param columns - Column definitions with keys and headers
 * @param includeBOM - Whether to include UTF-8 BOM (default: true for Excel compatibility)
 * @returns CSV string
 *
 * @example
 * ```typescript
 * const data = [
 *   { name: "John", age: 30, city: "New York" },
 *   { name: "Jane", age: 25, city: "London" }
 * ];
 *
 * const csv = toCSV(data, [
 *   { key: 'name', header: 'Full Name' },
 *   { key: 'age', header: 'Age' },
 *   { key: 'city', header: 'City' }
 * ]);
 * ```
 */
export function toCSV<T extends Record<string, unknown>>(

  includeBOM = true
): string {
  if (!rows || rows.length === 0) {
    return includeBOM ? "\uFEFF" : "";
  }

  if (!columns || columns.length === 0) {
    throw new Error("Columns definition is required");
  }

  /**
   * Escapes a value for CSV format
   * - Wraps in quotes if contains comma, quote, or newline
   * - Escapes internal quotes by doubling them
   * - Handles null/undefined as empty string
   */
  const escape = (val: unknown): string => {
    // Handle null/undefined
    if (val == null) {
      return "";
    }

    // Convert to string
    let str = String(val);

    // Check if escaping is needed (contains comma, quote, or newline)
    if (/[",\n\r]/.test(str)) {
      // Escape quotes by doubling them, then wrap in quotes
      str = `"${str.replace(/"/g, '""')}"`;
    }

    return str;
  };

  // Generate header row
  const header = columns.map((col) => escape(col.header)).join(",");

  // Generate data rows
  const body = rows.map((row) => columns.map((col) => escape(row[col.key])).join(",")).join("\n");

  // Combine header and body
  const csv = `${header}\n${body}`;

  // Add BOM for UTF-8 compatibility if requested
  return includeBOM ? "\uFEFF" + csv : csv;
}

/**
 * Formats a date for CSV export
 * Uses ISO string format for consistency
 */
export function formatDateForCSV(date: string | Date): string {
  if (!date) return "";

  const dateObj = typeof date === "string" ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return "";
  }

  return dateObj.toISOString();
}

/**
 * Formats a currency value for CSV export
 * Removes currency symbols and formats to 2 decimal places
 */
export function formatCurrencyForCSV(value: number | string | null | undefined): string {
  if (value == null) return "";

  const num = typeof value === "string" ? parseFloat(value) : value;

  if (isNaN(num)) return "";

  return num.toFixed(2);
}

/**
 * Safely formats unknown value for CSV export
 * Handles various data types and edge cases
 */
export function formatValueForCSV(value: unknown): string {
  if (value == null) return "";

  if (typeof value === "number") {
    return value.toString();
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (value instanceof Date) {
    return formatDateForCSV(value);
  }

  return String(value);
}
