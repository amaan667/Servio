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
import { useTableActions } from '@/hooks/useTableActions';
import { TableWithSession } from '@/hooks/useTablesData';
import { TableSelectionDialog } from './TableSelectionDialog';
import { ReservationDialog } from './ReservationDialog';
import { QRCodeSelectionDialog } from './QRCodeSelectionDialog';

interface TableCardProps {
  table: TableWithSession;
  venueId: string;
  onActionComplete?: () => void;
  availableTables?: TableWithSession[];
}

export function TableCard({ table, venueId, onActionComplete, availableTables = [] }: TableCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [showReservationDialog, setShowReservationDialog] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const { executeAction, occupyTable } = useTableActions();

  const handleAction = async (action: string, orderId?: string, destinationTableId?: string) => {
    try {
      setIsLoading(true);
      console.log('[TABLE CARD] Executing action:', action, 'for table:', table.id);
      await executeAction({
        action: action as any,
        table_id: table.id,
        venue_id: venueId,
        order_id: orderId,
        destination_table_id: destinationTableId,
      });
      console.log('[TABLE CARD] Action completed successfully:', action);
      onActionComplete?.();
    } catch (error) {
      console.error('[TABLE CARD] Action failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getContextualActions = () => {
    const actions = [];

    switch (table.status) {
      case 'FREE':
        actions.push(
          <DropdownMenuItem 
            key="occupy" 
            onClick={() => handleAction('occupy_table')}
            disabled={isLoading}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Occupy Table
          </DropdownMenuItem>,
          <DropdownMenuItem 
            key="reserve" 
            onClick={() => setShowReservationDialog(true)}
            disabled={isLoading}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Reserve
          </DropdownMenuItem>
        );
        break;

      case 'ORDERING':
        if (table.order_id) {
          actions.push(
            <DropdownMenuItem 
              key="start_prep" 
              onClick={() => handleAction('start_preparing', table.order_id)}
              disabled={isLoading}
            >
              <Play className="h-4 w-4 mr-2" />
              Start Preparing
            </DropdownMenuItem>
          );
        }
        break;

      case 'IN_PREP':
        if (table.order_id) {
          actions.push(
            <DropdownMenuItem 
              key="mark_ready" 
              onClick={() => handleAction('mark_ready', table.order_id)}
              disabled={isLoading}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Mark Ready
            </DropdownMenuItem>
          );
        }
        break;

      case 'READY':
        if (table.order_id) {
          actions.push(
            <DropdownMenuItem 
              key="mark_served" 
              onClick={() => handleAction('mark_served', table.order_id)}
              disabled={isLoading}
            >
              <UserCheck className="h-4 w-4 mr-2" />
              Mark Served
            </DropdownMenuItem>
          );
        }
        break;

      case 'SERVED':
        actions.push(
          <DropdownMenuItem 
            key="awaiting_bill" 
            onClick={() => handleAction('mark_awaiting_bill')}
            disabled={isLoading}
          >
            <Receipt className="h-4 w-4 mr-2" />
            Mark Awaiting Bill
          </DropdownMenuItem>
        );
        break;

      case 'AWAITING_BILL':
        actions.push(
          <DropdownMenuItem 
            key="close_table" 
            onClick={() => handleAction('close_table')}
            disabled={isLoading}
            className="text-red-600"
          >
            <Square className="h-4 w-4 mr-2" />
            Close Table
          </DropdownMenuItem>
        );
        break;

      case 'RESERVED':
        actions.push(
          <DropdownMenuItem 
            key="close_table" 
            onClick={() => handleAction('close_table')}
            disabled={isLoading}
            className="text-red-600"
          >
            <Square className="h-4 w-4 mr-2" />
            Close Table
          </DropdownMenuItem>
        );
        break;
    }

    return actions;
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getTimeElapsed = (dateString: string | null) => {
    if (!dateString) return null;
    const now = new Date();
    const opened = new Date(dateString);
    const diffMs = now.getTime() - opened.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
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
                    onClick={() => setShowQRDialog(true)}
                  >
                    <QrCode className="h-4 w-4" />
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
          <StatusPill status={table.status} />
          
          {table.order_id && (
            <div className="text-sm text-gray-600 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">Order #{table.order_id.slice(-6)}</span>
                {table.customer_name && (
                  <span>• {table.customer_name}</span>
                )}
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
          
          {!table.order_id && table.status === 'FREE' && (
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
        sourceTable={table}
        action="move"
        venueId={venueId}
        availableTables={availableTables}
        onActionComplete={onActionComplete}
      />
      
      <TableSelectionDialog
        isOpen={showMergeDialog}
        onClose={() => setShowMergeDialog(false)}
        sourceTable={table}
        action="merge"
        venueId={venueId}
        availableTables={availableTables}
        onActionComplete={onActionComplete}
      />
      
      <ReservationDialog
        isOpen={showReservationDialog}
        onClose={() => setShowReservationDialog(false)}
        tableId={table.id}
        tableLabel={table.label}
        venueId={venueId}
        onReservationComplete={onActionComplete}
      />
      
      <QRCodeSelectionDialog
        isOpen={showQRDialog}
        onClose={() => setShowQRDialog(false)}
        venueId={venueId}
        availableTables={availableTables}
        initialSelectedTables={[table.id]}
      />
    </Card>
  );
}
