// app/dashboard/[venueId]/staff/staff-client.tsx
'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import TimeField24, { TimeValue24 } from '@/components/inputs/TimeField24';
import { buildIsoFromLocal, isOvernight, addDaysISO } from '@/lib/time';
import { Users, Clock, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import SimpleStaffGrid from '@/components/staff/SimpleStaffGrid';


type StaffRow = {
  id: string;
  name: string;
  role: string;
  active: boolean;
  created_at: string;
};

type LegacyShift = { 
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
  const [allShifts, setAllShifts] = useState<LegacyShift[]>([]);
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



  // Memoize counts to prevent flickering - use real-time data when available
  const staffCounts = useMemo(() => {
    console.log('[STAFF DEBUG] initialCounts:', initialCounts);
    console.log('[STAFF DEBUG] initialStaff:', initialStaff);
    console.log('[STAFF DEBUG] staff:', staff);
    console.log('[STAFF DEBUG] allShifts:', allShifts);
    
    // Use real-time staff data if available, otherwise fall back to initial counts
    const currentStaff = staff.length > 0 ? staff : (initialStaff || []);
    const hasRealTimeData = staff.length > 0;
    
    if (hasRealTimeData) {
      console.log('[STAFF DEBUG] Using real-time staff data');
      const totalStaff = currentStaff.length;
      const activeStaff = currentStaff.filter(s => s.active === true).length;
      const uniqueRoles = roles.length;
      
      // Calculate active shifts count
      const now = new Date();
      const activeShiftsCount = allShifts.filter(shift => {
        const start = new Date(shift.start_time);
        const end = new Date(shift.end_time);
        return now >= start && now <= end;
      }).length;
      
      return {
        totalStaff,
        activeStaff,
        uniqueRoles,
        activeShiftsCount
      };
    }
    
    // Fallback to initial counts from server if no real-time data
    if (initialCounts) {
      console.log('[STAFF DEBUG] Using initialCounts from server');
      return {
        totalStaff: initialCounts.total_staff,
        activeStaff: initialCounts.active_staff,
        uniqueRoles: initialCounts.unique_roles,
        activeShiftsCount: initialCounts.active_shifts_count
      };
    }
    
    // Final fallback - return zeros if no data available
    console.log('[STAFF DEBUG] No data available, returning zeros');
    return {
      totalStaff: 0,
      activeStaff: 0,
      uniqueRoles: 0,
      activeShiftsCount: 0
    };
  }, [initialCounts, staff.length, staff, roles.length, loading, initialStaff, allShifts]);



  const StaffRowItem = memo(function StaffRowItem({ row, onDeleteRow, onShiftsChanged, embedded = false, onClose }: { row: StaffRow; onDeleteRow: (r: StaffRow) => void; onShiftsChanged: () => void; embedded?: boolean; onClose?: () => void }) {
    const [showEditor, setShowEditor] = useState(embedded);
    const [date, setDate] = useState('');
    const [start, setStart] = useState<TimeValue24>({ hour: null, minute: null });
    const [end, setEnd] = useState<TimeValue24>({ hour: null, minute: null });
    const [area, setArea] = useState('');
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [shifts, setShifts] = useState<LegacyShift[]>([]);

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
                            <div className={`flex items-center justify-between p-4 rounded-lg transition-colors ${
                              row.active 
                                ? 'bg-gray-50 hover:bg-gray-100' 
                                : 'bg-gray-100 hover:bg-gray-200 opacity-60'
                            }`}>
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm ${
                                  row.active ? 'bg-white' : 'bg-gray-200'
                                }`}>
                                  <span className={`text-sm font-medium ${
                                    row.active ? 'text-gray-600' : 'text-gray-400'
                                  }`}>
                                    {row.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <p className={`font-medium ${
                                    row.active ? 'text-foreground' : 'text-muted-foreground'
                                  }`}>
                                    {row.name}
                                    {!row.active && <span className="ml-2 text-xs text-gray-400">(Inactive)</span>}
                                  </p>
                                  <p className="text-sm text-muted-foreground">{role}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">Active:</span>
                                  <Switch
                                    checked={row.active}
                                    onCheckedChange={() => onToggleActive(row)}
                                    className="data-[state=checked]:bg-green-500"
                                  />
                                </div>
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
            
            <SimpleStaffGrid shifts={allShifts} venueId={venueId} />
          </div>
        )}
      </div>
    </div>
  );
}


