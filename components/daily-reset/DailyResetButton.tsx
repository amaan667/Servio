'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { RotateCcw, AlertTriangle } from 'lucide-react';

interface DailyResetButtonProps {
  venueId: string;
  onResetComplete?: () => void;
}

export function DailyResetButton({ venueId, onResetComplete }: DailyResetButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [resetStatus, setResetStatus] = useState<{
    needsReset: boolean;
    summary: {
      activeOrders: number;
      activeReservations: number;
      occupiedTables: number;
    };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkResetStatus = async () => {
    try {
      const response = await fetch(`/api/daily-reset?venueId=${venueId}`);
      const data = await response.json();
      
      if (response.ok) {
        setResetStatus(data);
        setError(null);
      } else {
        setError(data.error || 'Failed to check reset status');
      }
    } catch (error) {
      console.error('Error checking reset status:', error);
      setError('Failed to check reset status');
    }
  };

  const handleReset = async (force = false) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/daily-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ venueId, force }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        console.log('Daily reset completed:', data);
        setShowDialog(false);
        onResetComplete?.();
        
        // Show success message
        alert(`Daily reset completed successfully!\n\nSummary:\n- Completed ${data.summary.completedOrders} orders\n- Canceled ${data.summary.canceledReservations} reservations\n- Reset ${data.summary.resetTables} tables`);
      } else {
        setError(data.error || 'Failed to perform daily reset');
      }
    } catch (error) {
      console.error('Error performing daily reset:', error);
      setError('Failed to perform daily reset');
    } finally {
      setIsLoading(false);
    }
  };

  const openDialog = async () => {
    setShowDialog(true);
    await checkResetStatus();
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={openDialog}
        className="text-orange-600 border-orange-200 hover:bg-orange-50"
      >
        <RotateCcw className="h-4 w-4 mr-2" />
        Daily Reset
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-orange-600" />
              Daily Reset
            </DialogTitle>
            <DialogDescription>
              Reset all tables and complete active orders for a fresh start to the day.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {resetStatus && (
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <h4 className="font-medium text-blue-900 mb-2">Current Status:</h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <div>Active Orders: {resetStatus.summary.activeOrders}</div>
                  <div>Active Reservations: {resetStatus.summary.activeReservations}</div>
                  <div>Occupied Tables: {resetStatus.summary.occupiedTables}</div>
                </div>
              </div>

              {resetStatus.needsReset ? (
                <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-orange-800">
                      <p className="font-medium">Reset Required</p>
                      <p>There are active orders, reservations, or occupied tables that need to be reset.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-md p-3">
                  <div className="text-sm text-green-800">
                    <p className="font-medium">All Clear</p>
                    <p>No active orders, reservations, or occupied tables found.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            
            <div className="flex gap-2">
              <Button
                variant="default"
                onClick={() => handleReset(false)}
                disabled={isLoading || !resetStatus?.needsReset}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {isLoading ? 'Resetting...' : 'Reset Tables & Orders'}
              </Button>
              
              <Button
                variant="destructive"
                onClick={() => handleReset(true)}
                disabled={isLoading}
                className="bg-red-600 hover:bg-red-700"
              >
                {isLoading ? 'Resetting...' : 'Force Reset (Delete All)'}
              </Button>
            </div>
          </DialogFooter>

          <div className="text-xs text-gray-500 space-y-1">
            <p><strong>Reset Tables & Orders:</strong> Completes active orders, cancels reservations, and frees all tables.</p>
            <p><strong>Force Reset:</strong> Same as above, but also deletes all orders from today.</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
