"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Plus, Clock, Calendar, Users } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import TimeField24, { TimeValue24 } from "@/components/inputs/TimeField24";
import { buildIsoFromLocal, isOvernight, addDaysISO } from "@/lib/time";

type StaffMember = {
  id: string;
  name: string;
  role: string;
  active: boolean;
  created_at: string;
};

type Shift = {
  id: string;
  staff_id: string;
  start_time: string;
  end_time: string;
  area?: string;
  staff_name: string;
  staff_role: string;
  date?: string;
};

interface EnhancedShiftScheduleProps {
  staff: StaffMember[];
  shifts: Shift[];
  venueId: string;
  onShiftAdded: () => void;
}

type ViewMode = "day" | "week" | "month";

export default function EnhancedShiftSchedule({
  staff,
  shifts,
  venueId,
  onShiftAdded,
}: EnhancedShiftScheduleProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isAddShiftModalOpen, setIsAddShiftModalOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");

  // Shift form state
  const [shiftDate, setShiftDate] = useState("");
  const [startTime, setStartTime] = useState<TimeValue24>({ hour: null, minute: null });
  const [endTime, setEndTime] = useState<TimeValue24>({ hour: null, minute: null });
  const [area, setArea] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Navigation functions
  const navigatePeriod = useCallback(
    (direction: "prev" | "next") => {
      setCurrentDate((prev) => {
        const newDate = new Date(prev);
        switch (viewMode) {
          case "day":
            newDate.setDate(newDate.getDate() + (direction === "next" ? 1 : -1));
            break;
          case "week":
            newDate.setDate(newDate.getDate() + (direction === "next" ? 7 : -7));
            break;
          case "month":
            newDate.setMonth(newDate.getMonth() + (direction === "next" ? 1 : -1));
            break;
        }
        return newDate;
      });
    },
    [viewMode]
  );

  // Get shifts for current view period
  const shiftsForPeriod = useMemo(() => {
    const filteredShifts = shifts.filter((shift) => {
      const shiftDate = new Date(shift.start_time);

      switch (viewMode) {
        case "day":
          return shiftDate.toDateString() === currentDate.toDateString();
        case "week": {
          const weekStart = new Date(currentDate);
          weekStart.setDate(currentDate.getDate() - currentDate.getDay());
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          return shiftDate >= weekStart && shiftDate <= weekEnd;
        }
        case "month":
          return (
            shiftDate.getMonth() === currentDate.getMonth() &&
            shiftDate.getFullYear() === currentDate.getFullYear()
          );
        default:
          return false;
      }
    });

    return filteredShifts;
  }, [shifts, currentDate, viewMode]);

  // Group shifts by date for display
  const groupedShifts = useMemo(() => {
    const grouped: Record<string, Shift[]> = {
      /* Empty */
    };

    shiftsForPeriod.forEach((shift) => {
      const shiftDate = new Date(shift.start_time).toDateString();
      if (!grouped[shiftDate]) {
        grouped[shiftDate] = [];
      }
      grouped[shiftDate].push(shift);
    });

    return grouped;
  }, [shiftsForPeriod]);

  // Get display title for current period
  const getPeriodTitle = () => {
    switch (viewMode) {
      case "day":
        return currentDate.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      case "week": {
        const weekStart = new Date(currentDate);
        weekStart.setDate(currentDate.getDate() - currentDate.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        const weekStartLabel = new Date(currentDate);
        weekStartLabel.setDate(currentDate.getDate() - currentDate.getDay());
        const weekEndLabel = new Date(weekStartLabel);
        weekEndLabel.setDate(weekStartLabel.getDate() + 6);
        return `${weekStartLabel.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekEndLabel.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
      }
      case "month":
        return currentDate.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
        });
      default:
        return "";
    }
  };

  // Handle shift creation
  const handleAddShift = async () => {
    setError(null);

    if (
      !selectedStaffId ||
      !shiftDate ||
      startTime.hour == null ||
      startTime.minute == null ||
      endTime.hour == null ||
      endTime.minute == null
    ) {
      setError("Please fill in all required fields");
      return;
    }

    setSaving(true);

    try {
      const overnight = isOvernight(startTime.hour, startTime.minute, endTime.hour, endTime.minute);
      const startIso = buildIsoFromLocal(shiftDate, startTime.hour, startTime.minute);
      const endDate = overnight ? addDaysISO(shiftDate, 1) : shiftDate;
      const endIso = buildIsoFromLocal(endDate, endTime.hour, endTime.minute);

      const response = await fetch("/api/staff/shifts/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_id: selectedStaffId,
          venue_id: venueId,
          start_time: startIso,
          end_time: endIso,
          area: area || null,
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || "Failed to save shift");
      }

      // Reset form
      setShiftDate("");
      setStartTime({ hour: null, minute: null });
      setEndTime({ hour: null, minute: null });
      setArea("");
      setSelectedStaffId("");
      setIsAddShiftModalOpen(false);

      // Notify parent component
      onShiftAdded();
    } catch (_err) {
      setError(_err instanceof Error ? _err.message : "Failed to save shift");
    } finally {
      setSaving(false);
    }
  };

  // Handle individual staff shift button click
  const handleStaffShiftClick = (staffId: string) => {
    setSelectedStaffId(staffId);
    setShiftDate(currentDate.toISOString().split("T")[0] ?? "");
    setIsAddShiftModalOpen(true);
  };

  // Render shift display based on crowding
  const renderShiftDisplay = (shifts: Shift[], _date: string) => {
    const sortedShifts = shifts.sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );

    if (sortedShifts.length <= 3) {
      // Show full details for few shifts
      return (
        <div className="space-y-2">
          {sortedShifts.map((shift) => (
            <div key={shift.id} className="p-2 bg-blue-50 rounded border">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{shift.staff_name}</span>
                  <Badge variant="outline" className="ml-2">
                    {shift.area}
                  </Badge>
                </div>
                <span className="text-sm text-gray-600">
                  {new Date(shift.start_time).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}{" "}
                  -{" "}
                  {new Date(shift.end_time).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      );
    } else {
      // Show condensed view with tooltips for many shifts
      return (
        <div className="space-y-1">
          {sortedShifts.map((shift) => (
            <TooltipProvider key={shift.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="p-1 bg-blue-50 rounded cursor-pointer hover:bg-blue-100 transition-colors">
                    <span className="font-medium">{shift.staff_name}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm">
                    <div className="font-medium">
                      {shift.staff_name} ({shift.staff_role})
                    </div>
                    <div>{shift.area}</div>
                    <div>
                      {new Date(shift.start_time).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}{" "}
                      -{" "}
                      {new Date(shift.end_time).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* View Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "day" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("day")}
          >
            Day
          </Button>
          <Button
            variant={viewMode === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("week")}
          >
            Week
          </Button>
          <Button
            variant={viewMode === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("month")}
          >
            Month
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigatePeriod("prev")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-lg font-semibold min-w-[200px] text-center">{getPeriodTitle()}</h3>
          <Button variant="outline" size="sm" onClick={() => navigatePeriod("next")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Button onClick={() => setIsAddShiftModalOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Shift
        </Button>
      </div>

      {/* Staff Members with Individual Shift Buttons */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Staff Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {staff
              .filter((member) => member.active)
              .map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-semibold text-blue-600">
                        {member.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-medium">{member.name}</h4>
                      <Badge variant="outline">{member.role}</Badge>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStaffShiftClick(member.id)}
                    className="flex items-center gap-1"
                  >
                    <Clock className="h-3 w-3" />
                    Add Shift
                  </Button>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Shift Schedule Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Shift Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(groupedShifts).length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No shifts scheduled for this period
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedShifts).map(([date, dateShifts]) => (
                <div key={date} className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-3">
                    {new Date(date).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })}
                  </h4>
                  {renderShiftDisplay(dateShifts, date)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Shift Modal */}
      <Dialog open={isAddShiftModalOpen} onOpenChange={setIsAddShiftModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Shift</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="staff-select">Staff Member</Label>
              <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {staff
                    .filter((member) => member.active)
                    .map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name} ({member.role})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="shift-date">Date</Label>
              <Input
                id="shift-date"
                type="date"
                value={shiftDate}
                onChange={(e) => setShiftDate(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Time</Label>
                <TimeField24 value={startTime} onChange={setStartTime} />
              </div>
              <div>
                <Label>End Time</Label>
                <TimeField24 value={endTime} onChange={setEndTime} />
              </div>
            </div>

            <div>
              <Label htmlFor="area-select">Area</Label>
              <Select value={area} onValueChange={setArea}>
                <SelectTrigger>
                  <SelectValue placeholder="Select area (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No specific area</SelectItem>
                  <SelectItem value="Front of House">Front of House</SelectItem>
                  <SelectItem value="Kitchen">Kitchen</SelectItem>
                  <SelectItem value="Bar">Bar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}

            <div className="flex gap-2 pt-4">
              <Button onClick={handleAddShift} disabled={saving} className="flex-1">
                {saving ? "Adding..." : "Add Shift"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsAddShiftModalOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
