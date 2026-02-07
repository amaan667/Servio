/**
 * Bulk Import Service
 *
 * Provides CSV and Excel import functionality with validation,
 * preview support, and staged imports.
 */

import {
  BulkImportOptions,
  BulkImportInput,
  BulkOperationResult,
  ValidationError,
  ProgressCallback,
} from "../bulk-operations/types";
import { bulkOperationsService } from "./BulkOperationsService";
import { logger } from "@/lib/monitoring/structured-logger";
import { z } from "zod";

export interface ParsedRow {
  rowNumber: number;
  data: Record<string, string>;
  isValid: boolean;
  errors: string[];
}

export interface ImportPreviewResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  preview: ParsedRow[];
  suggestedMappings: Record<string, string>;
  columnAnalysis: ColumnAnalysis[];
}

export interface ColumnAnalysis {
  columnName: string;
  sampleValues: string[];
  detectedType: "string" | "number" | "boolean" | "date" | "email" | "unknown";
  confidence: number;
  suggestedField: string;
}

export interface ImportTemplate {
  name: string;
  entityType: string;
  columns: TemplateColumn[];
  sampleData: Record<string, unknown>[];
  description: string;
}

export interface TemplateColumn {
  field: string;
  header: string;
  required: boolean;
  type: "string" | "number" | "boolean" | "date" | "email" | "select";
  options?: string[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
  description?: string;
}

export interface ImportErrorReport {
  totalErrors: number;
  errorsByField: Record<string, number>;
  sampleErrors: Array<{
    row: number;
    field: string;
    value: string;
    message: string;
  }>;
}

export interface StagedImportState {
  previewId: string;
  entityType: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  parsedData: Record<string, unknown>[];
  columnMapping: Record<string, string>;
  options: BulkImportOptions;
  createdAt: string;
  expiresAt: string;
}

export class BulkImportService {
  private progressCallback?: ProgressCallback;

  setProgressCallback(callback: ProgressCallback): void {
    this.progressCallback = callback;
    bulkOperationsService.setProgressCallback(callback);
  }

  parseCSV(csvContent: string): ParsedRow[] {
    const lines = csvContent.trim().split("\n");
    if (lines.length < 2) {
      throw new Error("CSV must have at least a header row and one data row");
    }

    const headers = this.parseCSVLine(lines[0] || "");
    const rows: ParsedRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i] || "");
      const rowData: Record<string, string> = {};

      headers.forEach((header, index) => {
        rowData[header] = values[index] || "";
      });

      rows.push({
        rowNumber: i,
        data: rowData,
        isValid: true,
        errors: [],
      });
    }

    return rows;
  }

  private parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  }

  analyzeColumns(rows: ParsedRow[]): ColumnAnalysis[] {
    if (rows.length === 0) return [];

    const headers = Object.keys(rows[0]?.data || {});
    const analysis: ColumnAnalysis[] = [];

    headers.forEach((header) => {
      const sampleValues = rows.slice(0, 10).map((row) => row.data[header]).filter((v): v is string => Boolean(v));
      const detectedType = this.detectValueType(sampleValues);
      const suggestedField = this.suggestFieldMapping(header, detectedType);

      analysis.push({
        columnName: header,
        sampleValues,
        detectedType,
        confidence: sampleValues.length > 0 ? 0.8 : 0,
        suggestedField,
      });
    });

    return analysis;
  }

  private detectValueType(values: string[]): "string" | "number" | "boolean" | "date" | "email" | "unknown" {
    if (values.length === 0) return "string";

    const validValues = values.filter(Boolean);
    if (validValues.length === 0) return "string";

    const numbers = validValues.filter((v) => !isNaN(parseFloat(v)) && isFinite(Number(v)));
    if (numbers.length === validValues.length) return "number";

    const booleans = validValues.filter(
      (v) => v.toLowerCase() === "true" || v.toLowerCase() === "false" || v === "1" || v === "0"
    );
    if (booleans.length === validValues.length) return "boolean";

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emails = validValues.filter((v) => emailRegex.test(v));
    if (emails.length === validValues.length) return "email";

    const dates = validValues.filter((v) => {
      const date = new Date(v);
      return !isNaN(date.getTime());
    });
    if (dates.length === validValues.length && validValues.length > 0) return "date";

    return "string";
  }

  private suggestFieldMapping(
    columnName: string,
    detectedType: "string" | "number" | "boolean" | "date" | "email" | "unknown"
  ): string {
    const normalized = columnName.toLowerCase().replace(/[^a-z0-9]/g, "_");

    if (["name", "item_name", "menu_item", "product_name"].some((p) => normalized.includes(p))) {
      return "name";
    }

    if (["price", "cost", "amount", "rate"].some((p) => normalized.includes(p)) && detectedType === "number") {
      return "price";
    }

    if (["category", "type", "group"].some((p) => normalized.includes(p))) {
      return "category";
    }

    if (["description", "desc", "notes"].some((p) => normalized.includes(p))) {
      return "description";
    }

    if (["quantity", "qty", "count", "amount"].some((p) => normalized.includes(p)) && detectedType === "number") {
      return "quantity";
    }

    if (["sku", "code", "item_code"].some((p) => normalized.includes(p))) {
      return "sku";
    }

    if (["unit", "uom", "measure"].some((p) => normalized.includes(p))) {
      return "unit";
    }

    return normalized;
  }

  async generatePreview(
    csvContent: string,
    _entityType: string,
    columnMapping: Record<string, string> = {}
  ): Promise<ImportPreviewResult> {
    const rows = this.parseCSV(csvContent);
    const columnAnalysis = this.analyzeColumns(rows);

    const mappedRows = rows.map((row) => ({
      ...row,
      mappedData: this.applyMapping(row.data, columnMapping),
    }));

    const validRows = mappedRows.filter((r) => r.isValid).length;
    const invalidRows = mappedRows.filter((r) => !r.isValid).length;

    const suggestedMappings: Record<string, string> = {};
    columnAnalysis.forEach((col) => {
      suggestedMappings[col.columnName] = col.suggestedField;
    });

    return {
      totalRows: rows.length,
      validRows,
      invalidRows,
      preview: mappedRows.slice(0, 10),
      suggestedMappings,
      columnAnalysis,
    };
  }

  private applyMapping(
    data: Record<string, string>,
    mapping: Record<string, string>
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    Object.entries(data).forEach(([key, value]) => {
      const mappedKey = mapping[key] || key;
      result[mappedKey] = this.parseValue(value);
    });

    return result;
  }

  private parseValue(value: string): unknown {
    if (!value || value.trim() === "") return null;

    if (!isNaN(Number(value)) && value.includes(".")) {
      return parseFloat(value);
    }
    if (!isNaN(Number(value))) {
      return parseInt(value, 10);
    }

    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;

    return value;
  }

  validateMappedData(
    data: Record<string, unknown>[],
    entityType: string
  ): { valid: boolean; errors: ValidationError[]; validData: Record<string, unknown>[] } {
    const errors: ValidationError[] = [];
    const validData: Record<string, unknown>[] = [];

    const validators: Record<string, z.ZodSchema> = {
      menu_items: z.object({
        name: z.string().min(1, "Name is required"),
        name_en: z.string().optional(),
        price: z.number().min(0, "Price must be non-negative").optional(),
        category: z.string().optional(),
        description: z.string().optional(),
        is_available: z.boolean().optional(),
      }),
      inventory_items: z.object({
        name: z.string().min(1, "Name is required"),
        sku: z.string().optional(),
        unit: z.string().min(1, "Unit is required"),
        on_hand: z.number().min(0).optional(),
        cost_per_unit: z.number().min(0).optional(),
      }),
      orders: z.object({
        customer_name: z.string().min(1, "Customer name is required"),
        customer_phone: z.string().optional(),
        items: z.array(z.object({
          name: z.string(),
          quantity: z.number(),
          price: z.number(),
        })).optional(),
        total_amount: z.number().min(0).optional(),
      }),
      tables: z.object({
        table_number: z.string().min(1, "Table number is required"),
        seat_count: z.number().min(1).optional(),
        status: z.string().optional(),
      }),
    };

    const validator = validators[entityType];
    if (!validator) {
      return { valid: true, errors: [], validData: data };
    }

    data.forEach((item, index) => {
      const result = validator.safeParse(item);
      if (!result.success) {
        result.error.errors.forEach((err) => {
          errors.push({
            field: err.path.join("."),
            message: err.message,
            row: index + 1,
          });
        });
      } else {
        validData.push(result.data);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      validData,
    };
  }

  async executeStagedImport(
    venueId: string,
    userId: string,
    csvContent: string,
    entityType: string,
    columnMapping: Record<string, string>,
    options: BulkImportOptions
  ): Promise<BulkOperationResult> {
    logger.info("[BulkImport] Starting staged import", {
      venueId,
      entityType,
      options,
    });

    const rows = this.parseCSV(csvContent);
    const parsedData = rows.map((row) => this.applyMapping(row.data, columnMapping));

    if (options.previewFirst) {
      const preview = await this.generatePreview(csvContent, entityType, columnMapping);
      logger.info("[BulkImport] Preview results", {
        totalRows: preview.totalRows,
        validRows: preview.validRows,
        invalidRows: preview.invalidRows,
      });

      return {
        operationId: "",
        type: "bulk_import",
        entityType,
        total: preview.totalRows,
        successful: preview.validRows,
        failed: preview.invalidRows,
        skipped: 0,
        results: [],
        validationErrors: preview.preview.flatMap((p) =>
          p.errors.map((e) => ({ field: e, message: e, row: p.rowNumber }))
        ),
        status: "pending",
        elapsedMs: 0,
        rollbackPerformed: false,
        warnings: ["Preview mode - data not committed. Confirm to proceed."],
      };
    }

    const { valid, errors, validData } = this.validateMappedData(parsedData, entityType);

    if (!valid && errors.length > 0) {
      logger.warn("[BulkImport] Validation errors", { errorCount: errors.length });
    }

    const result = await bulkOperationsService.executeBulkOperation({
      type: "bulk_import",
      venueId,
      userId,
      items: validData,
      options,
    } as unknown as BulkImportInput<Record<string, unknown>>);

    return result;
  }

  generateTemplate(_entityType: string): ImportTemplate {
    const templates: Record<string, ImportTemplate> = {
      menu_items: {
        name: "Menu Items Import Template",
        entityType: "menu_items",
        description: "Template for importing menu items with name, price, and category",
        columns: [
          { field: "name_en", header: "Name", required: true, type: "string", description: "Item name in English" },
          { field: "name_ar", header: "Arabic Name", required: false, type: "string", description: "Item name in Arabic" },
          { field: "description_en", header: "Description", required: false, type: "string" },
          { field: "price", header: "Price", required: true, type: "number", validation: { min: 0 } },
          { field: "category", header: "Category", required: false, type: "string" },
          { field: "is_available", header: "Available", required: false, type: "boolean" },
        ],
        sampleData: [
          { name_en: "Burger", price: 12.99, category: "Main Course", is_available: true },
          { name_en: "Fries", price: 4.99, category: "Sides", is_available: true },
        ],
      },
      inventory_items: {
        name: "Inventory Items Import Template",
        entityType: "inventory_items",
        description: "Template for importing inventory ingredients",
        columns: [
          { field: "name", header: "Name", required: true, type: "string" },
          { field: "sku", header: "SKU", required: false, type: "string" },
          { field: "unit", header: "Unit", required: true, type: "string", options: ["kg", "lbs", "oz", "g", "l", "ml", "pcs"] },
          { field: "on_hand", header: "On Hand", required: false, type: "number", validation: { min: 0 } },
          { field: "cost_per_unit", header: "Cost Per Unit", required: false, type: "number", validation: { min: 0 } },
          { field: "par_level", header: "Par Level", required: false, type: "number", validation: { min: 0 } },
          { field: "supplier", header: "Supplier", required: false, type: "string" },
        ],
        sampleData: [
          { name: "Tomatoes", sku: "TOM-001", unit: "kg", on_hand: 50, cost_per_unit: 2.5, par_level: 100 },
          { name: "Olive Oil", sku: "OIL-001", unit: "l", on_hand: 10, cost_per_unit: 15, par_level: 20 },
        ],
      },
      tables: {
        name: "Tables Import Template",
        entityType: "tables",
        description: "Template for importing tables",
        columns: [
          { field: "table_number", header: "Table Number", required: true, type: "string" },
          { field: "label", header: "Label", required: false, type: "string" },
          { field: "seat_count", header: "Seat Count", required: false, type: "number", validation: { min: 1, max: 20 } },
          { field: "status", header: "Status", required: false, type: "string", options: ["available", "occupied", "reserved"] },
        ],
        sampleData: [
          { table_number: "1", label: "Window Seat", seat_count: 2, status: "available" },
          { table_number: "2", label: "Center", seat_count: 4, status: "available" },
        ],
      },
    };

    return templates.menu_items!;
  }

  generateTemplateCSV(entityType: string): string {
    const template = this.generateTemplate(entityType);
    const headers = template.columns.map((col) => col.header);
    const rows = template.sampleData.map((data) =>
      template.columns.map((col) => {
        const value = data[col.field as keyof typeof data];
        if (typeof value === "boolean") return value ? "true" : "false";
        return String(value || "");
      }).join(",")
    );

    return [headers.join(","), ...rows].join("\n");
  }

  generateErrorReport(errors: ValidationError[]): ImportErrorReport {
    const errorsByField: Record<string, number> = {};
    const sampleErrors: Array<{ row: number; field: string; value: string; message: string }> = [];

    errors.forEach((error) => {
      errorsByField[error.field] = (errorsByField[error.field] || 0) + 1;

      if (sampleErrors.length < 20) {
        sampleErrors.push({
          row: error.row || 0,
          field: error.field,
          value: String(error.value || ""),
          message: error.message,
        });
      }
    });

    return {
      totalErrors: errors.length,
      errorsByField,
      sampleErrors,
    };
  }
}

export const bulkImportService = new BulkImportService();
