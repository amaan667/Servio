// app/dashboard/[venueId]/staff/staff-client.tsx
'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TimeField, { TimeValue } from '@/components/inputs/TimeField';
import { to24h, buildIsoFromLocal, isOvernight, addDaysISO } from '@/lib/time';
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
    display: grid;
    grid-template-rows: auto auto;
    gap: 2px;
    padding: 8px 10px;
    font-size: 12px;
    line-height: 1.1;
    white-space: nowrap;
    height: 100%;
  }

  .shift-line {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    min-height: 16px;
    align-items: center;
  }

  .shift-title {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    text-shadow: 0 1px 2px rgba(255,255,255,0.8);
  }

  .shift-time {
    opacity: 0.85;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    font-weight: 500;
  }

  .shift-role {
    opacity: 0.7;
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 500;
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

export default function StaffClient({
  venueId,
  venueName,
  initialStaff,
}: {
  venueId: string;
  venueName?: string;
  initialStaff?: StaffRow[];
}) {
  const [staff, setStaff] = useState<StaffRow[]>(initialStaff || []);
  const [name, setName] = useState('');
  const [role, setRole] = useState('Server');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allShifts, setAllShifts] = useState<Shift[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeTab, setActiveTab] = useState('staff');

  // Load staff data on component mount
  useEffect(() => {
    const loadStaff = async () => {
      try {
        console.log('[AUTH DEBUG] Loading staff for venue:', venueId);
        const res = await fetch(`/api/staff/check?venue_id=${encodeURIComponent(venueId)}`);
        const j = await res.json().catch(() => ({}));
        if (res.ok && !j?.error) {
          console.log('[AUTH DEBUG] Staff loaded:', j.staff?.length || 0, 'members');
          setStaff(j.staff || []);
        } else {
          console.error('[AUTH DEBUG] Failed to load staff:', j?.error);
        }
      } catch (e) {
        console.error('[AUTH DEBUG] Failed to load staff:', e);
      }
    };

    // Only load if no initial staff provided
    if (!initialStaff || initialStaff.length === 0) {
      loadStaff();
    }
  }, [venueId, initialStaff]);

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
      } else {
        console.error('[AUTH DEBUG] Failed to load shifts:', j?.error);
      }
    };
    loadShifts();
  }, [venueId]);

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
    const days = getDaysInMonth(currentMonth);
    const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const goToPreviousMonth = () => {
      setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    };

    const goToNextMonth = () => {
      setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    };

    const goToToday = () => {
      setCurrentMonth(new Date());
    };

    // Helper function to split shifts into week-sized spans for proper rendering
    const splitShiftIntoWeekSpans = (shift: Shift) => {
      const start = new Date(shift.start_time);
      const end = new Date(shift.end_time);
      const isOvernight = start.toDateString() !== end.toDateString();
      
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
      let currentDate = new Date(start);
      let weekIndex = 0;
      let isFirst = true;

      while (currentDate <= end) {
        const weekStart = new Date(currentDate);
        const weekEnd = new Date(currentDate);
        
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
        currentDate = new Date(weekEnd);
        currentDate.setDate(currentDate.getDate() + 1);
        weekIndex++;
        isFirst = false;
      }

      return spans;
    };

    // Helper function to compute grid placement for shifts
    const computeGridPlacement = (start: Date, end: Date) => {
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const startDayOfWeek = startOfMonth.getDay();
      
      // Calculate week row index (0-based)
      const startDate = new Date(start);
      const daysFromStart = Math.floor((startDate.getTime() - startOfMonth.getTime()) / (1000 * 60 * 60 * 24));
      const weekRow = Math.floor((daysFromStart + startDayOfWeek) / 7);
      
      // Calculate column start (1-7, where 1 = Sunday)
      const colStart = startDate.getDay() + 1;
      
      // Calculate how many columns to span - limit to actual days spanned
      const endDate = new Date(end);
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      // Ensure we don't span more than the actual days difference + 1
      const spanCols = Math.min(7 - colStart + 1, Math.max(1, daysDiff + 1));
      
      return { row: weekRow + 1, colStart, spanCols };
    };

    // Get all shifts for the current month view - be more inclusive
    const getShiftsForMonth = () => {
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      
      const filteredShifts = allShifts.filter(shift => {
        const shiftStart = new Date(shift.start_time);
        const shiftEnd = new Date(shift.end_time);
        
        // Include shift if it starts, ends, or overlaps with the month view
        const startsInMonth = shiftStart >= startOfMonth && shiftStart <= endOfMonth;
        const endsInMonth = shiftEnd >= startOfMonth && shiftEnd <= endOfMonth;
        const spansMonth = shiftStart < startOfMonth && shiftEnd > endOfMonth;
        
        return startsInMonth || endsInMonth || spansMonth;
      });
      
      return filteredShifts;
    };

    const monthShifts = getShiftsForMonth();
    const shiftSpans = monthShifts.flatMap(splitShiftIntoWeekSpans);

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Staff Calendar</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToToday}>
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="text-2xl font-bold text-center">{monthName}</div>
        </CardHeader>
        <CardContent>
          <div className="relative calendar">
            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
              {/* Day headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
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
              {shiftSpans.map(span => {
                const cellWidth = 100 / 7; // Each day cell width as percentage
                const left = (span.colStart - 1) * cellWidth;
                const width = Math.min(span.spanCols * cellWidth, 100 - left); // Don't exceed right edge
                const top = span.weekIndex * 120 + 40; // 120px day height + 40px header offset
                
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
                      height: '80px'
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
                      <div className="shift-line">
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

  const StaffRowItem = memo(function StaffRowItem({ row, onDeleteRow, onShiftsChanged }: { row: StaffRow; onDeleteRow: (r: StaffRow) => void; onShiftsChanged: () => void }) {
    const [showEditor, setShowEditor] = useState(false);
    const [date, setDate] = useState('');
    const [start, setStart] = useState<TimeValue>({ hour: null, minute: null, ampm: 'AM' });
    const [end, setEnd] = useState<TimeValue>({ hour: null, minute: null, ampm: 'PM' });
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
      const s24 = to24h(start.hour, start.minute, start.ampm);
      const e24 = to24h(end.hour, end.minute, end.ampm);
      const overnight = isOvernight(s24.hour, s24.minute, e24.hour, e24.minute);
      const startIso = buildIsoFromLocal(date, s24.hour, s24.minute);
      const endDate = overnight ? addDaysISO(date, 1) : date;
      const endIso = buildIsoFromLocal(endDate, e24.hour, e24.minute);
      const res = await fetch('/api/staff/shifts/add', { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify({ staff_id: row.id, venue_id: venueId, start_time: startIso, end_time: endIso, area: area || null }) });
      const j = await res.json().catch(()=>({}));
      if (!res.ok || j?.error) { setErr(j?.error || 'Failed to save shift'); setSaving(false); return; }
      setSaving(false);
      setArea('');
      setStart({ hour: null, minute: null, ampm: 'AM' });
      setEnd({ hour: null, minute: null, ampm: 'PM' });
      await load();
      onShiftsChanged();
    }, [area, date, end.ampm, end.hour, end.minute, load, onShiftsChanged, row.id, start.ampm, start.hour, start.minute, venueId]);

    return (
      <div className="rounded border p-3">
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
        {showEditor && (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input type="date" className="w-full rounded-md border px-3 py-2" value={date} onChange={(e)=>setDate(e.target.value)} />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
                <TimeField value={start} onChange={setStart} />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">End</label>
                <TimeField value={end} onChange={setEnd} />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
                <select className="w-full rounded-md border px-3 py-2" value={area} onChange={(e)=>setArea(e.target.value)}>
                  <option value="">Select…</option>
                  <option>Front of House</option>
                  <option>Kitchen</option>
                  <option>Bar</option>
                </select>
              </div>
              <div>
                <Button onClick={save} disabled={saving} className="w-full md:w-auto h-10 px-4 rounded-md bg-purple-600 text-white font-medium disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</Button>
              </div>
            </div>
            {err && <div className="text-sm text-red-600">{err}</div>}
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
        {/* Staff Stats */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{staff.length} staff members</span>
            </div>
            <span className="text-sm text-muted-foreground">•</span>
            <span className="text-sm text-muted-foreground">
              {staff.filter(s => s.active).length} active
            </span>
            <span className="text-sm text-muted-foreground">•</span>
            <span className="text-sm text-muted-foreground">
              {roles.length} roles
            </span>
            <span className="text-sm text-muted-foreground">•</span>
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {activeShifts.length} active shifts
              </span>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="staff">Staff Management</TabsTrigger>
            <TabsTrigger value="calendar">Calendar View</TabsTrigger>
          </TabsList>

          <TabsContent value="staff" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="font-semibold">Add Staff</div>
              </CardHeader>
              <CardContent className="flex flex-col md:flex-row gap-3">
                <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="md:w-1/2" />
                <select className="border rounded px-3 py-2 md:w-1/3" value={role} onChange={(e) => setRole(e.target.value)}>
                  <option>Server</option>
                  <option>Barista</option>
                  <option>Cashier</option>
                  <option>Kitchen</option>
                  <option>Manager</option>
                </select>
                <div className="flex gap-2">
                  <Button onClick={onAdd} disabled={adding}>{adding ? 'Adding…' : 'Add'}</Button>
                  <Button variant="outline" onClick={async ()=>{
                    if (!confirm('This will delete all staff for this venue. Continue?')) return;
                    const res = await fetch('/api/staff/clear', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ venue_id: venueId })});
                    const j = await res.json().catch(()=>({}));
                    if (!res.ok || j?.error) { alert(j?.error || 'Failed to clear'); return; }
                    setStaff([]);
                  }}>Clear</Button>
                </div>
                {error && <span className="text-red-600 text-sm">{error}</span>}
              </CardContent>
            </Card>

            {roles.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No staff members added yet.</p>
                <p className="text-sm text-gray-400 mb-4">
                  Add staff members above to see their names instead of "Unknown Unknown" in shifts.
                </p>
              </div>
            ) : (
              roles.map((r) => (
                <Card key={r} className="mb-4">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{r}</span>
                      <Badge variant="secondary">{grouped[r].length}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {grouped[r].map((row) => (
                      <StaffRowItem key={row.id} row={row} onDeleteRow={onDelete} onShiftsChanged={reloadAllShifts} />
                    ))}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="calendar" className="space-y-6">
            {/* Overnight Shift Legend */}
            <Card className="bg-orange-50 border-orange-200">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-sm text-orange-700">
                  <span>🌙</span>
                  <span className="font-medium">Overnight Shifts:</span>
                  <span>Shifts spanning multiple days show as continuous pills with rounded edges only at week boundaries. Each pill has proper contrast and hover effects for easy interaction.</span>
                </div>
              </CardContent>
            </Card>
            
            <CalendarView />
            
            {/* All Shifts List */}
            <Card>
              <CardHeader>
                <div className="font-semibold">All Shifts</div>
                <div className="text-sm text-gray-500">Complete list of all scheduled shifts</div>
              </CardHeader>
              <CardContent className="space-y-4">
                {allShifts.length > 0 ? (
                  <div className="space-y-3">
                    {allShifts
                      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                      .map((shift) => {
                        const overnight = isOvernightShift(shift);
                        return (
                          <div key={shift.id} className={`flex items-center justify-between p-3 rounded-lg ${
                            overnight ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50'
                          }`}>
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <span className={`font-medium ${overnight ? 'text-orange-700' : 'text-purple-600'}`}>
                                  {shift.staff_name}
                                  {overnight && <span className="ml-1" title="Overnight Shift">🌙</span>}
                                </span>
                                <Badge variant="outline">{shift.staff_role}</Badge>
                                {overnight && (
                                  <Badge variant="outline" className="border-orange-300 text-orange-700 bg-orange-100">
                                    Overnight
                                  </Badge>
                                )}
                                {isShiftActive(shift) && (
                                  <Badge variant="default" className="bg-green-100 text-green-800">
                                    Active Now
                                  </Badge>
                                )}
                              </div>
                              <div className={`text-sm mt-1 ${overnight ? 'text-orange-600' : 'text-gray-600'}`}>
                                {new Date(shift.start_time).toLocaleDateString()} • {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
                                {shift.area && <> • {shift.area}</>}
                                {overnight && (
                                  <span className="ml-2 text-orange-500">
                                    (spans {new Date(shift.start_time).toLocaleDateString()} to {new Date(shift.end_time).toLocaleDateString()})
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600"
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
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-500 mb-2">No shifts scheduled yet.</p>
                    {staff.length === 0 && (
                      <p className="text-xs text-gray-400">
                        Note: Add staff members first to create shifts with proper names.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


