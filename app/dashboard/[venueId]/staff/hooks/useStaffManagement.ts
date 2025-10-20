import { useState, useEffect } from 'react';

export type StaffRow = {
  id: string;
  name: string;
  role: string;
  active: boolean;
  created_at: string;
};

export type LegacyShift = { 
  id: string; 
  staff_id: string; 
  start_time: string; 
  end_time: string; 
  area?: string;
  staff_name: string;
  staff_role: string;
};

export interface StaffCounts {
  total_staff: number;
  active_staff: number;
  unique_roles: number;
  active_shifts_count: number;
}

export function useStaffManagement(venueId: string, initialStaff?: StaffRow[], initialCounts?: StaffCounts) {
  const [staff, setStaff] = useState<StaffRow[]>(initialStaff || []);
  const [name, setName] = useState('');
  const [role, setRole] = useState('Server');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allShifts, setAllShifts] = useState<LegacyShift[]>([]);
  const [staffLoaded, setStaffLoaded] = useState(!!initialStaff && initialStaff.length > 0);
  const [shiftsLoaded, setShiftsLoaded] = useState(false);
  const [loading, setLoading] = useState(!initialStaff || initialStaff.length === 0);

  // Load staff data on component mount
  useEffect(() => {
    const loadStaff = async () => {
      if (staffLoaded) return;
      
      try {
        const res = await fetch(`/api/staff/check?venue_id=${encodeURIComponent(venueId)}`);
        const j = await res.json().catch(() => ({}));
        if (res.ok && !j?.error) {
          setStaff(j.staff || []);
          setStaffLoaded(true);
        } else {

        }
      } catch (e) {

      }
    };

    if (!staffLoaded) {
      loadStaff();
    }
  }, [venueId, staffLoaded]);

  // Load shifts on component mount
  useEffect(() => {
    const loadShifts = async () => {
      const res = await fetch(`/api/staff/shifts/list?venue_id=${encodeURIComponent(venueId)}`);
      const j = await res.json().catch(() => ({}));
      if (res.ok && !j?.error) {
        const shifts = j.shifts || [];
        setAllShifts(shifts);
        setShiftsLoaded(true);
      }
    };

    if (!shiftsLoaded) {
      loadShifts();
    }
  }, [venueId, shiftsLoaded]);

  const addStaff = async () => {
    if (!name.trim()) {
      setError('Please enter a name');
      return;
    }

    setAdding(true);
    setError(null);

    try {
      const res = await fetch('/api/staff/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venue_id: venueId, name, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to add staff member');
      }

      setStaff(prev => [...prev, data.staff]);
      setName('');
      setRole('Server');
    } catch (err: unknown) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const toggleStaffActive = async (staffId: string, currentActive: boolean) => {
    try {
      const res = await fetch('/api/staff/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venue_id: venueId, staff_id: staffId, active: !currentActive }),
      });

      if (!res.ok) {
        throw new Error('Failed to toggle staff status');
      }

      setStaff(prev => prev.map(s => s.id === staffId ? { ...s, active: !currentActive } : s));
    } catch (err: unknown) {
      setError(err.message);
    }
  };

  return {
    staff,
    setStaff,
    name,
    setName,
    role,
    setRole,
    adding,
    error,
    setError,
    allShifts,
    loading,
    addStaff,
    toggleStaffActive
  };
}

