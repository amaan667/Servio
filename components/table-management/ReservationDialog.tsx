'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from 'lucide-react';
import { useTableReservations } from '@/hooks/useTableReservations';

interface ReservationDialogProps {
  venueId: string;
  tableId?: string | null;
  onReservationCreated?: () => void;
  children?: React.ReactNode;
}

export function ReservationDialog({ venueId, tableId, onReservationCreated, children }: ReservationDialogProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    partySize: 2,
    startAt: '',
    endAt: '',
  });
  const { reserveTable } = useTableReservations();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.startAt || !formData.endAt) return;

    try {
      await reserveTable.mutateAsync({
        venueId,
        tableId: tableId || null,
        startAt: formData.startAt,
        endAt: formData.endAt,
        partySize: formData.partySize,
        name: formData.name.trim(),
        phone: formData.phone.trim() || undefined,
      });
      
      setFormData({
        name: '',
        phone: '',
        partySize: 2,
        startAt: '',
        endAt: '',
      });
      setOpen(false);
      onReservationCreated?.();
    } catch (error) {
      console.error('Failed to create reservation:', error);
    }
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline">
            <Calendar className="h-4 w-4 mr-2" />
            Make Reservation
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Make Reservation</DialogTitle>
          <DialogDescription>
            Create a new reservation for {tableId ? 'this table' : 'your venue'}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Customer name"
                className="col-span-3"
                required
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="phone" className="text-right">
                Phone
              </Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="Phone number"
                className="col-span-3"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="partySize" className="text-right">
                Party Size
              </Label>
              <Input
                id="partySize"
                type="number"
                min="1"
                max="20"
                value={formData.partySize}
                onChange={(e) => handleInputChange('partySize', parseInt(e.target.value) || 2)}
                className="col-span-3"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="startAt" className="text-right">
                Start Time
              </Label>
              <Input
                id="startAt"
                type="datetime-local"
                value={formData.startAt}
                onChange={(e) => handleInputChange('startAt', e.target.value)}
                className="col-span-3"
                required
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="endAt" className="text-right">
                End Time
              </Label>
              <Input
                id="endAt"
                type="datetime-local"
                value={formData.endAt}
                onChange={(e) => handleInputChange('endAt', e.target.value)}
                className="col-span-3"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={reserveTable.isPending || !formData.name.trim() || !formData.startAt || !formData.endAt}>
              {reserveTable.isPending ? 'Creating...' : 'Create Reservation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
