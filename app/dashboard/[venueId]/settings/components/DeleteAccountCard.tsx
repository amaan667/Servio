"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Trash2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DeleteAccountCardProps {

}

export function DeleteAccountCard({
  showDeleteDialog,
  setShowDeleteDialog,
  deleteConfirmation,
  setDeleteConfirmation,
  loading,
  error,
  onDeleteAccount,
}: DeleteAccountCardProps) {
  return (
    <Card className="shadow-lg rounded-xl border-red-200 bg-red-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-900">
          <Trash2 className="h-5 w-5 text-red-600" />
          Danger Zone
        </CardTitle>
        <CardDescription className="text-red-700">
          Permanently delete your account and all associated data
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogTrigger asChild>
            <Button variant="destructive" className="w-full">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Account
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-900">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                Delete Account
              </DialogTitle>
              <DialogDescription className="text-gray-600">
                This action cannot be undone. This will permanently delete your account, venues,
                orders, and all associated data.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="deleteConfirmation" className="text-sm font-semibold">
                  Type <span className="font-mono bg-gray-200 px-2 py-1 rounded">DELETE</span> to
                  confirm
                </Label>
                <Input
                  id="deleteConfirmation"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="DELETE"
                  disabled={loading}
                  className="rounded-lg mt-2"
                />
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800 font-semibold mb-2">⚠️ What will be deleted:</p>
                <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
                  <li>Your account and profile</li>
                  <li>All your venues</li>
                  <li>All orders and order history</li>
                  <li>All menu items and categories</li>
                  <li>All staff members and invitations</li>
                  <li>All analytics and reports</li>
                </ul>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteDialog(false);
                  setDeleteConfirmation("");
                }}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={onDeleteAccount}
                disabled={loading || deleteConfirmation !== "DELETE"}
              >
                {loading ? "Deleting..." : "Delete Account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
