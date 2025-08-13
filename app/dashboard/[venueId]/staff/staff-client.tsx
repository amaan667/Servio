// app/dashboard/[venueId]/staff/staff-client.tsx
'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import TimeField, { TimeValue } from '@/components/inputs/TimeField';
import { to24h, buildIsoFromLocal, isOvernight, addDaysISO } from '@/lib/time';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';

type StaffRow = {
  id: string;
  name: string;
  role: string;
  active: boolean;
  created_at: string;
};

export default function StaffClient({
  venueId,
  venueName,
  initialStaff,
}: {
  venueId: string;
  venueName: string;
  initialStaff: StaffRow[];
}) {
  const [staff, setStaff] = useState<StaffRow[]>(initialStaff || []);
  const [name, setName] = useState('');
  const [role, setRole] = useState('Server');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  type Shift = { id:string; staff_id:string; start_time:string; end_time:string; area?:string };

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
            <Button variant="outline" onClick={() => setShowEditor((v) => !v)}>{showEditor ? 'Close' : 'Shift'}</Button>
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
            <div>
              <div className="text-xs font-semibold mb-1">Active Shifts</div>
              {shifts.length ? (
                <div className="space-y-1">
                  {shifts.map((s)=> (
                    <div key={s.id} className="flex items-center justify-between text-xs text-gray-700">
                      <div>
                        {new Date(s.start_time).toLocaleDateString()} • {new Date(s.start_time).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', hour12: true })} – {new Date(s.end_time).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', hour12: true })}
                        {s.area ? <> • {s.area}</> : null}
                      </div>
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={async ()=>{
                        if (!confirm('Delete this shift?')) return;
                        const res = await fetch('/api/staff/shifts/delete', { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify({ id: s.id }) });
                        const j = await res.json().catch(()=>({}));
                        if (!res.ok || j?.error) { alert(j?.error || 'Failed to delete shift'); return; }
                        await load();
                        onShiftsChanged();
                      }}>Delete</Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-500">No shifts yet.</div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  });

  const grouped = useMemo(() => {
    const by: Record<string, StaffRow[]> = {};
    for (const r of staff) {
      if (!by[r.role]) by[r.role] = [];
      by[r.role].push(r);
    }
    return by;
  }, [staff]);

  const roles = Object.keys(grouped).sort();

  const [allShifts, setAllShifts] = useState<Shift[]>([]);
  const reloadAllShifts = useCallback(async ()=>{
    const res = await fetch(`/api/staff/shifts/list?venue_id=${encodeURIComponent(venueId)}`);
    const j = await res.json().catch(()=>({}));
    if (res.ok && !j?.error) setAllShifts(j.shifts || []);
  }, [venueId]);

  useEffect(()=>{ reloadAllShifts(); }, [reloadAllShifts]);

  const groupedByDay = useMemo(() => {
    const by: Record<string, Shift[]> = {};
    for (const s of allShifts) {
      const dObj = new Date(s.start_time);
      const year = dObj.getFullYear();
      if (year < 2000) continue; // skip clearly invalid legacy rows
      const day = dObj.toLocaleDateString('en-CA'); // YYYY-MM-DD in local tz
      if (!by[day]) by[day] = [];
      by[day].push(s);
    }
    for (const d of Object.keys(by)) {
      by[d].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    }
    const entries = Object.entries(by).sort((a,b)=> new Date(a[0]).getTime() - new Date(b[0]).getTime());
    return entries;
  }, [allShifts]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-4">
        <NavigationBreadcrumb />
      </div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Staff Management</h2>
        <p className="text-gray-500">Manage staff for {venueName}</p>
      </div>

      <Card className="mb-6">
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

      {/* per-row editors below; removed global shift editor to avoid list-wide re-renders */}

      {roles.length === 0 ? (
        <p className="text-gray-500">No staff yet.</p>
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
              {/* shift editor moved to global card above */}
            </CardContent>
          </Card>
        ))
      )}

      <Card className="mt-6">
        <CardHeader>
          <div className="font-semibold">All Active Shifts</div>
          <div className="text-sm text-gray-500">Grouped by day</div>
        </CardHeader>
        <CardContent className="space-y-4">
          {groupedByDay.length ? (
            groupedByDay.map(([day, shifts]) => (
              <div key={day}>
                <div className="text-sm font-semibold mb-2">{day}</div>
                <div className="space-y-1">
                  {shifts.map((s)=>{
                    const person = staff.find(p=>p.id===s.staff_id);
                    return (
                      <div key={s.id} className="flex items-center justify-between text-sm text-gray-700">
                        <div>
                          <span className="font-medium">{person?.name || '—'}</span>
                          {' '}• {new Date(s.start_time).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', hour12: true })}
                          {' '}– {new Date(s.end_time).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', hour12: true })}
                          {s.area ? <> • {s.area}</> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-gray-500">No shifts across all staff.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


