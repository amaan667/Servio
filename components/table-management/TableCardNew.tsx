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
  UserPlus
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
import { useSeatWalkIn, useCloseTable, TableGridItem } from '@/hooks/useTableReservations';
import { useTableActions } from '@/hooks/useTableActions';
import { TableSelectionDialog } from './TableSelectionDialog';
import { ReservationDialog } from './ReservationDialog';

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
  const seatWalkIn = useSeatWalkIn();
  const closeTable = useCloseTable();
  const { occupyTable } = useTableActions();

  const handleSeatWalkIn = async () => {
    try {
      setIsLoading(true);
      await seatWalkIn.mutateAsync({ venueId, tableId: table.id });
      onActionComplete?.();
    } catch (error) {
      console.error('Failed to seat walk-in:', error);
    } finally {
      setIsLoading(false);
    }
  };

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

  const getContextualActions = () => {
    if (table.session_status === 'FREE') {
      return (
        <>
          <DropdownMenuItem onClick={handleSeatWalkIn} disabled={isLoading}>
            <UserPlus className="h-4 w-4 mr-2" />
            Seat Walk-in
          </DropdownMenuItem>
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

  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    asChild
                  >
                    <a href={`/generate-qr?venue=${venueId}&table=${table.label}`} target="_blank" rel="noopener noreferrer">
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
          <StatusPill status={table.session_status as any} />
          
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
        </div>
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
        onReservationComplete={onActionComplete}
      />
    </Card>
  );
}
