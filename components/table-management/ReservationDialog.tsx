'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Clock, User } from 'lucide-react';
import { useReserveTable } from '@/hooks/useTableReservations';

interface ReservationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tableId: string;
  tableLabel: string;
  tableSeatCount: number;
  venueId: string;
  tableStatus?: string; // Current table status to check if already reserved
  onReservationComplete?: () => void;
}

export function ReservationDialog({
  isOpen,
  onClose,
  tableId,
  tableLabel,
  tableSeatCount,
  venueId,
  tableStatus,
  onReservationComplete
}: ReservationDialogProps) {
  const [customerName, setCustomerName] = useState('');
  const [reservationTime, setReservationTime] = useState('');
  const [reservationDuration, setReservationDuration] = useState(60); // Default to 60 minutes
  const [error, setError] = useState<string | null>(null);
  
  const reserveTable = useReserveTable();

  // Initialize reservation time with current time when dialog opens
  useEffect(() => {
    if (isOpen && !reservationTime) {
      setReservationTime(getDefaultTime());
    }
  }, [isOpen]);

  // Set default time to current time in local timezone
  const getDefaultTime = () => {
    const now = new Date();
    // Format as YYYY-MM-DDTHH:MM for datetime-local input
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleSubmit = async () => {
    if (!customerName.trim()) {
      setError('Customer name is required');
      return;
    }

    if (!reservationTime) {
      setError('Reservation time is required');
      return;
    }


    // Validate reservation time is not too far in the past (allow current time)
    const selectedTime = new Date(reservationTime);
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago
    
    if (selectedTime < fiveMinutesAgo) {
      setError('Reservation time cannot be more than 5 minutes in the past');
      return;
    }

    try {
      setError(null);

      // Convert local time to UTC for server
      const startAt = new Date(reservationTime).toISOString();
      const endAt = new Date(new Date(reservationTime).getTime() + (reservationDuration * 60 * 1000)).toISOString();

      await reserveTable.mutateAsync({
        venueId,
        tableId,
        startAt,
        endAt,
        partySize: tableSeatCount,
        name: customerName.trim(),
        phone: '' // Add phone field if needed
      });

      onReservationComplete?.();
      onClose();
      setCustomerName('');
      setReservationTime('');
    } catch (error) {
      console.error('Failed to create reservation:', error);
      setError(error instanceof Error ? error.message : 'Failed to create reservation');
    }
  };

  const handleClose = () => {
    setCustomerName('');
    setReservationTime('');
    setReservationDuration(60);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Modify Reservation
          </DialogTitle>
          <DialogDescription>
            Update the reservation for {tableLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info message for modifying existing reservation */}
          {tableStatus === 'RESERVED' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-700">
                ℹ️ This table has an existing reservation. You are modifying the current reservation details.
              </p>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="customerName" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Customer Name
            </Label>
            <Input
              id="customerName"
              placeholder="Enter customer name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              disabled={reserveTable.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reservationTime" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Reservation Time
            </Label>
            <Input
              id="reservationTime"
              type="datetime-local"
              value={reservationTime || getDefaultTime()}
              onChange={(e) => setReservationTime(e.target.value)}
              disabled={reserveTable.isPending}
              min={new Date(Date.now() - 5 * 60 * 1000).toISOString().slice(0, 16)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reservationDuration" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Reservation Duration
            </Label>
            <select
              id="reservationDuration"
              value={reservationDuration}
              onChange={(e) => setReservationDuration(Number(e.target.value))}
              disabled={reserveTable.isPending}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={30}>30 minutes</option>
              <option value={60}>60 minutes</option>
              <option value={90}>90 minutes</option>
              <option value={120}>120 minutes</option>
              <option value={180}>180 minutes (3 hours)</option>
            </select>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={reserveTable.isPending}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={reserveTable.isPending || !customerName.trim() || !reservationTime}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {reserveTable.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Updating...
              </>
            ) : (
              'Update Reservation'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}