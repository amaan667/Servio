// app/dashboard/[venueId]/staff/staff-client.tsx
'use client';

import { useEffect, useMemo, useState, Fragment } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

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
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const selectedStaff = useMemo(() => staff.find(s => s.id === selectedStaffId) || null, [staff, selectedStaffId]);
  const [shiftDate, setShiftDate] = useState('');
  const [shiftStart, setShiftStart] = useState('');
  const [shiftEnd, setShiftEnd] = useState('');
  const [shiftArea, setShiftArea] = useState('');
  type Shift = { id:string; staff_id:string; start_time:string; end_time:string; area?:string };
  const [shiftsByStaff, setShiftsByStaff] = useState<Record<string, Shift[]>>({});
  const [savingShift, setSavingShift] = useState(false);
  const [shiftsError, setShiftsError] = useState<string | null>(null);

  const openShiftFor = (staffId: string) => {
    setSelectedStaffId(staffId);
    const el = document.getElementById('shift-editor');
    if (el) el.scrollIntoView({ behavior:'smooth', block:'center' });
  };

  const loadShifts = async (staffId?: string) => {
    const target = staffId || selectedStaffId;
    if (!target) return;
    const res = await fetch(`/api/staff/shifts/list?venue_id=${encodeURIComponent(venueId)}&staff_id=${encodeURIComponent(target)}`);
    const j = await res.json().catch(()=>({}));
    if (!res.ok || j?.error) { setShiftsError(j?.error || 'Failed to load shifts'); return; }
    setShiftsByStaff((prev) => ({ ...prev, [target]: j.shifts || [] }));
  };

  useEffect(() => { loadShifts(); }, [selectedStaffId]);

  function formatTime12h(time: string): string {
    if (!time) return '';
    const [hh = '0', mm = '00'] = time.split(':');
    let h = parseInt(hh, 10);
    if (Number.isNaN(h)) return time;
    const suffix = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${mm} ${suffix}`;
  }

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

  function ShiftRow({
    value,
    onChange,
    onSave,
    areas = ['Front of House', 'Kitchen', 'Bar'],
    disabled,
  }: {
    value: { date: string; start: string; end: string; area?: string };
    onChange: (p: Partial<{ date: string; start: string; end: string; area?: string }>) => void;
    onSave: () => void;
    areas?: string[];
    disabled?: boolean;
  }) {
    return (
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input
            type="date"
            className="w-full rounded-md border px-3 py-2"
            value={value.date}
            onChange={(e) => onChange({ date: e.target.value })}
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
          <input
            type="time"
            className="w-full rounded-md border px-3 py-2"
            step={60}
            value={value.start}
            onChange={(e) => onChange({ start: e.target.value })}
          />
          {value.start && <div className="text-xs text-gray-500 mt-1">{formatTime12h(value.start)}</div>}
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">End</label>
          <input
            type="time"
            className="w-full rounded-md border px-3 py-2"
            step={60}
            value={value.end}
            onChange={(e) => onChange({ end: e.target.value })}
          />
          {value.end && <div className="text-xs text-gray-500 mt-1">{formatTime12h(value.end)}</div>}
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
          <select
            className="w-full rounded-md border px-3 py-2"
            value={value.area ?? ''}
            onChange={(e) => onChange({ area: e.target.value })}
          >
            <option value="">Select…</option>
            {areas.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <button
          onClick={onSave}
          disabled={disabled}
          className="h-10 px-4 rounded-md bg-purple-600 text-white font-medium md:ml-2 disabled:opacity-60"
        >
          Save
        </button>
      </div>
    );
  }

  const grouped = useMemo(() => {
    const by: Record<string, StaffRow[]> = {};
    for (const r of staff) {
      if (!by[r.role]) by[r.role] = [];
      by[r.role].push(r);
    }
    return by;
  }, [staff]);

  const roles = Object.keys(grouped).sort();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
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

      <Card id="shift-editor" className="mb-6">
        <CardHeader>
          <div className="font-semibold">Shift</div>
          <div className="text-sm text-gray-500">
            {selectedStaff ? (
              <>For <span className="font-medium">{selectedStaff.name}</span> ({selectedStaff.role})</>
            ) : (
              <>Select a staff member by clicking the “Shift” button next to their name.</>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ShiftRow
            value={{ date: shiftDate, start: shiftStart, end: shiftEnd, area: shiftArea }}
            onChange={(p)=>{
              if ('date' in p) setShiftDate(p.date as string);
              if ('start' in p) setShiftStart(p.start as string);
              if ('end' in p) setShiftEnd(p.end as string);
              if ('area' in p) setShiftArea((p.area as string) ?? '');
            }}
            onSave={async ()=>{
              setShiftsError(null);
              if (!selectedStaffId) { setShiftsError('Choose a staff member'); return; }
              if (!shiftDate || !shiftStart || !shiftEnd) { setShiftsError('Date, start and end are required'); return; }
              setSavingShift(true);
              const startIso = new Date(`${shiftDate}T${shiftStart}:00`).toISOString();
              let endDate = shiftDate;
              if (shiftEnd < shiftStart) {
                const d = new Date(shiftDate); d.setDate(d.getDate() + 1); endDate = d.toISOString().slice(0,10);
              }
              const endIso = new Date(`${endDate}T${shiftEnd}:00`).toISOString();
              const res = await fetch('/api/staff/shifts/add', { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify({ staff_id: selectedStaffId, venue_id: venueId, start_time: startIso, end_time: endIso, area: shiftArea || null }) });
              const j = await res.json().catch(()=>({}));
              if (!res.ok || j?.error) { setShiftsError(j?.error || 'Failed to save shift'); setSavingShift(false); return; }
              setSavingShift(false);
              setShiftStart(''); setShiftEnd(''); setShiftArea('');
              await loadShifts(selectedStaffId);
            }}
            disabled={!selectedStaffId || savingShift}
          />
          {shiftsError && <div className="text-sm text-red-600">{shiftsError}</div>}
          <div className="mt-2">
            <div className="text-sm font-semibold mb-2">Active Shifts</div>
            {selectedStaffId ? (
              (shiftsByStaff[selectedStaffId]?.length ?? 0) ? (
                <div className="space-y-2">
                  {shiftsByStaff[selectedStaffId]!.map(s => (
                    <div key={s.id} className="flex items-center justify-between rounded border p-3">
                      <div className="text-sm text-gray-700">
                        {new Date(s.start_time).toLocaleDateString()} • {new Date(s.start_time).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })} – {new Date(s.end_time).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
                        {s.area ? <> • {s.area}</> : null}
                      </div>
                      <Button variant="destructive" onClick={async ()=>{
                        if (!confirm('Delete this shift?')) return;
                        const res = await fetch('/api/staff/shifts/delete', { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify({ id: s.id }) });
                        const j = await res.json().catch(()=>({}));
                        if (!res.ok || j?.error) { alert(j?.error || 'Failed to delete shift'); return; }
                        await loadShifts(selectedStaffId);
                      }}>Delete</Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500">No shifts yet for this staff member.</div>
              )
            ) : (
              <div className="text-sm text-gray-500">Choose a staff member to view shifts.</div>
            )}
          </div>
        </CardContent>
      </Card>

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
                <Fragment key={row.id}>
                  <div className="flex items-center justify-between rounded border p-3">
                    <div className="flex items-center gap-3">
                      <div className="font-medium">{row.name}</div>
                      {!row.active && <Badge variant="destructive">Inactive</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" onClick={() => openShiftFor(row.id)}>Shift</Button>
                      <Button variant="destructive" onClick={() => onDelete(row)}>Delete</Button>
                    </div>
                  </div>
                  {selectedStaffId === row.id && (
                    <div className="mt-2 ml-2 border-l pl-3">
                      <div className="text-xs font-semibold mb-1">Active Shifts for {row.name}</div>
                      {(shiftsByStaff[row.id]?.length ?? 0) ? (
                        <div className="space-y-1">
                          {shiftsByStaff[row.id]!.map(s => (
                            <div key={s.id} className="flex items-center justify-between text-xs text-gray-700">
                              <div>
                                {new Date(s.start_time).toLocaleDateString()} • {new Date(s.start_time).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })} – {new Date(s.end_time).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
                                {s.area ? <> • {s.area}</> : null}
                              </div>
                              <Button size="sm" variant="ghost" className="text-red-600" onClick={async ()=>{
                                if (!confirm('Delete this shift?')) return;
                                const res = await fetch('/api/staff/shifts/delete', { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify({ id: s.id }) });
                                const j = await res.json().catch(()=>({}));
                                if (!res.ok || j?.error) { alert(j?.error || 'Failed to delete shift'); return; }
                                await loadShifts(row.id);
                              }}>Delete</Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500">No shifts yet.</div>
                      )}
                    </div>
                  )}
                </Fragment>
              ))}
              {/* shift editor moved to global card above */}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}


