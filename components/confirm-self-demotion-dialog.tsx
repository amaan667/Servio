"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";

interface ConfirmSelfDemotionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  currentRole: string;
  newRole: string;
}

export function ConfirmSelfDemotionDialog({
  open,
  onOpenChange,
  onConfirm,
  currentRole,
  newRole,
}: ConfirmSelfDemotionDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Confirm Role Change
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 pt-2">
            <p className="font-semibold text-foreground">
              You are about to demote yourself from Owner to {newRole}.
            </p>
            
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 space-y-2">
              <p className="font-medium text-destructive text-sm">
                ⚠️ This will immediately remove your access to:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• Billing and subscription management</li>
                <li>• Team roles and permissions</li>
                <li>• Inviting new team members</li>
                <li>• Venue branding and critical settings</li>
                {newRole === 'staff' || newRole === 'kitchen' ? (
                  <>
                    <li>• Menu management</li>
                    <li>• Analytics and reports</li>
                    <li>• Inventory management</li>
                  </>
                ) : null}
              </ul>
            </div>

            <p className="text-sm font-medium text-foreground">
              Only another Owner can restore your Owner privileges.
            </p>

            <p className="text-sm text-muted-foreground">
              Are you sure you want to continue?
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive hover:bg-destructive/90"
          >
            Yes, Change My Role
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

