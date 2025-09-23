// app/dashboard/[venueId]/staff/staff-client.tsx
'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TimeField24, { TimeValue24 } from '@/components/inputs/TimeField24';
import { buildIsoFromLocal, isOvernight, addDaysISO } from '@/lib/time';
import { Users, Clock, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

// Shift pill styles
const shiftPillStyles = `
  /* Calendar container */
  .calendar {
    position: relative;
  }

  /* Base pill */
  .shift-pill {
    position: relative;
    z-index: 2;
    border: 1px solid #e5e7eb;
    background: #faf5ff;
    color: #111827;
    box-shadow: 0 6px 16px rgba(17,24,39,0.06);
    overflow: hidden;
    border-radius: 0;
    font-weight: 500;
  }

  /* Inner layout */
  .shift-pill-inner {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px 8px;
    font-size: 11px;
    line-height: 1.2;
    white-space: nowrap;
    height: 100%;
    min-height: 24px;
  }

  .shift-title {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    text-shadow: 0 1px 2px rgba(255,255,255,0.8);
  }

  .shift-time {
    display: none;
    opacity: 0.85;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    font-weight: 500;
    font-size: 10px;
  }

  .shift-role {
    display: none;
    opacity: 0.7;
    font-size: 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 500;
  }

  /* Show full details on hover */
  .shift-pill:hover .shift-pill-inner {
    display: grid;
    grid-template-rows: auto auto;
    gap: 2px;
    padding: 6px 8px;
    font-size: 10px;
    min-height: 40px;
  }

  .shift-pill:hover .shift-line {
    display: flex;
    justify-content: space-between;
    gap: 6px;
    min-height: 14px;
    align-items: center;
  }

  .shift-pill:hover .shift-time {
    display: block;
  }

  .shift-pill:hover .shift-role {
    display: block;
  }

  /* Rounded ends only where visible */
  .shift-pill.is-start {
    border-top-left-radius: 12px;
    border-bottom-left-radius: 12px;
  }

  .shift-pill.is-end {
    border-top-right-radius: 12px;
    border-bottom-right-radius: 12px;
  }

  /* Overnight flavor */
  .shift-pill.shift-overnight {
    background: linear-gradient(90deg, #fff7ed 0%, #faf5ff 100%);
    border-color: #f59e0b22;
    box-shadow: 0 8px 20px rgba(245, 158, 11, 0.15);
  }

  /* Role-based color coding */
  .shift-pill[data-role="Kitchen"] {
    border-left: 3px solid #10b981;
    background: linear-gradient(90deg, #ecfdf5 0%, #faf5ff 100%);
  }

  .shift-pill[data-role="Front of House"] {
    border-left: 3px solid #6366f1;
    background: linear-gradient(90deg, #eef2ff 0%, #faf5ff 100%);
  }

  .shift-pill[data-role="Bar"] {
    border-left: 3px solid #f59e0b;
    background: linear-gradient(90deg, #fffbeb 0%, #faf5ff 100%);
  }

  /* Hover state */
  .shift-pill:hover {
    filter: brightness(1.02);
    box-shadow: 0 10px 22px rgba(17,24,39,0.10);
    transform: translateY(-1px);
  }

  /* Focus ring for accessibility */
  .shift-pill:focus-visible {
    outline: 2px solid #6366f1;
    outline-offset: 2px;
  }

  /* Smooth transitions */
  .shift-pill {
    transition: all 0.2s ease-in-out;
    cursor: pointer;
  }

  /* Active state for better feedback */
  .shift-pill:active {
    transform: scale(0.98);
  }

  /* Prevent clipping under cell content */
  .event-overlay {
    pointer-events: none;
    position: absolute;
    inset: 0;
    z-index: 10;
  }

  .shift-pill {
    pointer-events: auto;
  }

  /* Ensure day cells don't clip shift pills */
  .calendar .grid {
    position: relative;
  }

  .calendar .grid > div {
    overflow: visible;
  }

  /* Calendar day cells */
  .calendar .grid > div {
    position: relative;
    z-index: 1;
  }

  /* Ensure proper spacing between calendar elements */
  .calendar .grid {
    gap: 2px;
  }

  /* Small screens: truncate time, keep title */
  @media (max-width: 900px) {
    .shift-time {
      display: none;
    }
    .shift-role {
      display: none;
    }
  }

  /* Very small screens: minimal display */
  @media (max-width: 600px) {
    .shift-pill-inner {
      padding: 4px 6px;
      font-size: 11px;
    }
    .shift-title {
      font-size: 10px;
    }
  }
`;

type StaffRow = {
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
};

interface StaffCounts {
  total_staff: number;
  active_staff: number;
  unique_roles: number;
  active_shifts_count: number;
}

export default function StaffClient({
  venueId,
  venueName,
  initialStaff,
  initialCounts,
}: {
  venueId: string;
  venueName?: string;
  initialStaff?: StaffRow[];
  initialCounts?: StaffCounts;
}) {
  const [staff, setStaff] = useState<StaffRow[]>(initialStaff || []);
  const [name, setName] = useState('');
  const [role, setRole] = useState('Server');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allShifts, setAllShifts] = useState<Shift[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<'today' | 'week' | 'month'>('month');
  const [activeTab, setActiveTab] = useState('staff');
  const [staffLoaded, setStaffLoaded] = useState(!!initialStaff && initialStaff.length > 0);
  const [shiftsLoaded, setShiftsLoaded] = useState(false);
  const [loading, setLoading] = useState(!initialStaff || initialStaff.length === 0);
  const [editingShiftFor, setEditingShiftFor] = useState<string | null>(null);

  // Load staff data on component mount
  useEffect(() => {
    const loadStaff = async () => {
      if (staffLoaded) return; // Prevent multiple loads
      
      try {
        console.log('[AUTH DEBUG] Loading staff for venue:', venueId);
        const res = await fetch(`/api/staff/check?venue_id=${encodeURIComponent(venueId)}`);
        const j = await res.json().catch(() => ({}));
        if (res.ok && !j?.error) {
          console.log('[AUTH DEBUG] Staff loaded:', j.staff?.length || 0, 'members');
          setStaff(j.staff || []);
          setStaffLoaded(true);
        } else {
          console.error('[AUTH DEBUG] Failed to load staff:', j?.error);
        }
      } catch (e) {
        console.error('[AUTH DEBUG] Failed to load staff:', e);
      }
    };

    // Only load if no initial staff provided and not already loaded
    if (!staffLoaded) {
      loadStaff();
    }
  }, [venueId, staffLoaded]);

  // Load shifts on component mount (no need to wait for staff data)
  useEffect(() => {
    const loadShifts = async () => {
      console.log('[AUTH DEBUG] Loading shifts for venue:', venueId);
      const res = await fetch(`/api/staff/shifts/list?venue_id=${encodeURIComponent(venueId)}`);
      const j = await res.json().catch(() => ({}));
      if (res.ok && !j?.error) {
        const shifts = j.shifts || [];
        console.log('[AUTH DEBUG] Shifts loaded:', shifts.length, 'shifts');
        setAllShifts(shifts);
        setShiftsLoaded(true);
      } else {
        console.error('[AUTH DEBUG] Failed to load shifts:', j?.error);
        setShiftsLoaded(true); // Set to true even on error to prevent infinite loading
      }
    };
    loadShifts();
  }, [venueId]);


  // Manage overall loading state
  useEffect(() => {
    // If we have initial staff, we can set staffLoaded to true immediately
    if (initialStaff && initialStaff.length > 0) {
      setStaffLoaded(true);
      // If we have initial staff, we can show data immediately (shifts will load separately)
      setLoading(false);
    }
    
    // Set loading to false when both staff and shifts are loaded
    if (staffLoaded && shiftsLoaded) {
      setLoading(false);
    }
  }, [staffLoaded, shiftsLoaded, initialStaff]);

  const onAdd = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Please enter a name.');
      return;
    }
    setAdding(true);
    const tempId = `tmp-${Date.now()}`;
    const optimistic: StaffRow = {
      id: tempId,
      name: name.trim(),
      role,
      active: true,
      created_at: new Date().toISOString(),
    };
    setStaff((s) => [...s, optimistic]);
    try {
      const res = await fetch('/api/staff/add', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ venue_id: venueId, name: name.trim(), role }),
      });
      const out = await res.json();
      if (!res.ok || out?.error) throw new Error(out?.error || 'Failed to add');
      setStaff((s) => s.map((r) => (r.id === tempId ? (out.data?.[0] as StaffRow) : r)));
      setName('');
      setRole('Server');
    } catch (e: any) {
      setError(e?.message || 'Failed to add staff member');
      setStaff((s) => s.filter((r) => r.id !== tempId));
    } finally {
      setAdding(false);
    }
  };

  const onToggleActive = async (row: StaffRow) => {
    const next = !row.active;
    setStaff((s) => s.map((r) => (r.id === row.id ? { ...r, active: next } : r)));
    try {
      const res = await fetch('/api/staff/toggle', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: row.id, active: next }),
      });
      const out = await res.json();
      if (!res.ok || out?.error) throw new Error(out?.error || 'Update failed');
    } catch (e) {
      setStaff((s) => s.map((r) => (r.id === row.id ? { ...r, active: !next } : r)));
      alert((e as any)?.message || 'Failed to update staff');
    }
  };

  const onDelete = async (row: StaffRow) => {
    if (!confirm(`Delete ${row.name}? This cannot be undone.`)) return;
    // optimistic remove
    const prev = staff;
    setStaff((s) => s.filter((r) => r.id !== row.id));
    try {
      const res = await fetch('/api/staff/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: row.id }),
      });
      const out = await res.json();
      if (!res.ok || out?.error) throw new Error(out?.error || 'Delete failed');
    } catch (e) {
      alert((e as any)?.message || 'Failed to delete');
      setStaff(prev);
    }
  };

  const reloadAllShifts = useCallback(async () => {
    const res = await fetch(`/api/staff/shifts/list?venue_id=${encodeURIComponent(venueId)}`);
    const j = await res.json().catch(() => ({}));
    if (res.ok && !j?.error) {
      const shifts = j.shifts || [];
      // Shifts are now enriched by the API, no need to enrich on client side
      setAllShifts(shifts);
    }
  }, [venueId]);

  // Removed this useEffect as it was causing shifts to load before staff data
  // Shifts are now loaded after staff data is available

  const grouped = useMemo(() => {
    const by: Record<string, StaffRow[]> = {};
    for (const r of staff) {
      if (!by[r.role]) by[r.role] = [];
      by[r.role].push(r);
    }
    return by;
  }, [staff]);

  const roles = Object.keys(grouped).sort();

  const isShiftActive = useCallback((shift: Shift) => {
    const now = new Date();
    const startTime = new Date(shift.start_time);
    const endTime = new Date(shift.end_time);
    return now >= startTime && now <= endTime;
  }, []);

  const activeShifts = useMemo(() => {
    return allShifts.filter(isShiftActive);
  }, [allShifts, isShiftActive]);

  // Memoize counts to prevent flickering - use initial counts when available
  const staffCounts = useMemo(() => {
    // If we have initial counts from server, use them to prevent flickering
    if (initialCounts) {
      return {
        totalStaff: initialCounts.total_staff,
        activeStaff: initialCounts.active_staff,
        uniqueRoles: initialCounts.unique_roles,
        activeShiftsCount: initialCounts.active_shifts_count
      };
    }
    
    // Fallback to client-side calculation if no initial counts
    const hasStaffData = staff.length > 0 || (initialStaff && initialStaff.length > 0);
    
    // Return stable values during loading to prevent flickering
    if (loading && !hasStaffData) {
      return {
        totalStaff: 0,
        activeStaff: 0,
        uniqueRoles: 0,
        activeShiftsCount: 0
      };
    }
    
    // Calculate actual counts - use current staff data or initial staff data
    const currentStaff = staff.length > 0 ? staff : (initialStaff || []);
    const totalStaff = currentStaff.length;
    const activeStaff = currentStaff.filter(s => s.active === true).length;
    const uniqueRoles = roles.length;
    const activeShiftsCount = activeShifts.length;
    
    return {
      totalStaff,
      activeStaff,
      uniqueRoles,
      activeShiftsCount
    };
  }, [initialCounts, staff.length, staff, roles.length, activeShifts.length, loading, initialStaff]);

  // Calendar functions
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    // Add previous month's days to fill the first week
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(year, month, -i);
      days.push({ date: prevDate, isCurrentMonth: false, isToday: false });
    }
    
    // Add current month's days
    for (let i = 1; i <= daysInMonth; i++) {
      const currentDate = new Date(year, month, i);
      const today = new Date();
      const isToday = currentDate.toDateString() === today.toDateString();
      days.push({ date: currentDate, isCurrentMonth: true, isToday });
    }
    
    // Add next month's days to fill the last week
    const remainingDays = 42 - days.length; // 6 rows * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      const nextDate = new Date(year, month + 1, i);
      days.push({ date: nextDate, isCurrentMonth: false, isToday: false });
    }
    
    return days;
  };

  const getShiftsForDate = (date: Date) => {
    // Get the date string for the calendar day we're checking
    const dateStr = date.toLocaleDateString('en-CA'); // YYYY-MM-DD format
    
    const shiftsForDay = allShifts.filter(shift => {
      // Parse shift dates using local time to avoid timezone issues
      const shiftStartDate = new Date(shift.start_time).toLocaleDateString('en-CA');
      const shiftEndDate = new Date(shift.end_time).toLocaleDateString('en-CA');
      
      // Include shift if it starts on this date OR if it's an overnight shift that ends on this date
      const shouldInclude = shiftStartDate === dateStr || shiftEndDate === dateStr;
      
      if (shouldInclude) {
        console.log('[AUTH DEBUG] Shift included for date:', {
          date: dateStr,
          shift_id: shift.id,
          staff_name: shift.staff_name,
          start_date: shiftStartDate,
          end_date: shiftEndDate,
          reason: shiftStartDate === dateStr ? 'starts_here' : 'ends_here'
        });
      }
      
      return shouldInclude;
    });
    
    return shiftsForDay;
  };

  const isOvernightShift = (shift: Shift) => {
    // Parse the dates properly, handling timezone issues
    const startDate = new Date(shift.start_time);
    const endDate = new Date(shift.end_time);
    
    // Get local date strings to avoid timezone issues
    const startDateStr = startDate.toLocaleDateString('en-CA'); // YYYY-MM-DD format
    const endDateStr = endDate.toLocaleDateString('en-CA');
    
    console.log('[AUTH DEBUG] Shift overnight check:', {
      shift_id: shift.id,
      start_time: shift.start_time,
      end_time: shift.end_time,
      start_date: startDateStr,
      end_date: endDateStr,
      is_overnight: startDateStr !== endDateStr
    });
    
    return startDateStr !== endDateStr;
  };

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: true 
    });
  };

  const CalendarView = () => {
    // Helpers for view ranges
    const startOfWeek = (date: Date) => {
      const d = new Date(date);
      const day = d.getDay();
      d.setDate(d.getDate() - day);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const endOfWeek = (date: Date) => {
      const s = startOfWeek(date);
      const e = new Date(s);
      e.setDate(s.getDate() + 6);
      e.setHours(23, 59, 59, 999);
      return e;
    };

    const getDaysForView = () => {
      if (calendarView === 'today') {
        const d = new Date(currentDate);
        d.setHours(0, 0, 0, 0);
        const today = new Date();
        const isToday = d.toDateString() === today.toDateString();
        return [{ date: d, isCurrentMonth: true, isToday }];
      }

      if (calendarView === 'week') {
        const s = startOfWeek(currentDate);
        const days = [] as { date: Date; isCurrentMonth: boolean; isToday: boolean }[];
        for (let i = 0; i < 7; i++) {
          const d = new Date(s);
          d.setDate(s.getDate() + i);
          const today = new Date();
          days.push({
            date: d,
            isCurrentMonth: d.getMonth() === currentMonth.getMonth(),
            isToday: d.toDateString() === today.toDateString(),
          });
        }
        return days;
      }

      // Month view (default)
      return getDaysInMonth(currentMonth);
    };

    const days = getDaysForView();
    const monthName =
      calendarView === 'today'
        ? currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : calendarView === 'week'
        ? `${startOfWeek(currentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${endOfWeek(currentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
        : currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const goBack = () => {
      if (calendarView === 'today') {
        setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1));
      } else if (calendarView === 'week') {
        setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7));
      } else {
        setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
      }
    };

    const goForward = () => {
      if (calendarView === 'today') {
        setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
      } else if (calendarView === 'week') {
        setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7));
      } else {
        setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
      }
    };

    const goToToday = () => {
      const now = new Date();
      setCurrentDate(now);
      setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    };

    // Helper function to split shifts into week-sized spans for proper rendering
    const splitShiftIntoWeekSpans = (shift: Shift) => {
      const start = new Date(shift.start_time);
      const end = new Date(shift.end_time);
      const isOvernight = start.toDateString() !== end.toDateString();
      
      // Day view: only render shifts that overlap the selected day
      if (calendarView === 'today') {
        const dayStart = new Date(currentDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);

        // Check overlap
        if (end < dayStart || start > dayEnd) return [] as any[];

        return [{
          id: shift.id,
          shift,
          weekIndex: 0,
          colStart: 1,
          spanCols: 1,
          isOvernight: start.toDateString() !== end.toDateString(),
          isFirstInSpan: true,
          isLastInSpan: true,
          start,
          end
        }];
      }

      if (!isOvernight) {
        // Single day shift - render once
        const { row, colStart, spanCols } = computeGridPlacement(start, end);
        return [{
          id: shift.id,
          shift,
          weekIndex: row - 1,
          colStart,
          spanCols,
          isOvernight: false,
          isFirstInSpan: true,
          isLastInSpan: true,
          start,
          end
        }];
      }

      // Multi-day shift - split into week spans
      const spans = [];
      let iterDate = new Date(start);
      let weekIndex = 0;
      let isFirst = true;

      while (iterDate <= end) {
        const weekStart = new Date(iterDate);
        const weekEnd = new Date(iterDate);
        
        // Find the end of this week (Saturday)
        while (weekEnd.getDay() !== 6 && weekEnd < end) {
          weekEnd.setDate(weekEnd.getDate() + 1);
        }
        
        // If this is the last span, use the actual end date
        if (weekEnd >= end) {
          weekEnd.setTime(end.getTime());
        }

        // Ensure we don't exceed the actual end date
        if (weekEnd > end) {
          weekEnd.setTime(end.getTime());
        }

        const { row, colStart, spanCols } = computeGridPlacement(weekStart, weekEnd);
        
        spans.push({
          id: `${shift.id}-${weekIndex}`,
          shift,
          weekIndex: row - 1,
          colStart,
          spanCols,
          isOvernight: true,
          isFirstInSpan: isFirst,
          isLastInSpan: weekEnd >= end,
          start: weekStart,
          end: weekEnd
        });

        // Move to next week
        iterDate = new Date(weekEnd);
        iterDate.setDate(iterDate.getDate() + 1);
        weekIndex++;
        isFirst = false;
      }

      return spans;
    };

    // Helper function to compute grid placement for shifts
    const computeGridPlacement = (start: Date, end: Date) => {
      if (calendarView === 'today') {
        return { row: 1, colStart: 1, spanCols: 1 };
      }

      if (calendarView === 'week') {
        const s = startOfWeek(currentDate);
        // Column is day of week within the visible week
        const startDate = new Date(start);
        const colStart = startDate.getDay() + 1; // 1..7
        // Span only within week
        const endDate = new Date(end);
        const endCol = Math.min(7, endDate.getDay() + 1);
        const spanCols = Math.max(1, endCol - colStart + 1);
        return { row: 1, colStart, spanCols };
      }

      // Month view
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const startDayOfWeek = startOfMonth.getDay();
      
      // Calculate week row index (0-based)
      const startDate = new Date(start);
      const daysFromStart = Math.floor((startDate.getTime() - startOfMonth.getTime()) / (1000 * 60 * 60 * 24));
      const weekRow = Math.floor((daysFromStart + startDayOfWeek) / 7);
      
      // Calculate column start (1-7, where 1 = Sunday)
      const colStart = startDate.getDay() + 1;
      
      // Calculate columns using date-only difference so single-day spans 1 column
      const startDayOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      const daysDiff = Math.floor((endDate.getTime() - startDayOnly.getTime()) / (1000 * 60 * 60 * 24));
      const spanCols = Math.min(7 - colStart + 1, Math.max(1, daysDiff + 1));
      
      return { row: weekRow + 1, colStart, spanCols };
    };

    // Get shifts for the active view range
    const getShiftsForView = () => {
      if (calendarView === 'today') {
        const s = new Date(currentDate);
        s.setHours(0, 0, 0, 0);
        const e = new Date(s);
        e.setHours(23, 59, 59, 999);
        return allShifts.filter((shift) => new Date(shift.end_time) >= s && new Date(shift.start_time) <= e);
      }

      if (calendarView === 'week') {
        const s = startOfWeek(currentDate);
        const e = endOfWeek(currentDate);
        return allShifts.filter((shift) => new Date(shift.end_time) >= s && new Date(shift.start_time) <= e);
      }

      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      endOfMonth.setHours(23, 59, 59, 999);
      return allShifts.filter((shift) => new Date(shift.end_time) >= startOfMonth && new Date(shift.start_time) <= endOfMonth);
    };

    const visibleShifts = getShiftsForView();
    const shiftSpans = visibleShifts.flatMap(splitShiftIntoWeekSpans);
    
    // Group shifts by day and position to avoid overlap
    const groupedSpans = shiftSpans.reduce((acc, span) => {
      const dayKey = `${span.weekIndex}-${span.colStart}`;
      if (!acc[dayKey]) acc[dayKey] = [];
      acc[dayKey].push(span);
      return acc;
    }, {} as Record<string, typeof shiftSpans>);
    
    // Add vertical offset for multiple shifts in same day
    const positionedSpans = shiftSpans.map(span => {
      const dayKey = `${span.weekIndex}-${span.colStart}`;
      const dayShifts = groupedSpans[dayKey] || [];
      const index = dayShifts.findIndex((s: any) => s.id === span.id);
      return {
        ...span,
        verticalOffset: index * 32 // 28px height + 4px gap
      };
    });

    return (
      <Card>
            <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Staff Calendar</CardTitle>
            <div className="flex items-center gap-2">
                  <div className="hidden sm:flex rounded-md border overflow-hidden">
                    <button
                      className={`px-3 py-1 text-sm ${calendarView === 'today' ? 'bg-purple-600 text-white' : 'bg-background'}`}
                      onClick={() => setCalendarView('today')}
                    >
                      Today
                    </button>
                    <button
                      className={`px-3 py-1 text-sm border-l ${calendarView === 'week' ? 'bg-purple-600 text-white' : 'bg-background'}`}
                      onClick={() => setCalendarView('week')}
                    >
                      Week
                    </button>
                    <button
                      className={`px-3 py-1 text-sm border-l ${calendarView === 'month' ? 'bg-purple-600 text-white' : 'bg-background'}`}
                      onClick={() => setCalendarView('month')}
                    >
                      Month
                    </button>
                  </div>
                  <Button variant="outline" size="sm" onClick={goBack}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={goForward}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
            </div>
          </div>
          <div className="text-2xl font-bold text-center">{monthName}</div>
        </CardHeader>
        <CardContent>
          <div className="relative calendar">
            {/* Calendar Grid */}
            <div className={`grid ${calendarView === 'today' ? 'grid-cols-1' : 'grid-cols-7'} gap-2`}>
              {/* Day headers */}
              {calendarView !== 'today' && ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="p-2 text-center text-sm font-semibold text-gray-600">
                  {day}
                </div>
              ))}
              
              {/* Calendar days */}
              {days.map((day, index) => {
                return (
                  <div
                    key={index}
                    className={`min-h-[120px] p-2 border ${
                      day.isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                    } ${day.isToday ? 'ring-2 ring-purple-500' : ''}`}
                  >
                    <div className={`text-xs p-1 text-right ${
                      day.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                    } ${day.isToday ? 'font-bold' : ''}`}>
                      {day.date.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Event Overlay for Shifts */}
            <div className="event-overlay">
              {positionedSpans.map(span => {
                const gridCols = calendarView === 'today' ? 1 : 7;
                const cellWidth = 100 / gridCols; // Each day cell width as percentage
                const colStart = calendarView === 'today' ? 1 : span.colStart;
                const left = (colStart - 1) * cellWidth;
                const width = Math.min((calendarView === 'today' ? 1 : span.spanCols) * cellWidth, 100 - left);
                const headerOffset = calendarView === 'today' ? 0 : 40;
                const top = span.weekIndex * 120 + headerOffset + 25 + (span.verticalOffset || 0); // align with row, offset from date number
                
                return (
                  <div
                    key={span.id}
                    className={`shift-pill absolute pointer-events-auto ${
                      span.isOvernight ? 'shift-overnight' : ''
                    } ${span.isFirstInSpan ? 'is-start' : ''} ${span.isLastInSpan ? 'is-end' : ''}`}
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      top: `${top}px`,
                      height: '28px'
                    }}
                    title={`${span.shift.staff_name} (${span.shift.staff_role}) - ${formatTime(span.shift.start_time)} - ${formatTime(span.shift.end_time)}${span.shift.area ? ` - ${span.shift.area}` : ''}${span.isOvernight ? ' - Overnight Shift' : ''}`}
                    data-role={span.shift.area || span.shift.staff_role}
                    onClick={() => {
                      // Could open shift details modal here
                      console.log('[AUTH DEBUG] Shift clicked:', span.shift);
                    }}
                    tabIndex={0}
                    role="button"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        console.log('[AUTH DEBUG] Shift activated:', span.shift);
                      }
                    }}
                  >
                    <div className="shift-pill-inner">
                      <span className="shift-title">
                        {span.isOvernight ? '🌙 ' : ''}{span.shift.staff_name}
                      </span>
                      <div className="shift-line" style={{ display: 'none' }}>
                        <span className="shift-title">
                          {span.isOvernight ? '🌙 ' : ''}{span.shift.staff_name}
                        </span>
                        <span className="shift-time">
                          {formatTime(span.shift.start_time)} – {formatTime(span.shift.end_time)}
                        </span>
                      </div>
                      <div className="shift-role">
                        {span.shift.area || span.shift.staff_role}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const StaffRowItem = memo(function StaffRowItem({ row, onDeleteRow, onShiftsChanged, embedded = false, onClose }: { row: StaffRow; onDeleteRow: (r: StaffRow) => void; onShiftsChanged: () => void; embedded?: boolean; onClose?: () => void }) {
    const [showEditor, setShowEditor] = useState(embedded);
    const [date, setDate] = useState('');
    const [start, setStart] = useState<TimeValue24>({ hour: null, minute: null });
    const [end, setEnd] = useState<TimeValue24>({ hour: null, minute: null });
    const [area, setArea] = useState('');
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [shifts, setShifts] = useState<Shift[]>([]);

    const load = useCallback(async () => {
      if (!showEditor) return;
      const res = await fetch(`/api/staff/shifts/list?venue_id=${encodeURIComponent(venueId)}&staff_id=${encodeURIComponent(row.id)}`);
      const j = await res.json().catch(()=>({}));
      if (!res.ok || j?.error) { setErr(j?.error || 'Failed to load shifts'); return; }
      setShifts(j.shifts || []);
    }, [row.id, showEditor, venueId]);

    useEffect(() => { load(); }, [load]);

    const save = useCallback(async () => {
      setErr(null);
      if (!date || start.hour == null || start.minute == null || end.hour == null || end.minute == null) {
        setErr('Please select date, start and end time');
        return;
      }
      setSaving(true);
      const overnight = isOvernight(start.hour, start.minute, end.hour, end.minute);
      const startIso = buildIsoFromLocal(date, start.hour, start.minute);
      const endDate = overnight ? addDaysISO(date, 1) : date;
      const endIso = buildIsoFromLocal(endDate, end.hour, end.minute);
      const res = await fetch('/api/staff/shifts/add', { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify({ staff_id: row.id, venue_id: venueId, start_time: startIso, end_time: endIso, area: area || null }) });
      const j = await res.json().catch(()=>({}));
      if (!res.ok || j?.error) { setErr(j?.error || 'Failed to save shift'); setSaving(false); return; }
      setSaving(false);
      setArea('');
      setStart({ hour: null, minute: null });
      setEnd({ hour: null, minute: null });
      await load();
      onShiftsChanged();
      if (embedded && onClose) {
        onClose();
      }
    }, [area, date, end.hour, end.minute, load, onShiftsChanged, row.id, start.hour, start.minute, venueId, embedded, onClose]);

    return (
      <div className="rounded border p-3">
        {!embedded && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="font-medium">{row.name}</div>
              {!row.active && <Badge variant="destructive">Inactive</Badge>}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setShowEditor((v) => !v)}>{showEditor ? 'Close' : 'Add Shift'}</Button>
              <Button variant="destructive" onClick={() => onDeleteRow(row)}>Delete</Button>
            </div>
          </div>
        )}
        {showEditor && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input 
                  type="date" 
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent" 
                  value={date} 
                  onChange={(e)=>setDate(e.target.value)} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
                <TimeField24 value={start} onChange={setStart} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
                <TimeField24 value={end} onChange={setEnd} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Area</label>
                <select 
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent" 
                  value={area} 
                  onChange={(e)=>setArea(e.target.value)}
                >
                  <option value="">Select area…</option>
                  <option>Front of House</option>
                  <option>Kitchen</option>
                  <option>Bar</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                onClick={save} 
                disabled={saving} 
                className="px-6 py-2 rounded-md bg-purple-600 text-white font-medium disabled:opacity-60 hover:bg-purple-700"
              >
                {saving ? 'Saving…' : 'Save Shift'}
              </Button>
              {embedded && (
                <Button 
                  variant="outline" 
                  onClick={onClose}
                  className="px-6 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </Button>
              )}
            </div>
            {err && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{err}</div>}
          </div>
        )}
      </div>
    );
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Inject shift pill styles */}
      <style dangerouslySetInnerHTML={{ __html: shiftPillStyles }} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Modern Header with Stats Cards */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-4 sm:space-y-0">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Team Management</h1>
              <p className="text-muted-foreground mt-1">Manage your staff, roles, and schedules</p>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Button 
                onClick={() => setActiveTab('staff')} 
                variant={activeTab === 'staff' ? 'default' : 'outline'}
                className="px-3 sm:px-6 text-sm sm:text-base flex-1 sm:flex-none"
              >
                <Users className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Staff</span>
                <span className="sm:hidden">Team</span>
              </Button>
              <Button 
                onClick={() => setActiveTab('calendar')} 
                variant={activeTab === 'calendar' ? 'default' : 'outline'}
                className="px-3 sm:px-6 text-sm sm:text-base flex-1 sm:flex-none"
              >
                <Calendar className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Schedule</span>
                <span className="sm:hidden">Calendar</span>
              </Button>
            </div>
          </div>

          {/* Modern Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-8">
            <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100/50">
              <CardContent className="p-3 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600">Total Staff</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {loading && !initialCounts && staff.length === 0 && (!initialStaff || initialStaff.length === 0) ? (
                        <div className="animate-pulse bg-blue-200 h-8 w-12 rounded"></div>
                      ) : (
                        staffCounts.totalStaff
                      )}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-green-100/50">
              <CardContent className="p-3 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-600">Active Staff</p>
                    <p className="text-2xl font-bold text-green-900">
                      {loading && !initialCounts && staff.length === 0 && (!initialStaff || initialStaff.length === 0) ? (
                        <div className="animate-pulse bg-green-200 h-8 w-12 rounded"></div>
                      ) : (
                        staffCounts.activeStaff
                      )}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-purple-100/50">
              <CardContent className="p-3 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-600">Roles</p>
                    <p className="text-2xl font-bold text-purple-900">
                      {loading && !initialCounts && staff.length === 0 && (!initialStaff || initialStaff.length === 0) ? (
                        <div className="animate-pulse bg-purple-200 h-8 w-12 rounded"></div>
                      ) : (
                        staffCounts.uniqueRoles
                      )}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-gradient-to-br from-orange-50 to-orange-100/50">
              <CardContent className="p-3 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-600">Active Shifts</p>
                    <p className="text-2xl font-bold text-orange-900">
                      {loading && !initialCounts && staff.length === 0 && (!initialStaff || initialStaff.length === 0) ? (
                        <div className="animate-pulse bg-orange-200 h-8 w-12 rounded"></div>
                      ) : (
                        staffCounts.activeShiftsCount
                      )}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center">
                    <Clock className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Modern Tab Content */}
        {activeTab === 'staff' && (
          <div className="space-y-6">
            {/* Add Staff Section */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Add Team Member</h3>
                    <p className="text-sm text-muted-foreground">Add new staff members to your team</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={async ()=>{
                        if (!confirm('This will delete all staff for this venue. Continue?')) return;
                        const res = await fetch('/api/staff/clear', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ venue_id: venueId })});
                        const j = await res.json().catch(()=>({}));
                        if (!res.ok || j?.error) { alert(j?.error || 'Failed to clear'); return; }
                        setStaff([]);
                      }}
                      className="text-red-600 hover:text-red-700"
                    >
                      Clear All
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-foreground mb-2">Name</label>
                    <Input 
                      placeholder="Enter staff member name" 
                      value={name} 
                      onChange={(e) => setName(e.target.value)} 
                      className="h-11"
                    />
                  </div>
                  <div className="lg:w-48">
                    <label className="block text-sm font-medium text-foreground mb-2">Role</label>
                    <select 
                      className="w-full h-11 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent" 
                      value={role} 
                      onChange={(e) => setRole(e.target.value)}
                    >
                      <option>Server</option>
                      <option>Barista</option>
                      <option>Cashier</option>
                      <option>Kitchen</option>
                      <option>Manager</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <Button 
                      onClick={onAdd} 
                      disabled={adding || !name.trim()}
                      className="h-11 px-8 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
                    >
                      {adding ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Adding...
                        </>
                      ) : (
                        <>
                          <Users className="w-4 h-4 mr-2" />
                          Add Member
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                {error && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                    <span className="text-red-600 text-sm">{error}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Staff List */}
            {roles.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-16">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Users className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">No team members yet</h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      Start building your team by adding staff members above. You'll be able to assign shifts and manage schedules once you have team members.
                    </p>
                    <Button 
                      onClick={() => {
                        const nameInput = document.querySelector('input[placeholder="Enter staff member name"]') as HTMLInputElement;
                        nameInput?.focus();
                      }}
                      variant="outline"
                    >
                      <Users className="w-4 h-4 mr-2" />
                      Add Your First Member
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {roles.map((role) => (
                  <Card key={role} className="border-0 shadow-sm">
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <Users className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-foreground">{role}</h3>
                            <p className="text-sm text-muted-foreground">{grouped[role].length} team member{grouped[role].length !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="px-3 py-1">
                          {grouped[role].length}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3">
                        {grouped[role].map((row) => (
                          <div key={row.id}>
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">
                                  <span className="text-sm font-medium text-gray-600">
                                    {row.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <p className="font-medium text-foreground">{row.name}</p>
                                  <p className="text-sm text-muted-foreground">{role}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingShiftFor(editingShiftFor === row.id ? null : row.id);
                                  }}
                                  className="text-blue-600 hover:text-blue-700"
                                >
                                  <Clock className="w-4 h-4 mr-1" />
                                  {editingShiftFor === row.id ? 'Cancel' : 'Add Shift'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => onDelete(row)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  Delete
                                </Button>
                              </div>
                            </div>
                            
                            {/* Shift Editor */}
                            {editingShiftFor === row.id && (
                              <StaffRowItem 
                                row={row} 
                                onDeleteRow={() => {}} 
                                onShiftsChanged={reloadAllShifts}
                                embedded={true}
                                onClose={() => setEditingShiftFor(null)}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Calendar View */}
        {activeTab === 'calendar' && (
          <div className="space-y-6">
            {/* Schedule Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Schedule Management</h2>
                <p className="text-muted-foreground mt-1">Manage shifts and schedules for your team</p>
              </div>
            </div>

            {/* Overnight Shift Legend */}
            <Card className="border-0 shadow-sm bg-gradient-to-r from-orange-50 to-orange-100/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                    <span className="text-white text-lg">🌙</span>
                  </div>
                  <div>
                    <span className="font-medium text-orange-800">Overnight Shifts</span>
                    <p className="text-orange-700">Shifts spanning multiple days are highlighted with special styling and indicators</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <CalendarView />
            
            {/* Modern Shifts List */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">All Scheduled Shifts</h3>
                    <p className="text-sm text-muted-foreground">Complete overview of all team schedules</p>
                  </div>
                  <Badge variant="secondary" className="px-3 py-1">
                    {allShifts.length} shifts
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {allShifts.length > 0 ? (
                  <div className="space-y-3">
                    {allShifts
                      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                      .map((shift) => {
                        const overnight = isOvernightShift(shift);
                        return (
                          <div key={shift.id} className={`group flex items-center justify-between p-4 rounded-lg border transition-all hover:shadow-sm ${
                            overnight 
                              ? 'bg-gradient-to-r from-orange-50 to-orange-100/50 border-orange-200' 
                              : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                          }`}>
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                  overnight ? 'bg-orange-500' : 'bg-purple-500'
                                }`}>
                                  <span className="text-white text-sm font-medium">
                                    {shift.staff_name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <span className={`font-semibold ${overnight ? 'text-orange-800' : 'text-purple-700'}`}>
                                    {shift.staff_name}
                                    {overnight && <span className="ml-2" title="Overnight Shift">🌙</span>}
                                  </span>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="text-xs">
                                      {shift.staff_role}
                                    </Badge>
                                    {overnight && (
                                      <Badge variant="outline" className="border-orange-300 text-orange-700 bg-orange-100 text-xs">
                                        Overnight
                                      </Badge>
                                    )}
                                    {isShiftActive(shift) && (
                                      <Badge className="bg-green-500 text-white text-xs">
                                        Active Now
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className={`text-sm ${overnight ? 'text-orange-600' : 'text-gray-600'}`}>
                                <div className="flex items-center gap-4">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(shift.start_time).toLocaleDateString()}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
                                  </span>
                                  {shift.area && (
                                    <span className="text-muted-foreground">
                                      • {shift.area}
                                    </span>
                                  )}
                                </div>
                                {overnight && (
                                  <div className="mt-1 text-orange-500 text-xs">
                                    Spans {new Date(shift.start_time).toLocaleDateString()} to {new Date(shift.end_time).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={async () => {
                                if (!confirm('Delete this shift?')) return;
                                const res = await fetch('/api/staff/shifts/delete', {
                                  method: 'POST',
                                  headers: { 'content-type': 'application/json' },
                                  body: JSON.stringify({ id: shift.id })
                                });
                                const j = await res.json().catch(() => ({}));
                                if (!res.ok || j?.error) {
                                  alert(j?.error || 'Failed to delete shift');
                                  return;
                                }
                                reloadAllShifts();
                              }}
                            >
                              Delete
                            </Button>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Calendar className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">No shifts scheduled</h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      Start creating shifts for your team members. You can schedule shifts and manage your team's availability.
                    </p>
                    {staff.length === 0 && (
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-700">
                          💡 <strong>Tip:</strong> Add team members first to create shifts with proper names.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}


