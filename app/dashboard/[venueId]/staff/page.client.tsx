'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/sb-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Staff = { id: string; name: string; role: string; active: boolean };

export default function StaffClient({ venueId }: { venueId: string }) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [name, setName] = useState('');
  const [role, setRole] = useState('Server');

  const load = async () => {
    const { data } = await supabase.from('staff').select('id,name,role,active').eq('venue_id', venueId).order('created_at', { ascending: false });
    setStaff(data || []);
  };

  useEffect(() => { load(); }, [venueId]);

  const add = async () => {
    if (!name.trim()) return;
    await supabase.from('staff').insert({ venue_id: venueId, name: name.trim(), role });
    setName(''); setRole('Server');
    load();
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from('staff').update({ active: !active }).eq('id', id);
    load();
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Staff Management</h1>
      <Card className="mb-4"><CardContent className="p-4 flex gap-2">
        <Input placeholder="Name" value={name} onChange={e=>setName(e.target.value)} />
        <Input placeholder="Role" value={role} onChange={e=>setRole(e.target.value)} />
        <Button onClick={add}>Add</Button>
      </CardContent></Card>
      <div className="space-y-2">
        {staff.map(s => (
          <Card key={s.id}><CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">{s.name}</div>
              <div className="text-sm text-gray-600">{s.role} • {s.active ? 'Active' : 'Inactive'}</div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={()=>toggleActive(s.id, s.active)}>{s.active ? 'Deactivate' : 'Activate'}</Button>
            </div>
          </CardContent></Card>
        ))}
        {!staff.length && <div className="text-gray-500">No staff yet.</div>}
      </div>
    </div>
  );
}


