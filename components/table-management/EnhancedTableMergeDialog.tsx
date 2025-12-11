"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import type { TableWithState } from "@/types/table-types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

import {
  Users,
  Clock,
  CheckCircle2,
  Calendar,
  XCircle,
  Sparkles,
  AlertTriangle,
  Info,
  Circle,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  getTableState,
  getMergeScenario,
  getMergeableTables,
  getStateDisplayLabel,
  getStateColorClass,
  getStateIcon,
  type TableState,
  type TableStateInfo,
  type MergeScenario,
} from "@/lib/table-states";

interface Table extends Record<string, unknown> {
  id: string;
  label: string;
  seat_count: number;
  status: string;
  session_id?: string | null;
  order_id?: string | null;
  total_amount?: number | null;
  order_status?: string | null;
  opened_at?: string | null;
  customer_name?: string | null;
  reserved_now_id?: string | null;
  reserved_now_start?: string | null;
  reserved_now_name?: string | null;
  reserved_later_id?: string | null;
  reserved_later_start?: string | null;
  reserved_later_name?: string | null;
  state: TableState;
  stateInfo?: TableStateInfo;
  mergeScenario?: MergeScenario;
  selectable: boolean;
  requiresConfirmation: boolean;
}

interface EnhancedTableMergeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sourceTable: Table;
  venueId: string;
  availableTables: Table[];
  onActionComplete?: () => void;
  onMergeConfirm: (
    sourceTableId: string,
    targetTableId: string,
    requiresConfirmation: boolean
  ) => Promise<void>;
}

export function EnhancedTableMergeDialog({
  isOpen,
  onClose,
  sourceTable,
  venueId: _venueId,
  availableTables,
  onActionComplete,
  onMergeConfirm,
}: EnhancedTableMergeDialogProps) {
  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [showAllTables, setShowAllTables] = useState(false);
  const [mergeableTables, setMergeableTables] = useState<Table[]>([]);

  // Update mergeable tables when dialog opens or settings change
  useEffect(() => {
    if (isOpen) {
      const tables = getMergeableTables(
        sourceTable as Record<string, unknown>,
        availableTables as Record<string, unknown>[],
        showAllTables
      ) as Table[];
      setMergeableTables(tables as Table[]);
      setSelectedTableId(""); // Reset selection
    }
  }, [isOpen, sourceTable, availableTables, showAllTables]);

  const handleConfirm = async () => {
    if (!selectedTableId) {
      return;
    }

    const selectedTable = mergeableTables.find((t) => t.id === selectedTableId);
    if (!selectedTable) {
      return;
    }

    try {
      setIsLoading(true);
      await onMergeConfirm(sourceTable.id, selectedTableId, selectedTable.requiresConfirmation);
      onActionComplete?.();
      onClose();
    } catch (_error) {
      // Error silently handled
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStateIconComponent = (state: TableState) => {
    switch (state) {
      case "FREE":
        return <CheckCircle2 className="h-3 w-3" />;
      case "OCCUPIED":
        return <Users className="h-3 w-3" />;
      case "RESERVED":
        return <Calendar className="h-3 w-3" />;
      case "BLOCKED":
        return <XCircle className="h-3 w-3" />;
      case "CLEANING":
        return <Sparkles className="h-3 w-3" />;
      default:
        return <Circle className="h-3 w-3" />;
    }
  };

  const sourceState = getTableState(sourceTable);
  const selectedTable = mergeableTables.find((t) => t.id === selectedTableId);
  const mergeScenario = selectedTable?.mergeScenario;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Merge Table: {sourceTable.label}
          </DialogTitle>
          <DialogDescription>
            Select a table to merge with {sourceTable.label}. By default, only free tables are shown
            for safety.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Source Table Info */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-sm text-gray-700 mb-2">From Table:</h4>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{sourceTable.label}</span>
              <Badge variant="secondary" className="text-xs">
                <Users className="h-3 w-3 mr-1" />
                {sourceTable.seat_count} seats
              </Badge>
              <Badge className={`text-xs ${getStateColorClass(sourceState.state)}`}>
                {getStateIconComponent(sourceState.state)}
                <span className="ml-1">{getStateDisplayLabel(sourceState.state)}</span>
              </Badge>
            </div>
            {sourceTable.order_id && (
              <div className="mt-2 text-sm text-gray-900">
                <span>Order #{sourceTable.order_id.slice(-6)}</span>
                {sourceTable.total_amount && (
                  <span className="ml-2">£{(sourceTable.total_amount / 100).toFixed(2)}</span>
                )}
                {sourceTable.customer_name && (
                  <span className="ml-2">• {sourceTable.customer_name}</span>
                )}
              </div>
            )}
            {(sourceTable.reserved_now_id || sourceTable.reserved_later_id) && (
              <div className="mt-2 text-sm text-gray-900">
                <span>
                  Reserved for: {sourceTable.reserved_now_name || sourceTable.reserved_later_name}
                </span>
                {(sourceTable.reserved_now_start || sourceTable.reserved_later_start) && (
                  <span className="ml-2">
                    {formatTime(
                      sourceTable.reserved_now_start || sourceTable.reserved_later_start!
                    )}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Show All Tables Toggle */}
          <div className="flex items-center space-x-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <Switch
              id="show-all-tables"
              checked={showAllTables}
              onCheckedChange={setShowAllTables}
            />
            <Label htmlFor="show-all-tables" className="text-sm font-medium">
              Show all tables
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-blue-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    By default, only free tables are shown for safety. Enable this to see all tables
                    including occupied and reserved ones.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Merge Scenario Warning */}
          {mergeScenario && mergeScenario.warning && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">Warning</p>
                  <p className="text-sm text-yellow-700">{mergeScenario.warning}</p>
                </div>
              </div>
            </div>
          )}

          {/* Available Tables */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <h4 className="font-medium text-sm text-gray-700 mb-3">
              {showAllTables ? "All Tables:" : "Available Tables:"}
            </h4>
            <div className="flex-1 overflow-y-auto space-y-2">
              {mergeableTables.length === 0 ? (
                <p className="text-sm text-gray-900 text-center py-4">
                  {showAllTables
                    ? "No other tables available for merging"
                    : "No free tables available for merging"}
                </p>
              ) : (
                mergeableTables.map((table) => (
                  <div
                    key={table.id}
                    className={`p-3 border rounded-lg transition-colors ${
                      !table.selectable
                        ? "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed"
                        : selectedTableId === table.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300 cursor-pointer"
                    }`}
                    onClick={() => table.selectable && setSelectedTableId(table.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{table.label}</span>
                        <Badge variant="secondary" className="text-xs">
                          <Users className="h-3 w-3 mr-1" />
                          {table.seat_count} seats
                        </Badge>
                        <Badge className={`text-xs ${getStateColorClass(table.state)}`}>
                          {getStateIconComponent(table.state)}
                          <span className="ml-1">{getStateDisplayLabel(table.state)}</span>
                        </Badge>
                        {table.requiresConfirmation && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Confirmation Required
                          </Badge>
                        )}
                      </div>
                      {table.selectable && selectedTableId === table.id && (
                        <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        </div>
                      )}
                      {!table.selectable && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <XCircle className="h-4 w-4 text-gray-700" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                {table.mergeScenario?.description || "Cannot merge with this table"}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>

                    {/* Table Details */}
                    <div className="mt-2 text-sm text-gray-900 space-y-1">
                      {table.order_id && (
                        <div className="flex items-center gap-2">
                          <span>Order #{table.order_id.slice(-6)}</span>
                          {table.total_amount && (
                            <span>£{(table.total_amount / 100).toFixed(2)}</span>
                          )}
                          {table.customer_name && <span>• {table.customer_name}</span>}
                        </div>
                      )}

                      {(table.reserved_now_id || table.reserved_later_id) && (
                        <div className="flex items-center gap-2">
                          <span>
                            Reserved for: {table.reserved_now_name || table.reserved_later_name}
                          </span>
                          {(table.reserved_now_start || table.reserved_later_start) && (
                            <span>
                              {formatTime(table.reserved_now_start || table.reserved_later_start!)}
                            </span>
                          )}
                        </div>
                      )}

                      {table.opened_at && (
                        <div className="flex items-center gap-1 text-xs text-gray-900">
                          <Clock className="h-3 w-3" />
                          <span>Open {formatTime(table.opened_at)}</span>
                        </div>
                      )}
                    </div>

                    {/* Merge Scenario Description */}
                    {table.mergeScenario && (
                      <div className="mt-2 text-xs text-gray-900 italic">
                        {table.mergeScenario.description}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedTableId || !selectedTable?.selectable || isLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Merging...
              </>
            ) : (
              <>
                <Users className="h-4 w-4 mr-2" />
                {mergeScenario?.requiresConfirmation ? "Confirm Merge" : "Merge Tables"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
