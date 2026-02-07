/**
 * BulkExportDialog Component
 *
 * Dialog for configuring bulk export operations.
 */

import React, { useState } from "react";

export interface BulkExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: "menu_items" | "inventory_items" | "orders" | "tables";
  onExport: (format: "csv" | "json", filters?: Record<string, unknown>) => void;
}

export function BulkExportDialog({
  isOpen,
  onClose,
  entityType,
  onExport,
}: BulkExportDialogProps) {
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [includeFilters, setIncludeFilters] = useState(false);
  const [dateRange, setDateRange] = useState<"all" | "today" | "week" | "month">("all");

  if (!isOpen) return null;

  const handleExport = () => {
    const filters = includeFilters ? { dateRange } : undefined;
    onExport(format, filters);
    onClose();
  };

  const entityLabel = entityType.replace("_", " ");

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-medium">Export {entityLabel}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Export Format</label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="format"
                  value="csv"
                  checked={format === "csv"}
                  onChange={() => setFormat("csv")}
                  className="mr-2"
                />
                <span className="text-sm">CSV</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="format"
                  value="json"
                  checked={format === "json"}
                  onChange={() => setFormat("json")}
                  className="mr-2"
                />
                <span className="text-sm">JSON</span>
              </label>
            </div>
          </div>

          {entityType === "orders" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </div>
          )}

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={includeFilters}
              onChange={(e) => setIncludeFilters(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm text-gray-700">Apply filters</span>
          </label>

          <div className="p-3 bg-gray-50 rounded text-sm text-gray-600">
            {format === "csv"
              ? `Export ${entityLabel} to a CSV file that can be opened in Excel or Google Sheets.`
              : `Export ${entityLabel} to a JSON file for use in other applications.`}
          </div>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            Cancel
          </button>
          <button onClick={handleExport} className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
