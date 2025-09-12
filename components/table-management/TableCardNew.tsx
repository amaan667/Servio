'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MoreHorizontal, 
  Users, 
  Clock, 
  CheckCircle2, 
  UserCheck, 
  Receipt,
  Calendar,
  ArrowRight,
  Play,
  Pause,
  Square,
  QrCode,
  X
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { StatusPill } from './StatusPill';
import { useCloseTable, TableGridItem } from '@/hooks/useTableReservations';
import { useTableActions } from '@/hooks/useTableActions';
import { TableSelectionDialog } from './TableSelectionDialog';
import { ReservationDialog } from './ReservationDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface TableCardNewProps {
  table: TableGridItem;
  venueId: string;
  onActionComplete?: () => void;
  availableTables?: TableGridItem[];
}

export function TableCardNew({ table, venueId, onActionComplete, availableTables = [] }: TableCardNewProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [showReservationDialog, setShowReservationDialog] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [forceRemove, setForceRemove] = useState(false);
  const [showHoverRemove, setShowHoverRemove] = useState(false);
  const closeTable = useCloseTable();
  const { occupyTable } = useTableActions();

  const handleOccupyTable = async () => {
    try {
      setIsLoading(true);
      await occupyTable(table.id, venueId);
      onActionComplete?.();
    } catch (error) {
      console.error('Failed to occupy table:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseTable = async () => {
    try {
      setIsLoading(true);
      await closeTable.mutateAsync({ tableId: table.id, venueId: venueId });
      onActionComplete?.();
    } catch (error) {
      console.error('Failed to close table:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveTable = async (retryCount = 0) => {
    try {
      console.log('🔍 [REMOVE TABLE] Starting removal process:', {
        tableId: table.id,
        tableLabel: table.label,
        venueId: venueId,
        retryCount
      });
      
      setIsLoading(true);
      setRemoveError(null);
      
      const requestBody = {
        tableId: table.id,
        venueId: venueId,
        force: forceRemove,
      };
      
      console.log('🔍 [REMOVE TABLE] Request body:', requestBody);
      
      const response = await fetch('/api/tables/remove', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('🔍 [REMOVE TABLE] Response status:', response.status);
      console.log('🔍 [REMOVE TABLE] Response ok:', response.ok);

      const responseData = await response.json();
      console.log('🔍 [REMOVE TABLE] Response data:', responseData);

      if (!response.ok) {
        // Handle specific error cases with more user-friendly messages
        if (responseData.error?.includes('Failed to check for active orders')) {
          // If this is a database connectivity issue, try once more
          if (retryCount < 1) {
            console.log('🔍 [REMOVE TABLE] Retrying due to database connectivity issue...');
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            return handleRemoveTable(retryCount + 1);
          }
          throw new Error('Unable to verify table status. Please try again or contact support if the issue persists.');
        } else if (responseData.error?.includes('active orders')) {
          throw new Error('Cannot remove table with active orders. Please close all orders first.');
        } else if (responseData.error?.includes('active reservations')) {
          throw new Error('Cannot remove table with active reservations. Please cancel all reservations first.');
        } else {
          throw new Error(responseData.error || 'Failed to remove table');
        }
      }

      console.log('🔍 [REMOVE TABLE] Table removed successfully');
      onActionComplete?.();
      setShowRemoveDialog(false);
      setForceRemove(false);
    } catch (error) {
      console.error('🔍 [REMOVE TABLE] Failed to remove table:', error);
      setRemoveError(error instanceof Error ? error.message : 'Failed to remove table');
    } finally {
      setIsLoading(false);
    }
  };

  const getContextualActions = () => {
    if (table.session_status === 'FREE') {
      return (
        <>
          <DropdownMenuItem onClick={handleOccupyTable} disabled={isLoading}>
            <Users className="h-4 w-4 mr-2" />
            Occupy Table
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowReservationDialog(true)}>
            <Calendar className="h-4 w-4 mr-2" />
            Make Reservation
          </DropdownMenuItem>
        </>
      );
    }

    if (table.session_status === 'OCCUPIED') {
      return (
        <>
          {table.order_id && (
            <DropdownMenuItem>
              <Receipt className="h-4 w-4 mr-2" />
              View Order
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={handleCloseTable} disabled={isLoading}>
            <Square className="h-4 w-4 mr-2" />
            Close Table
          </DropdownMenuItem>
        </>
      );
    }

    if (table.session_status === 'RESERVED') {
      return (
        <>
          <DropdownMenuItem onClick={() => setShowReservationDialog(true)}>
            <Calendar className="h-4 w-4 mr-2" />
            Modify Reservation
          </DropdownMenuItem>
        </>
      );
    }

    return null;
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getTimeElapsed = (dateString: string) => {
    const now = new Date();
    const past = new Date(dateString);
    const diffMins = Math.floor((now.getTime() - past.getTime()) / (1000 * 60));
    
    if (diffMins < 60) {
      return `${diffMins}m`;
    } else {
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `${hours}h ${mins}m`;
    }
  };

  const qrHref = `/generate-qr?venue=${encodeURIComponent(venueId)}&table=${encodeURIComponent(String(table.label))}`;

  return (
    <Card 
      className="group hover:shadow-md transition-shadow duration-200 relative"
      onMouseEnter={() => setShowHoverRemove(true)}
      onMouseLeave={() => setShowHoverRemove(false)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg">{table.label}</h3>
            <Badge variant="secondary" className="text-xs">
              <Users className="h-3 w-3 mr-1" />
              {table.seat_count} seats
            </Badge>
          </div>
          
          <div className="flex items-center gap-1">
            {/* Remove Table Button - appears on hover */}
            <div className={`transition-opacity duration-200 ${showHoverRemove ? 'opacity-100' : 'opacity-0'}`}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setShowRemoveDialog(true)}
                      disabled={isLoading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Remove Table</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    asChild
                  >
                    <a href={qrHref} target="_blank" rel="noopener noreferrer">
                      <QrCode className="h-4 w-4" />
                    </a>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Assign QR Code</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {getContextualActions()}
                <DropdownMenuItem onClick={() => setShowMoveDialog(true)}>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Move to...
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowMergeDialog(true)}>
                  <MoreHorizontal className="h-4 w-4 mr-2" />
                  Merge with...
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <StatusPill status={table.session_status as any} />
          </div>
          
          {table.order_id && (
            <div className="text-sm text-gray-600 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">Order #{table.order_id.slice(-6)}</span>
              </div>
              
              {table.total_amount && (
                <div className="flex items-center gap-2">
                  <span>£{(table.total_amount / 100).toFixed(2)}</span>
                  {table.order_status && (
                    <Badge variant="outline" className="text-xs">
                      {table.order_status}
                    </Badge>
                  )}
                </div>
              )}
              
              {table.opened_at && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="h-3 w-3" />
                  <span>Open {formatTime(table.opened_at)}</span>
                  <span>• {getTimeElapsed(table.opened_at)} ago</span>
                </div>
              )}
            </div>
          )}
          
          {!table.order_id && table.session_status === 'FREE' && (
            <div className="text-sm text-gray-500">
              Available for seating
            </div>
          )}
          
          {table.session_status === 'RESERVED' && (
            <div className="text-sm text-gray-500">
              {table.reservation_status === 'RESERVED_NOW' ? 'Reserved - Check in available' : 'Reserved for later'}
            </div>
          )}
        </div>

        {/* Reserved Badge - only show if table is FREE but has a reservation (edge case) */}
        {table.session_status === 'FREE' && (table.reservation_status === 'RESERVED_NOW' || table.reservation_status === 'RESERVED_LATER') && (
          <div className="absolute bottom-3 right-3">
            <Badge 
              variant="outline" 
              className={`text-xs ${
                table.reservation_status === 'RESERVED_NOW' 
                  ? 'bg-red-50 text-red-700 border-red-200' 
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}
            >
              <Calendar className="h-3 w-3 mr-1" />
              {table.reservation_status === 'RESERVED_NOW' ? 'Reserved Now' : 'Reserved Later'}
            </Badge>
          </div>
        )}
      </CardContent>

      {/* Table Selection Dialogs */}
      <TableSelectionDialog
        isOpen={showMoveDialog}
        onClose={() => setShowMoveDialog(false)}
        sourceTable={table as any}
        action="move"
        venueId={venueId}
        availableTables={availableTables as any}
        onActionComplete={onActionComplete}
      />
      
      <TableSelectionDialog
        isOpen={showMergeDialog}
        onClose={() => setShowMergeDialog(false)}
        sourceTable={table as any}
        action="merge"
        venueId={venueId}
        availableTables={availableTables as any}
        onActionComplete={onActionComplete}
      />
      
      <ReservationDialog
        isOpen={showReservationDialog}
        onClose={() => setShowReservationDialog(false)}
        tableId={table.id}
        tableLabel={table.label}
        tableSeatCount={table.seat_count}
        venueId={venueId}
        tableStatus={table.session_status}
        onReservationComplete={onActionComplete}
      />
      
      {/* Remove Table Confirmation Dialog */}
      <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Table</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove "{table.label}"? This action cannot be undone.
              {table.session_status === 'OCCUPIED' && (
                <span className="block mt-2 text-amber-600 font-medium">
                  ⚠️ This table is currently occupied. Removing it may affect active orders.
                </span>
              )}
              {removeError && (
                <span className="block mt-2 text-red-600 font-medium">
                  ❌ {removeError}
                </span>
              )}
              {removeError && removeError.includes('active orders') && (
                <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-md">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={forceRemove}
                      onChange={(e) => setForceRemove(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-orange-800">
                      Force remove (complete active orders and remove table anyway)
                    </span>
                  </label>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRemoveDialog(false);
                setRemoveError(null);
                setForceRemove(false);
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleRemoveTable()}
              disabled={isLoading}
            >
              {isLoading ? 'Removing...' : 'Remove Table'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
