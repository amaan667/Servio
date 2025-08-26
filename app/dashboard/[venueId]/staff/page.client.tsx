'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import NavigationBreadcrumb from '@/components/navigation-breadcrumb';
import { useAuth } from "@/app/authenticated-client-provider";
import { Plus, Trash2, Clock, User } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Staff = { id: string; name: string; role: string; active: boolean; area?: string | null };
type Shift = { id: string; staff_id: string; start_time: string; end_time: string; area?: string | null };

export default function StaffClient({ venueId }: { venueId: string }) {
  const router = useRouter();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [name, setName] = useState('');
  const [role, setRole] = useState('Server');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [openShiftFor, setOpenShiftFor] = useState<string | null>(null);
  const [shiftStart, setShiftStart] = useState('');
  const [shiftEnd, setShiftEnd] = useState('');
  const [shiftArea, setShiftArea] = useState('');

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

  const add = async () => {
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
      // Append new staff locally for immediacy
      const inserted = (j?.data && j.data[0]) ? j.data[0] : { id: crypto.randomUUID(), name: name.trim(), role: role.trim() || 'Server', active: true };
      setStaff(prev => [inserted, ...prev]);
      setName(''); setRole('Server');
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

  async function updateRole(id: string, role: string) {
    await supabase.from('staff').update({ role }).eq('id', id);
    load();
  }

  async function updateArea(id: string, area: string) {
    await supabase.from('staff').update({ area }).eq('id', id);
    load();
  }

  async function addShift(staffId: string) {
    if (!shiftStart || !shiftEnd) return;
    const { error } = await supabase.from('staff_shifts').insert({ staff_id: staffId, start_time: shiftStart, end_time: shiftEnd, area: shiftArea || null });
    if (!error) {
      setOpenShiftFor(null); setShiftStart(''); setShiftEnd(''); setShiftArea('');
      loadShifts();
    }
  }

  async function loadShifts() {
    const today = new Date(); today.setHours(0,0,0,0);
    const startIso = today.toISOString();
    const endIso = new Date(today.getTime() + 24*60*60*1000).toISOString();
    const { data } = await supabase
      .from('staff_shifts')
      .select('id,staff_id,start_time,end_time,area')
      .gte('start_time', startIso)
      .lt('end_time', endIso);
    setShifts((data || []) as any);
  }

  useEffect(()=>{ loadShifts(); }, [venueId]);

  return (
    <div className="space-y-6">
        <NavigationBreadcrumb customBackPath={`/dashboard/${venueId}`} customBackLabel="Dashboard" venueId={venueId} />
        <h1 className="text-2xl font-semibold mb-4">Staff Management</h1>

        <Card className="mb-4"><CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input placeholder="Name" value={name} onChange={e=>setName(e.target.value)} />
            <Input placeholder="Role (e.g. Barista)" value={role} onChange={e=>setRole(e.target.value)} />
            <Button type="button" onClick={()=>add()} disabled={loading}>{loading ? 'Adding...' : 'Add'}</Button>
          </div>
          {error && <div className="text-sm text-red-600 mt-2">{error}</div>}
          {needsInit && (
            <div className="text-sm text-amber-700 mt-2">
              Staff table is missing. Ask the owner to run scripts/staff-schema.sql in Supabase or click
              <Button className="ml-2" size="sm" variant="outline" onClick={async ()=>{ await fetch('/api/staff/init',{method:'POST'}); setNeedsInit(false); load(); }}>Init Now</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
          {useMemo(() => {
            if (!staff.length) return <div className="text-gray-500">No staff yet.</div>;
            const groups: Record<string, Staff[]> = {};
            for (const s of staff) {
              const r = (s.role || 'Staff').trim();
              if (!groups[r]) groups[r] = [];
              groups[r].push(s);
            }
            const preferred = ['Manager','Kitchen','Barista','Cashier','Server'];
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
                      <Card key={s.id}><CardContent className="p-4">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{s.name}{s.area ? <span className="text-xs text-gray-500"> • {s.area}</span> : null}</div>
                              <div className="text-xs text-gray-500">{s.active ? 'Active' : 'Inactive'}</div>
                            </div>
                            <div className="flex gap-2">
                              <select value={s.role} onChange={e=>updateRole(s.id, e.target.value)} className="border rounded px-2 py-1 text-sm">
                                {['Manager','Kitchen','Barista','Cashier','Server'].map(r=>(<option key={r} value={r}>{r}</option>))}
                              </select>
                              <select value={s.area || ''} onChange={e=>updateArea(s.id, e.target.value)} className="border rounded px-2 py-1 text-sm">
                                <option value="">Area</option>
                                {['Counter','Kitchen','Table Service'].map(a=>(<option key={a} value={a}>{a}</option>))}
                              </select>
                              <Button variant="outline" onClick={()=>toggleActive(s.id, s.active)}>{s.active ? 'Deactivate' : 'Activate'}</Button>
                            </div>
                          </div>
                          <div>
                            {openShiftFor === s.id ? (
                              <div className="flex flex-wrap gap-2 items-center">
                                <input type="datetime-local" className="border rounded px-2 py-1 text-sm" value={shiftStart} onChange={e=>setShiftStart(e.target.value)} />
                                <input type="datetime-local" className="border rounded px-2 py-1 text-sm" value={shiftEnd} onChange={e=>setShiftEnd(e.target.value)} />
                                <input type="text" className="border rounded px-2 py-1 text-sm" placeholder="Area (optional)" value={shiftArea} onChange={e=>setShiftArea(e.target.value)} />
                                <Button size="sm" onClick={()=>addShift(s.id)}>Add Shift</Button>
                                <Button size="sm" variant="ghost" onClick={()=>{ setOpenShiftFor(null); setShiftStart(''); setShiftEnd(''); setShiftArea(''); }}>Cancel</Button>
                              </div>
                            ) : (
                              <Button size="sm" variant="outline" onClick={()=>{ setOpenShiftFor(s.id); setShiftStart(''); setShiftEnd(''); setShiftArea(s.area || ''); }}>Add Shift</Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    ))}
                  </div>
                </div>
              );
            });
          }, [staff, openShiftFor, shiftStart, shiftEnd, shiftArea])}
      </div>

        <div className="mt-8">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Today's Shifts</h2>
          {!shifts.length ? (
            <div className="text-gray-500 text-sm">No shifts scheduled today.</div>
          ) : (
            <div className="space-y-1 text-sm text-gray-700">
              {shifts.map(sh => {
                const person = staff.find(s=>s.id===sh.staff_id);
                return (
                  <div key={sh.id}>
                    {person?.name || 'Staff'} • {new Date(sh.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}–{new Date(sh.end_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}{sh.area?` • ${sh.area}`:''}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



