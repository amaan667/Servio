"use client";

import React, { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LegacyShift = {
  id: string;
  staff_id: string;
  start_time: string;
  end_time: string;
  area?: string;
  staff_name: string;
  staff_role: string;
};

type StaffMember = {
  id: string;
  name: string;
  role: string;
  active: boolean;
  created_at: string;
};

interface SimpleStaffGridProps {
  staff: StaffMember[];
  venueId: string;
  /** When provided, used as single source of truth; otherwise component fetches internally */
  shifts?: LegacyShift[];
  onStaffAdded?: () => void;
  onStaffToggle?: (staffId: string, currentActive: boolean) => Promise<void>;
  onDeleteShift?: (shiftId: string) => Promise<void>;
  onUpdateShift?: (
    shiftId: string,
    updates: { start_time?: string; end_time?: string; area?: string }
  ) => Promise<void>;
  onReloadShifts?: () => Promise<void>;
}

type CalendarView = "today" | "week" | "month";

const SimpleStaffGrid: React.FC<SimpleStaffGridProps> = ({
  venueId,
  shifts: shiftsFromParent,
  onDeleteShift,
  onUpdateShift,
}) => {
  const [localShifts, setLocalShifts] = useState<LegacyShift[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarView, setCalendarView] = useState<CalendarView>("today");

  // Only fetch when parent does not provide shifts
  useEffect(() => {
    if (shiftsFromParent !== undefined) return;

    const fetchShifts = async () => {
      try {
        const res = await fetch(`/api/staff/shifts/list?venue_id=${encodeURIComponent(venueId)}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.data?.shifts)) {
          setLocalShifts(data.data.shifts);
        }
      } catch (_error) {
        // Error handled silently
      }
    };

    fetchShifts();
    const interval = setInterval(fetchShifts, 30000);
    return () => clearInterval(interval);
  }, [venueId, shiftsFromParent]);

  const shifts = shiftsFromParent ?? localShifts;

  // Shift detail/edit/delete state
  const [selectedShift, setSelectedShift] = useState<LegacyShift | null>(null);
  const [shiftDetailOpen, setShiftDetailOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editDate, setEditDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [shiftError, setShiftError] = useState<string | null>(null);

  const openShiftDetail = (shift: LegacyShift) => {
    setSelectedShift(shift);
    setShiftError(null);
    setEditMode(false);

    // Pre-populate edit fields
    const startDate = new Date(shift.start_time);
    setEditDate(startDate.toISOString().split("T")[0] ?? "");
    setEditStartTime(
      startDate.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    );
    const endDate = new Date(shift.end_time);
    setEditEndTime(
      endDate.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    );

    setShiftDetailOpen(true);
  };

  const handleUpdateShift = async () => {
    if (!selectedShift || !onUpdateShift) return;
    if (!editDate || !editStartTime || !editEndTime) {
      setShiftError("Please fill in all fields");
      return;
    }

    setSaving(true);
    setShiftError(null);

    try {
      const startTimestamp = `${editDate}T${editStartTime}:00`;
      const endTimestamp = `${editDate}T${editEndTime}:00`;

      await onUpdateShift(selectedShift.id, {
        start_time: startTimestamp,
        end_time: endTimestamp,
      });

      setShiftDetailOpen(false);
      setSelectedShift(null);
      setEditMode(false);
    } catch (_err) {
      setShiftError(_err instanceof Error ? _err.message : "Failed to update shift");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteShift = async () => {
    if (!selectedShift || !onDeleteShift) return;

    setDeleting(true);
    setShiftError(null);

    try {
      await onDeleteShift(selectedShift.id);
      setDeleteConfirmOpen(false);
      setShiftDetailOpen(false);
      setSelectedShift(null);
    } catch (_err) {
      setShiftError(_err instanceof Error ? _err.message : "Failed to delete shift");
    } finally {
      setDeleting(false);
    }
  };

  // Filter shifts based on current view
  const visibleShifts = useMemo(() => {
    if (!shifts || !Array.isArray(shifts)) return [];

    if (calendarView === "today") {
      const dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      return shifts.filter((shift) => {
        const shiftStart = new Date(shift.start_time);
        const shiftEnd = new Date(shift.end_time);
        return shiftEnd >= dayStart && shiftStart <= dayEnd;
      });
    }

    if (calendarView === "week") {
      const weekStart = new Date(currentDate);
      const dayOfWeek = weekStart.getDay();
      weekStart.setDate(weekStart.getDate() - dayOfWeek); // Start of week (Sunday)
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6); // End of week (Saturday)
      weekEnd.setHours(23, 59, 59, 999);

      return shifts.filter((shift) => {
        const shiftStart = new Date(shift.start_time);
        const shiftEnd = new Date(shift.end_time);
        return shiftEnd >= weekStart && shiftStart <= weekEnd;
      });
    }

    // Month view
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    return shifts.filter((shift) => {
      const shiftStart = new Date(shift.start_time);
      const shiftEnd = new Date(shift.end_time);
      return shiftEnd >= startOfMonth && shiftStart <= endOfMonth;
    });
  }, [shifts, calendarView, currentDate, currentMonth]);

  // Group shifts by date for grid display
  const shiftsByDate = useMemo(() => {
    const grouped: Record<string, LegacyShift[]> = {
      /* Empty */
    };

    visibleShifts.forEach((shift) => {
      const startDate = new Date(shift.start_time);
      const endDate = new Date(shift.end_time);

      // Add shift to start date
      const startDateString = startDate.toDateString();
      if (!grouped[startDateString]) {
        grouped[startDateString] = [];
      }
      grouped[startDateString].push(shift);

      // If it's an overnight shift, also add it to the end date
      if (startDate.toDateString() !== endDate.toDateString()) {
        const endDateString = endDate.toDateString();
        if (!grouped[endDateString]) {
          grouped[endDateString] = [];
        }
        grouped[endDateString].push(shift);
      }
    });

    return grouped;
  }, [visibleShifts]);

  // Get dates to display based on view
  const displayDates = useMemo(() => {
    if (calendarView === "today") {
      return [currentDate];
    }

    if (calendarView === "week") {
      const dates = [];
      const weekStart = new Date(currentDate);
      const dayOfWeek = weekStart.getDay();
      weekStart.setDate(weekStart.getDate() - dayOfWeek); // Start of week (Sunday)

      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        dates.push(date);
      }
      return dates;
    }

    // Month view - show all days in the month in a proper grid
    const dates = [];
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    // Add empty cells for days before the first day of the month
    const firstDayOfWeek = startOfMonth.getDay();
    for (let i = 0; i < firstDayOfWeek; i++) {
      dates.push(null); // null represents empty cells
    }

    // Add all days in the month
    for (let d = new Date(startOfMonth); d <= endOfMonth; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }

    return dates;
  }, [calendarView, currentDate, currentMonth]);

  // Navigation functions
  const goBack = () => {
    if (calendarView === "today") {
      setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 1));
    } else if (calendarView === "week") {
      setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 7));
    } else {
      setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    }
  };

  const goForward = () => {
    if (calendarView === "today") {
      setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 1));
    } else if (calendarView === "week") {
      setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7));
    } else {
      setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    }
  };

  // Get display title based on view
  const getDisplayTitle = () => {
    if (calendarView === "today") {
      return currentDate.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }

    if (calendarView === "week") {
      const weekStart = new Date(currentDate);
      const dayOfWeek = weekStart.getDay();
      weekStart.setDate(weekStart.getDate() - dayOfWeek);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      return `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    }

    return currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const isShiftActive = (shift: LegacyShift) => {
    const now = new Date();
    const start = new Date(shift.start_time);
    const end = new Date(shift.end_time);
    return now >= start && now <= end;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Staff Schedule</CardTitle>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="hidden sm:flex rounded-md border overflow-hidden">
              <button
                className={`px-3 py-1 text-sm ${calendarView === "today" ? "bg-purple-600 text-white" : "bg-background"}`}
                onClick={() => setCalendarView("today")}
              >
                Today
              </button>
              <button
                className={`px-3 py-1 text-sm border-l ${calendarView === "week" ? "bg-purple-600 text-white" : "bg-background"}`}
                onClick={() => setCalendarView("week")}
              >
                Week
              </button>
              <button
                className={`px-3 py-1 text-sm border-l ${calendarView === "month" ? "bg-purple-600 text-white" : "bg-background"}`}
                onClick={() => setCalendarView("month")}
              >
                Month
              </button>
            </div>

            {/* Navigation */}
            <Button variant="outline" size="sm" onClick={goBack}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goForward}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="text-2xl font-bold text-center">{getDisplayTitle()}</div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-full">
            {/* Grid Header */}
            <div
              className={`grid gap-2 mb-4 ${calendarView === "month" ? "grid-cols-7" : ""}`}
              style={
                calendarView !== "month"
                  ? { gridTemplateColumns: `repeat(${displayDates.length}, 1fr)` }
                  : {
                      /* Empty */
                    }
              }
            >
              {calendarView === "month"
                ? // Month view header with day names
                  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayName, index) => (
                    <div key={index} className="text-center p-2 bg-gray-50 rounded-lg">
                      <div className="text-sm font-medium text-gray-900">{dayName}</div>
                    </div>
                  ))
                : // Today/Week view header
                  displayDates.map((date, index) => (
                    <div key={index} className="text-center p-2 bg-gray-50 rounded-lg">
                      <div className="text-sm font-medium text-gray-900">
                        {date?.toLocaleDateString("en-US", { weekday: "short" })}
                      </div>
                      <div className="text-lg font-bold">{date?.getDate()}</div>
                    </div>
                  ))}
            </div>

            {/* Grid Content */}
            <div
              className={`grid gap-2 ${calendarView === "month" ? "grid-cols-7" : ""}`}
              style={
                calendarView !== "month"
                  ? { gridTemplateColumns: `repeat(${displayDates.length}, 1fr)` }
                  : {
                      /* Empty */
                    }
              }
            >
              {displayDates.map((date, index) => {
                if (!date) {
                  // Empty cell for month view
                  return (
                    <div
                      key={index}
                      className="min-h-[120px] p-2 border rounded-lg bg-gray-50"
                    ></div>
                  );
                }

                const dateString = date.toDateString();
                const dayShifts = shiftsByDate[dateString] || [];

                return (
                  <div key={index} className="min-h-[120px] p-2 border rounded-lg bg-white">
                    <div className="text-center mb-2">
                      <div className="text-lg font-bold">{date.getDate()}</div>
                    </div>
                    <div className="space-y-1">
                      {dayShifts.length === 0 ? (
                        <div className="text-center text-gray-700 text-xs py-4">No shifts</div>
                      ) : (
                        dayShifts.map((shift) => {
                          const shiftStartDate = new Date(shift.start_time).toDateString();
                          const shiftEndDate = new Date(shift.end_time).toDateString();
                          const isOvernight = shiftStartDate !== shiftEndDate;
                          const isStartDay = dateString === shiftStartDate;
                          const isEndDay = dateString === shiftEndDate;

                          // Determine display styling based on shift type and day
                          let bgColor = "bg-purple-50";
                          let borderColor = "border-purple-200";
                          let textColor = "text-purple-800";

                          if (isOvernight) {
                            if (isStartDay) {
                              bgColor = "bg-orange-50";
                              borderColor = "border-orange-200";
                              textColor = "text-orange-800";
                            } else if (isEndDay) {
                              bgColor = "bg-blue-50";
                              borderColor = "border-blue-200";
                              textColor = "text-blue-800";
                            }
                          }

                          return (
                            <div
                              key={`${shift.id}-${dateString}`}
                              className={`group relative p-1 ${bgColor} border ${borderColor} rounded hover:opacity-80 transition-colors cursor-pointer`}
                              title={`${shift.staff_name} - ${shift.staff_role}\n${formatTime(shift.start_time)} - ${formatTime(shift.end_time)}${shift.area ? `\n${shift.area}` : ""}${isOvernight ? "\n🌙 Overnight Shift" : ""}${isShiftActive(shift) ? "\n🟢 Active Now" : ""}${isOvernight && isStartDay ? "\n📅 Start Day" : ""}${isOvernight && isEndDay ? "\n📅 End Day" : ""}`}
                              onClick={() => openShiftDetail(shift)}
                            >
                              <div className={`text-xs font-medium ${textColor} text-center`}>
                                {shift.staff_name}
                                {isOvernight && isStartDay && <span className="ml-1">🌙</span>}
                                {isOvernight && isEndDay && <span className="ml-1">🌅</span>}
                              </div>

                              {/* Hover tooltip */}
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-servio-purple text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                                <div className="font-medium">{shift.staff_name}</div>
                                <div>{shift.staff_role}</div>
                                <div>
                                  {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                                </div>
                                {shift.area && <div>{shift.area}</div>}
                                {isOvernight && <div>🌙 Overnight Shift</div>}
                                {isOvernight && isStartDay && <div>📅 Start Day</div>}
                                {isOvernight && isEndDay && <div>📅 End Day</div>}
                                {isShiftActive(shift) && <div>🟢 Active Now</div>}
                                <div className="text-center mt-1 text-purple-200">
                                  Click to edit / delete
                                </div>
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>

      {/* Shift Detail / Edit Dialog */}
      <Dialog
        open={shiftDetailOpen}
        onOpenChange={(open) => {
          if (!open) {
            setShiftDetailOpen(false);
            setSelectedShift(null);
            setEditMode(false);
            setShiftError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{editMode ? "Edit Shift" : "Shift Details"}</span>
              {!editMode && selectedShift && (
                <div className="flex gap-1">
                  {onUpdateShift && (
                    <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Button>
                  )}
                  {onDeleteShift && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setDeleteConfirmOpen(true)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Delete
                    </Button>
                  )}
                </div>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedShift && !editMode && (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-500 w-16">Name</span>
                <span className="text-sm font-semibold">{selectedShift.staff_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-500 w-16">Role</span>
                <span className="text-sm">{selectedShift.staff_role}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-500 w-16">Date</span>
                <span className="text-sm">
                  {new Date(selectedShift.start_time).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-500 w-16">Time</span>
                <span className="text-sm">
                  {formatTime(selectedShift.start_time)} - {formatTime(selectedShift.end_time)}
                </span>
              </div>
              {selectedShift.area && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-500 w-16">Area</span>
                  <span className="text-sm">{selectedShift.area}</span>
                </div>
              )}
              {isShiftActive(selectedShift) && (
                <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded">
                  <span className="text-sm text-green-700 font-medium">Currently Active</span>
                </div>
              )}
            </div>
          )}

          {selectedShift && editMode && (
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="edit-date">Date</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-start-time">Start Time</Label>
                  <Input
                    id="edit-start-time"
                    type="time"
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-end-time">End Time</Label>
                  <Input
                    id="edit-end-time"
                    type="time"
                    value={editEndTime}
                    onChange={(e) => setEditEndTime(e.target.value)}
                  />
                </div>
              </div>
              {shiftError && <p className="text-sm text-red-600">{shiftError}</p>}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditMode(false);
                    setShiftError(null);
                    // Reset to original values
                    if (selectedShift) {
                      const startDate = new Date(selectedShift.start_time);
                      setEditDate(startDate.toISOString().split("T")[0] ?? "");
                      setEditStartTime(
                        startDate.toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })
                      );
                      const endDate = new Date(selectedShift.end_time);
                      setEditEndTime(
                        endDate.toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })
                      );
                    }
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button onClick={handleUpdateShift} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Shift</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this shift for {selectedShift?.staff_name}? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {shiftError && <p className="text-sm text-red-600">{shiftError}</p>}
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteShift}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? "Deleting..." : "Delete Shift"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default SimpleStaffGrid;
