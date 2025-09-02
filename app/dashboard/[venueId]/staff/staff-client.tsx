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
          <div className="grid grid-cols-7 gap-1">
            {/* Day headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-2 text-center text-sm font-semibold text-gray-600">
                {day}
              </div>
            ))}
            
            {/* Calendar days */}
            {days.map((day, index) => {
              const shifts = getShiftsForDate(day.date);
              return (
                <div
                  key={index}
                  className={`min-h-[80px] p-1 border ${
                    day.isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                  } ${day.isToday ? 'ring-2 ring-purple-500' : ''}`}
                >
                  <div className={`text-xs p-1 text-right ${
                    day.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                  } ${day.isToday ? 'font-bold' : ''}`}>
                    {day.date.getDate()}
                  </div>
                  
                  {/* Shifts for this day */}
                  <div className="space-y-1">
                    {shifts.slice(0, 3).map(shift => {
                      const overnight = isOvernightShift(shift);
                      const isStartDay = new Date(shift.start_time).toLocaleDateString('en-CA') === day.date.toLocaleDateString('en-CA');
                      const isEndDay = new Date(shift.end_time).toLocaleDateString('en-CA') === day.date.toLocaleDateString('en-CA');
                      
                      return (
                        <div
                          key={shift.id}
                          className={`text-xs p-1 rounded truncate ${
                            overnight 
                              ? 'bg-orange-100 text-orange-800 border-2 border-orange-300' 
                              : 'bg-purple-100 text-purple-800'
                          } ${
                            overnight && isStartDay ? 'border-l-4 border-l-orange-500' : ''
                          } ${
                            overnight && isEndDay ? 'border-r-4 border-r-orange-500' : ''
                          }`}
                          title={`${shift.staff_name} (${shift.staff_role}) - ${formatTime(shift.start_time)} - ${formatTime(shift.end_time)}${shift.area ? ` - ${shift.area}` : ''}${overnight ? ' - Overnight Shift' : ''}`}
                        >
                          <div className="font-medium truncate flex items-center gap-1">
                            {shift.staff_name}
                            {overnight && (
                              <span className="text-orange-600" title="Overnight Shift">🌙</span>
                            )}
                          </div>
                          <div className={`truncate ${overnight ? 'text-orange-600' : 'text-purple-600'}`}>
                            {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                          </div>
                          {shift.area && (
                            <div className={`truncate ${overnight ? 'text-orange-500' : 'text-purple-500'}`}>
                              {shift.area}
                            </div>
                          )}
                          {overnight && (
                            <div className="text-xs text-orange-600 mt-1">
                              {isStartDay ? '→ continues tomorrow' : '← started yesterday'}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {shifts.length > 3 && (
                      <div className="text-xs text-gray-500 text-center">
                        +{shifts.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
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
                  <span>Shifts that span multiple days are shown on both start and end dates with orange styling and moon icon</span>
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


