'use client';
import { useEffect, useMemo, useState } from 'react';
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

  // On mount, check if staff table exists; if not, show inline hint
  const [needsInit, setNeedsInit] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/staff/check');
        const j = await res.json();
        if (j?.ok && j.exists === false) setNeedsInit(true);
      } catch {}
    })();
  }, []);

  const add = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (!name.trim()) { setError('Enter a name'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/staff/add', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ venue_id: venueId, name: name.trim(), role: role.trim() || 'Server' }),
      });
      const j = await res.json().catch(()=>({}));
      if (!res.ok || j?.error) throw new Error(j?.error || 'Failed');
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
          {needsInit && (
            <div className="text-sm text-amber-700 mt-2">
              Staff table is missing. Ask the owner to run scripts/staff-schema.sql in Supabase or click
              <Button className="ml-2" size="sm" variant="outline" onClick={async ()=>{ await fetch('/api/staff/init',{method:'POST'}); setNeedsInit(false); load(); }}>Init Now</Button>
            </div>
          )}
        </CardContent></Card>

        <div className="space-y-4">
          {useMemo(() => {
            if (!staff.length) return <div className="text-gray-500">No staff yet.</div>;
            // Group by role, sort roles and names
            const groups: Record<string, Staff[]> = {};
            for (const s of staff) {
              const r = (s.role || 'Staff').trim();
              if (!groups[r]) groups[r] = [];
              groups[r].push(s);
            }
            const preferred = ['Barista','Cashier','Server'];
            const roles = Object.keys(groups)
              .sort((a,b)=>{
                const ai = preferred.indexOf(a);
                const bi = preferred.indexOf(b);
                if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
                return a.localeCompare(b);
              });
            return roles.map(role => {
              const list = groups[role].slice().sort((a,b)=>a.name.localeCompare(b.name));
              return (
                <div key={role}>
                  <h2 className="text-sm font-semibold text-gray-700 mb-2">{role}</h2>
                  <div className="space-y-2">
                    {list.map(s => (
                      <Card key={s.id}><CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <div className="font-medium">{s.name}</div>
                          <div className="text-xs text-gray-500">{s.active ? 'Active' : 'Inactive'}</div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={()=>toggleActive(s.id, s.active)}>{s.active ? 'Deactivate' : 'Activate'}</Button>
                        </div>
                      </CardContent></Card>
                    ))}
                  </div>
                </div>
              );
            });
          }, [staff])}
        </div>
      </div>
    </div>
  );
}



