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
import { AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";

interface DailyResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isResetting: boolean;
  venueName?: string;
}

export function DailyResetModal({
  isOpen,
  onClose,
  onConfirm,
  isResetting,
  venueName = "this venue",
}: DailyResetModalProps) {
  const [isConfirmed, setIsConfirmed] = useState(false);

  const handleConfirm = async () => {
    if (!isConfirmed) return;

    try {
      await onConfirm();
      onClose();
    } catch (_error) {
      // Error handling is done in the parent component
    }
  };

  const handleClose = () => {
    if (!isResetting) {
      setIsConfirmed(false);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Reset Confirmation
          </DialogTitle>
          <DialogDescription className="text-left">
            This action will perform a complete reset for <strong>{venueName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Complete all active orders</p>
                <p className="text-xs text-gray-900">Mark all pending orders as completed</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Cancel all reservations</p>
                <p className="text-xs text-gray-900">Mark all active reservations as cancelled</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Delete all tables</p>
                <p className="text-xs text-gray-900">Remove all tables from the system</p>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-sm text-orange-800">
              <strong>Warning:</strong> This action cannot be undone. All current data will be
              permanently removed.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isResetting}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>

          <Button
            onClick={handleConfirm}
            disabled={!isConfirmed || isResetting}
            className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700"
          >
            {isResetting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Resetting...
              </>
            ) : (
              "Confirm Reset"
            )}
          </Button>
        </DialogFooter>

        <div className="pt-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isConfirmed}
              onChange={(e) => setIsConfirmed(e.target.checked)}
              disabled={isResetting}
              className="rounded border-gray-300"
            />
            <span className="text-gray-900">
              I understand this will permanently delete all tables and complete all orders
            </span>
          </label>
        </div>
      </DialogContent>
    </Dialog>
  );
}
