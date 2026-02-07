/**
 * BulkActionsToolbar Component
 *
 * Toolbar for bulk selections with common actions like delete, export, update status.
 */

import React, { useState } from "react";

export interface BulkActionsToolbarProps {
  /** Selected item IDs */
  selectedIds: string[];
  /** Total available items */
  totalItems: number;
  /** Entity type */
  entityType: "menu_items" | "inventory_items" | "orders" | "tables";
  /** Callback when selection changes */
  onSelectionChange: (ids: string[]) => void;
  /** Callback for delete action */
  onDelete?: (ids: string[]) => void;
  /** Callback for export action */
  onExport?: (ids: string[]) => void;
  /** Callback for status update action */
  onStatusUpdate?: (ids: string[], newStatus: string) => void;
  /** Callback for custom action */
  onCustomAction?: (action: string, ids: string[]) => void;
  /** Available actions */
  availableActions?: Array<{
    key: string;
    label: string;
    icon?: React.ReactNode;
    requiresConfirmation?: boolean;
  }>;
  /** Available status options (for orders/tables) */
  statusOptions?: Array<{ value: string; label: string }>;
}

export function BulkActionsToolbar({
  selectedIds,
  totalItems,
  entityType,
  onSelectionChange,
  onDelete,
  onExport,
  onStatusUpdate,
  onCustomAction,
  availableActions,
  statusOptions,
}: BulkActionsToolbarProps) {
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const defaultActions = [
    { key: "export", label: "Export Selected", icon: <ExportIcon /> },
    ...(entityType === "orders" || entityType === "tables"
      ? [{ key: "status", label: "Update Status", icon: <StatusIcon /> }]
      : []),
    ...(entityType === "menu_items"
      ? [{ key: "availability", label: "Set Availability", icon: <AvailabilityIcon /> }]
      : []),
    { key: "delete", label: "Delete Selected", icon: <DeleteIcon />, requiresConfirmation: true },
  ];

  const actions = availableActions || defaultActions;

  const handleSelectAll = () => {
    if (selectedIds.length === totalItems) {
      onSelectionChange([]);
    } else {
      onSelectionChange(Array.from({ length: totalItems }, (_, i) => `item-${i}`));
    }
  };

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete?.(selectedIds);
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
    }
  };

  const handleAction = (actionKey: string) => {
    if (actionKey === "delete") {
      handleDelete();
    } else if (actionKey === "export") {
      onExport?.(selectedIds);
    } else if (actionKey === "status" && statusOptions?.length) {
      setShowStatusDropdown(!showStatusDropdown);
    } else {
      onCustomAction?.(actionKey, selectedIds);
    }
  };

  if (selectedIds.length === 0) {
    return null;
  }

  return (
    <div className="bulk-actions-toolbar flex items-center gap-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      {/* Selection Info */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={selectedIds.length === totalItems}
          onChange={handleSelectAll}
          className="w-4 h-4 rounded border-gray-300"
        />
        <span className="text-sm text-gray-700">
          {selectedIds.length} of {totalItems} selected
        </span>
      </div>

      <div className="border-l border-blue-200 h-6" />

      {/* Actions */}
      <div className="flex items-center gap-2">
        {actions.map((action) => (
          <div key={action.key} className="relative">
            {action.key === "status" && statusOptions?.length ? (
              <div className="relative">
                <button
                  onClick={() => handleAction(action.key)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
                >
                  {action.icon}
                  {action.label}
                </button>
                {showStatusDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-10 min-w-[150px]">
                    {statusOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          onStatusUpdate?.(selectedIds, option.value);
                          setShowStatusDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => handleAction(action.key)}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded ${
                  action.key === "delete" && confirmDelete
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-white border border-gray-300 hover:bg-gray-50"
                }`}
              >
                {action.icon}
                {action.key === "delete" && confirmDelete ? "Confirm Delete?" : action.label}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Clear Selection */}
      <button
        onClick={() => onSelectionChange([])}
        className="ml-auto text-sm text-gray-500 hover:text-gray-700"
      >
        Clear Selection
      </button>
    </div>
  );
}

// Icons
function ExportIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function StatusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
    </svg>
  );
}

function AvailabilityIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}
