"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, CheckCircle2 } from "lucide-react";
import { useTableActions } from "@/hooks/useTableActions";

interface Table {
  id: string;
  label: string;
  seat_count: number;
  status: string;
  order_id?: string;
  total_amount?: number;
  order_status?: string | null;
  opened_at?: string;
}

interface TableSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sourceTable: Table;
  action: "move" | "merge";
  venueId: string;
  availableTables: Table[];
  onActionComplete?: () => void;
}

export function TableSelectionDialog({
  isOpen,
  onClose,
  sourceTable,
  action,
  venueId,
  availableTables,
  onActionComplete,
}: TableSelectionDialogProps) {
  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const { moveTable, mergeTable } = useTableActions();

  // Filter available tables based on action
  const getAvailableTables = () => {
    if (action === "move") {
      // Move logic: Can only move OCCUPIED or RESERVED to FREE
      if (sourceTable.status === "FREE") {
        return []; // Cannot move a free table
      }
      return availableTables.filter(
        (table) => table.id !== sourceTable.id && table.status === "FREE"
      );
    } else {
      // Merge logic: Follow the specification rules
      const filtered = availableTables.filter((table) => {
        if (table.id === sourceTable.id) return false;

        const sourceStatus = sourceTable.status;
        const targetStatus = table.status;

        // FREE + FREE → ✅ Allowed
        if (sourceStatus === "FREE" && targetStatus === "FREE") return true;

        // OCCUPIED + FREE → ✅ Allowed (join free table to current diners)
        if (sourceStatus === "OCCUPIED" && targetStatus === "FREE") return true;

        // RESERVED + FREE → ✅ Allowed (expand reserved area)
        if (sourceStatus === "RESERVED" && targetStatus === "FREE") return true;

        // RESERVED + RESERVED (same reservation) → ✅ Allowed
        if (sourceStatus === "RESERVED" && targetStatus === "RESERVED") {
          // Only if same reservation ID
          return sourceTable.order_id === table.order_id;
        }

        // OCCUPIED + OCCUPIED → ❌ Not allowed (conflicting orders)
        if (sourceStatus === "OCCUPIED" && targetStatus === "OCCUPIED") return false;

        // RESERVED + OCCUPIED → ❌ Not allowed
        if (sourceStatus === "RESERVED" && targetStatus === "OCCUPIED") return false;

        // FREE + OCCUPIED → ✅ Allowed (add free table to occupied)
        if (sourceStatus === "FREE" && targetStatus === "OCCUPIED") return true;

        // FREE + RESERVED → ✅ Allowed (add free table to reservation)
        if (sourceStatus === "FREE" && targetStatus === "RESERVED") return true;

        return false;
      });
      return filtered;
    }
  };

  const filteredTables = getAvailableTables();

  const handleConfirm = async () => {
    if (!selectedTableId) {
      return;
    }

    try {
      setIsLoading(true);

      if (action === "move") {
        await moveTable(sourceTable.id, venueId, selectedTableId);
      } else {
        const result = await mergeTable(sourceTable.id, venueId, selectedTableId);
      }

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "FREE":
        return "bg-green-100 text-green-800";
      case "ORDERING":
        return "bg-yellow-100 text-yellow-800";
      case "IN_PREP":
        return "bg-orange-100 text-orange-800";
      case "READY":
        return "bg-violet-100 text-violet-800";
      case "SERVED":
        return "bg-violet-100 text-violet-800";
      case "AWAITING_BILL":
        return "bg-slate-100 text-slate-800";
      case "RESERVED":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "FREE":
        return <CheckCircle2 className="h-3 w-3" />;
      case "ORDERING":
        return <Clock className="h-3 w-3" />;
      case "IN_PREP":
        return <Clock className="h-3 w-3" />;
      case "READY":
        return <CheckCircle2 className="h-3 w-3" />;
      case "SERVED":
        return <CheckCircle2 className="h-3 w-3" />;
      case "AWAITING_BILL":
        return <Clock className="h-3 w-3" />;
      case "RESERVED":
        return <Clock className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{action === "move" ? "Move Table" : "Merge Table"}</DialogTitle>
          <DialogDescription>
            {action === "move"
              ? `Move the session from ${sourceTable.label} to another table`
              : `Merge ${sourceTable.label} with another table to create a larger seating area`}
            {action === "merge" && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
                <strong>Merge Rules:</strong> FREE+FREE, OCCUPIED+FREE, RESERVED+FREE allowed.
                Cannot merge OCCUPIED+OCCUPIED or RESERVED+OCCUPIED.
              </div>
            )}
            {action === "move" && sourceTable.status === "FREE" && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700">
                Cannot move a FREE table (no active session to transfer)
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Source Table Info */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-sm text-gray-700 mb-2">From Table:</h4>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{sourceTable.label}</span>
              <Badge variant="secondary" className="text-xs">
                <Users className="h-3 w-3 mr-1" />
                {sourceTable.seat_count} seats
              </Badge>
              <Badge className={`text-xs ${getStatusColor(sourceTable.status)}`}>
                {getStatusIcon(sourceTable.status)}
                <span className="ml-1">{sourceTable.status}</span>
              </Badge>
            </div>
            {sourceTable.order_id && (
              <div className="mt-2 text-sm text-gray-900">
                <span>Order #{sourceTable.order_id.slice(-6)}</span>
                {sourceTable.total_amount && (
                  <span className="ml-2">£{(sourceTable.total_amount / 100).toFixed(2)}</span>
                )}
              </div>
            )}
          </div>

          {/* Available Tables */}
          <div>
            <h4 className="font-medium text-sm text-gray-700 mb-3">
              {action === "move" ? "Available Tables:" : "Select Table to Merge With:"}
            </h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {filteredTables.length === 0 ? (
                <p className="text-sm text-gray-900 text-center py-4">
                  {action === "move"
                    ? "No available tables for moving"
                    : "No other tables available for merging"}
                </p>
              ) : (
                filteredTables.map((table) => (
                  <div
                    key={table.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedTableId === table.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    onClick={() => setSelectedTableId(table.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{table.label}</span>
                        <Badge variant="secondary" className="text-xs">
                          <Users className="h-3 w-3 mr-1" />
                          {table.seat_count} seats
                        </Badge>
                        <Badge className={`text-xs ${getStatusColor(table.status)}`}>
                          {getStatusIcon(table.status)}
                          <span className="ml-1">{table.status}</span>
                        </Badge>
                      </div>
                      {selectedTableId === table.id && (
                        <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        </div>
                      )}
                    </div>

                    {table.order_id && (
                      <div className="mt-2 text-sm text-gray-900">
                        <span>Order #{table.order_id.slice(-6)}</span>
                        {table.total_amount && (
                          <span className="ml-2">£{(table.total_amount / 100).toFixed(2)}</span>
                        )}
                        {table.opened_at && (
                          <span className="ml-2">• Open {formatTime(table.opened_at)}</span>
                        )}
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
            disabled={!selectedTableId || isLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {action === "move" ? "Moving..." : "Merging..."}
              </>
            ) : action === "move" ? (
              "Move Table"
            ) : (
              "Merge Tables"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
