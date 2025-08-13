// app/dashboard/[venueId]/staff/staff-client.tsx
'use client';

import { useMemo, useState } from 'react';
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

  const openShiftFor = (staffId: string) => {
    alert(`Open shift editor for staff: ${staffId}`);
  };

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
          <Button onClick={onAdd} disabled={adding}>{adding ? 'Adding…' : 'Add'}</Button>
          {error && <span className="text-red-600 text-sm">{error}</span>}
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
                <div key={row.id} className="flex items-center justify-between rounded border p-3">
                  <div className="flex items-center gap-3">
                    <div className="font-medium">{row.name}</div>
                    {!row.active && <Badge variant="destructive">Inactive</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => openShiftFor(row.id)}>Shifts</Button>
                    <Button variant={row.active ? 'outline' : 'default'} onClick={() => onToggleActive(row)}>
                      {row.active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}


