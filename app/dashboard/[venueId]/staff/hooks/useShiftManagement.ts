import { useState, useEffect } from 'react';
import { buildIsoFromLocal, addDaysISO } from '@/lib/time';
import { LegacyShift } from './useStaffManagement';

export function useShiftManagement(venueId: string, staff: any[]) {
  const [allShifts, setAllShifts] = useState<LegacyShift[]>([]);
  const [shiftsLoaded, setShiftsLoaded] = useState(false);
  const [editingShiftFor, setEditingShiftFor] = useState<string | null>(null);

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

  const addShift = async (staffId: string, startTime: string, endTime: string, area?: string) => {
    try {
      const res = await fetch('/api/staff/shifts/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venue_id: venueId,
          staff_id: staffId,
          start_time: startTime,
          end_time: endTime,
          area: area || null
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to add shift');
      }

      const data = await res.json();
      setAllShifts(prev => [...prev, data.shift]);
      setEditingShiftFor(null);
    } catch (err) {
      console.error('Error adding shift:', err);
    }
  };

  const deleteShift = async (shiftId: string) => {
    try {
      const res = await fetch('/api/staff/shifts/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shift_id: shiftId }),
      });

      if (!res.ok) {
        throw new Error('Failed to delete shift');
      }

      setAllShifts(prev => prev.filter(s => s.id !== shiftId));
    } catch (err) {
      console.error('Error deleting shift:', err);
    }
  };

  return {
    allShifts,
    setAllShifts,
    shiftsLoaded,
    editingShiftFor,
    setEditingShiftFor,
    addShift,
    deleteShift
  };
}

