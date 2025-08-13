'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/sb-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NavBar } from '@/components/NavBar';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';

type Staff = { id: string; name: string; role: string; active: boolean };

export default function StaffClient({ venueId }: { venueId: string }) {
  const router = useRouter();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [name, setName] = useState('');
  const [role, setRole] = useState('Server');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    const { data, error } = await supabase
      .from('staff')
      .select('id,name,role,active')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[STAFF] load error', error);
      setError(error.message);
    }
    setStaff(data || []);
  };

  useEffect(() => { load(); }, [venueId]);

  const add = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (!name.trim()) { setError('Enter a name'); return; }
    setLoading(true);
    try {
      const { error } = await supabase
        .from('staff')
        .insert({ venue_id: venueId, name: name.trim(), role: role.trim() || 'Server' });
      if (error) throw error;
      setName(''); setRole('Server');
      await load();
    } catch (err: any) {
      console.error('[STAFF] add error', err);
      setError(err?.message || 'Failed to add staff');
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (id: string, active: boolean) => {
    setError(null);
    const { error } = await supabase.from('staff').update({ active: !active }).eq('id', id);
    if (error) { console.error('[STAFF] toggle error', error); setError(error.message); }
    else load();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="max-w-5xl mx-auto p-6">
        <NavigationBreadcrumb customBackPath={`/dashboard/${venueId}`} customBackLabel="Dashboard" />
        <h1 className="text-2xl font-semibold mb-4">Staff Management</h1>

        <Card className="mb-4"><CardContent className="p-4">
          <form className="flex flex-col sm:flex-row gap-2" onSubmit={add}>
            <Input placeholder="Name" value={name} onChange={e=>setName(e.target.value)} />
            <Input placeholder="Role (e.g. Barista)" value={role} onChange={e=>setRole(e.target.value)} />
            <Button type="submit" disabled={loading}>{loading ? 'Adding...' : 'Add'}</Button>
          </form>
          {error && <div className="text-sm text-red-600 mt-2">{error}</div>}
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
    </div>
  );
}



