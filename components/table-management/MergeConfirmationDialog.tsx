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
import { AlertTriangle, Users, Receipt, Calendar } from "lucide-react";

interface Table {

}

interface MergeConfirmationDialogProps {

}

export function MergeConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  sourceTable,
  targetTable,
  mergeType,
  isLoading = false,
}: MergeConfirmationDialogProps) {
  const [confirmText, setConfirmText] = useState("");

  const isOccupiedOccupied = mergeType === "OCCUPIED_OCCUPIED";
  const isReservedReserved = mergeType === "RESERVED_RESERVED";

  const requiredConfirmText = isOccupiedOccupied ? "MERGE ACTIVE BILLS" : "MERGE RESERVATIONS";

  const canConfirm = confirmText === requiredConfirmText;

  const handleConfirm = () => {
    if (canConfirm) {
      onConfirm();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Confirm Risky Merge Operation
          </DialogTitle>
          <DialogDescription>
            This merge operation requires explicit confirmation due to its potential impact on
            active sessions or reservations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning Message */}
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-red-800 mb-2">
                  {isOccupiedOccupied
                    ? "Active Bills Will Be Combined"
                    : "Reservations Will Be Merged"}
                </h4>
                <p className="text-sm text-red-700">
                  {isOccupiedOccupied
                    ? "This will merge two active bills into one. Outstanding unpaid balances will be combined and both parties will share the same session."
                    : "This will merge two tables for the same reservation. Both tables will be grouped under the same reservation."}
                </p>
              </div>
            </div>
          </div>

          {/* Tables Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Source Table */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-sm text-gray-700 mb-2">From Table:</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{sourceTable.label}</span>
                  <Badge variant="secondary" className="text-xs">
                    <Users className="h-3 w-3 mr-1" />
                    {sourceTable.seat_count} seats
                  </Badge>
                </div>

                {sourceTable.order_id && (
                  <div className="text-sm text-gray-900">
                    <div className="flex items-center gap-2">
                      <Receipt className="h-3 w-3" />
                      <span>Order #{sourceTable.order_id.slice(-6)}</span>
                    </div>
                    {sourceTable.total_amount && (
                      <div className="ml-5 text-sm">
                        £{(sourceTable.total_amount / 100).toFixed(2)}
                      </div>
                    )}
                    {sourceTable.customer_name && (
                      <div className="ml-5 text-sm">{sourceTable.customer_name}</div>
                    )}
                  </div>
                )}

                {(sourceTable.reserved_now_name || sourceTable.reserved_later_name) && (
                  <div className="text-sm text-gray-900">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {sourceTable.reserved_now_name || sourceTable.reserved_later_name}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Target Table */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-sm text-gray-700 mb-2">To Table:</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{targetTable.label}</span>
                  <Badge variant="secondary" className="text-xs">
                    <Users className="h-3 w-3 mr-1" />
                    {targetTable.seat_count} seats
                  </Badge>
                </div>

                {targetTable.order_id && (
                  <div className="text-sm text-gray-900">
                    <div className="flex items-center gap-2">
                      <Receipt className="h-3 w-3" />
                      <span>Order #{targetTable.order_id.slice(-6)}</span>
                    </div>
                    {targetTable.total_amount && (
                      <div className="ml-5 text-sm">
                        £{(targetTable.total_amount / 100).toFixed(2)}
                      </div>
                    )}
                    {targetTable.customer_name && (
                      <div className="ml-5 text-sm">{targetTable.customer_name}</div>
                    )}
                  </div>
                )}

                {(targetTable.reserved_now_name || targetTable.reserved_later_name) && (
                  <div className="text-sm text-gray-900">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {targetTable.reserved_now_name || targetTable.reserved_later_name}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Impact Summary */}
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-semibold text-yellow-800 mb-2">What Will Happen:</h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              {isOccupiedOccupied ? (
                <>
                  <li>• Both tables will share the same session ID</li>
                  <li>• Outstanding bills will be combined into one</li>
                  <li>• All future orders will go to the primary table's session</li>
                  <li>• Timer and seated duration will inherit from the primary table</li>
                  <li>• The secondary table will be marked as merged</li>
                </>
              ) : (
                <>
                  <li>• Both tables will be grouped under the same reservation</li>
                  <li>• Reservation capacity will increase accordingly</li>
                  <li>• When the party arrives, both tables will be seated together</li>
                  <li>• The tables will share the same session when occupied</li>
                </>
              )}
            </ul>
          </div>

          {/* Confirmation Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              To confirm this action, type{" "}
              <code className="bg-gray-100 px-1 rounded">{requiredConfirmText}</code>:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              placeholder={`Type "${requiredConfirmText}" to confirm`}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm || isLoading}
            className="bg-red-600 hover:bg-red-700"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Merging...
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 mr-2" />
                Confirm Merge
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
