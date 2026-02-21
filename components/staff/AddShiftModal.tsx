"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calendar } from "lucide-react";

interface AddShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffMember: {
    id: string;
    name: string;
  } | null;
  venueId: string;
  onShiftAdded?: () => void;
}

export function AddShiftModal({
  isOpen,
  onClose,
  staffMember,
  venueId,
  onShiftAdded,
}: AddShiftModalProps) {
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddShift = async () => {
    if (!date || !startTime || !endTime || !staffMember) {
      setError("Please fill in all fields");
      return;
    }

    setAdding(true);
    setError(null);

    try {
      const startTimestamp = `${date}T${startTime}:00`;
      const endTimestamp = `${date}T${endTime}:00`;

      const res = await fetch("/api/staff/shifts/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venue_id: venueId,
          staff_id: staffMember.id,
          start_time: startTimestamp,
          end_time: endTimestamp,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to add shift");
      }

      // Reset form
      setDate("");
      setStartTime("09:00");
      setEndTime("17:00");

      if (onShiftAdded) {
        onShiftAdded();
      }

      onClose();
    } catch (_err) {
      setError(_err instanceof Error ? _err.message : "Failed to add shift");
    } finally {
      setAdding(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setDate("");
    setStartTime("09:00");
    setEndTime("17:00");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Add Shift for {staffMember?.name}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="start-time">Start Time</Label>
              <Input
                id="start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="end-time">End Time</Label>
              <Input
                id="end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={adding}>
            Cancel
          </Button>
          <Button onClick={handleAddShift} disabled={adding || !date}>
            {adding ? "Adding..." : "Add Shift"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
