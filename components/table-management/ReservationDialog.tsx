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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setIsLoading(true);
      setError(null);

      // Convert local time to UTC for server
      const localDateTime = new Date(reservationTime);
      const utcDateTime = localDateTime.toISOString();

      const response = await fetch('/api/table-sessions/actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({
          action: 'reserve_table',
          table_id: tableId,
          venue_id: venueId,
          customer_name: customerName.trim(),
          customer_phone: '', // Add phone field if needed
          party_size: tableSeatCount,
          reservation_time: utcDateTime,
          reservation_duration: reservationDuration
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create reservation');
      }

      onReservationComplete?.();
      onClose();
      setCustomerName('');
      setReservationTime('');
    } catch (error) {
      console.error('Failed to create reservation:', error);
      setError(error instanceof Error ? error.message : 'Failed to create reservation');
    } finally {
      setIsLoading(false);
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
            Make Reservation
          </DialogTitle>
          <DialogDescription>
            Create a reservation for {tableLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning if table is already reserved */}
          {tableStatus === 'RESERVED' && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-700">
                ⚠️ This table is already reserved. Creating a new reservation will conflict with the existing one.
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
              disabled={isLoading}
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
              disabled={isLoading}
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
              disabled={isLoading}
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
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || !customerName.trim() || !reservationTime}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creating...
              </>
            ) : (
              'Create Reservation'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}