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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, AlertTriangle } from "lucide-react";
import { useTableManagement } from "@/hooks/useTableManagement";
import { toast } from "@/hooks/use-toast";

interface AddTableDialogProps {

}

export function AddTableDialog({ venueId, onTableAdded }: AddTableDialogProps) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [seatCount, setSeatCount] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const { createTable, loading } = useTableManagement();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!label.trim()) return;

    setError(null);

    const tableData = {

    };

    try {
      const result = await createTable(tableData);

      // Show success toast
      toast({

        description: `Table "${label.trim()}" has been created with ${seatCount} seats.`,

      setLabel("");
      setSeatCount(2);
      setOpen(false);
      onTableAdded?.();
    } catch (_error) {
      // Handle specific constraint error
      const errorMessage = _error instanceof Error ? _error.message : String(_error);
      if (
        errorMessage.includes("CONSTRAINT_ERROR") ||
        errorMessage.includes("temporarily unavailable")
      ) {
        setError(
          "Table creation is temporarily unavailable due to a database constraint issue. Please try again in a few moments."
        );
      } else {
        setError(errorMessage || "Failed to create table. Please try again.");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Table
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Table</DialogTitle>
          <DialogDescription>
            Create a new table for your venue. A free session will be automatically created.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="label" className="text-right">
                Label
              </Label>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g., Table 1"
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="seats" className="text-right">
                Seats
              </Label>
              <Input
                id="seats"
                type="number"
                min="1"
                max="20"
                value={seatCount}
                onChange={(e) => setSeatCount(parseInt(e.target.value) || 2)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !label.trim()}>
              {loading ? "Creating..." : "Create Table"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
