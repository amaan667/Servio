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
  UserPlus,
  Timer,
  Eye,
  Merge,
  Split,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { StatusPill } from './StatusPill';
import { useTableActions } from '@/hooks/useTableActions';
import { TableWithSession } from '@/hooks/useTablesData';
import { TableSelectionDialog } from './TableSelectionDialog';
import { ReservationDialog } from './ReservationDialog';
import { AssignQRCodeModal } from './AssignQRCodeModal';

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
  const [showSeatPartyQR, setShowSeatPartyQR] = useState(false);
  const [qrData, setQrData] = useState<any>(null);
  const [occupiedTime, setOccupiedTime] = useState<string>('');
  const [noShowMessage, setNoShowMessage] = useState<string | null>(null);
  const { executeAction, occupyTable } = useTableActions();

  const handleAction = async (action: string, orderId?: string, destinationTableId?: string) => {
    try {
      setIsLoading(true);
      console.log('[TABLE CARD] Executing action:', action, 'for table:', table.id);
      console.log('[TABLE CARD] Table details:', { id: table.id, label: table.label, status: table.status });
      console.log('[TABLE CARD] Venue ID:', venueId);
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

  const handleSeatParty = async () => {
    try {
      setIsLoading(true);
      console.log('[TABLE CARD] Seating party at table:', table.id);
      
      // Call the table actions API with occupy_table action
      const response = await fetch('/api/table-sessions/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'occupy_table',
          table_id: table.id,
          venue_id: venueId
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Show QR code popup with basic data
        setQrData({
          table_id: table.id,
          table_label: table.label,
          venue_id: venueId,
          qr_url: `${window.location.origin}/order?venue=${venueId}&table=${table.label}`,
          timestamp: new Date().toISOString()
        });
        setShowSeatPartyQR(true);
        
        // Start timer
        const startTime = new Date();
        const updateTimer = () => {
          const now = new Date();
          const diffMs = now.getTime() - startTime.getTime();
          const diffMins = Math.floor(diffMs / (1000 * 60));
          const diffHours = Math.floor(diffMins / 60);
          const remainingMins = diffMins % 60;
          
          if (diffHours > 0) {
            setOccupiedTime(`${diffHours}h ${remainingMins}m`);
          } else {
            setOccupiedTime(`${diffMins}m`);
          }
        };
        
        // Update timer every minute
        const timerInterval = setInterval(updateTimer, 60000);
        updateTimer(); // Initial update
        
        // Store timer interval for cleanup
        (window as any).tableTimer = timerInterval;
        
        onActionComplete?.();
      } else {
        console.error('[TABLE CARD] Seat party failed:', result.error);
        alert(`Failed to seat party: ${result.error}`);
      }
    } catch (error) {
      console.error('[TABLE CARD] Seat party error:', error);
      alert(`Error seating party: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSplitBill = async () => {
    try {
      console.log('[TABLE CARD] Splitting bill for table:', table.id);
      // TODO: Implement split bill functionality
      // This would open a dialog to select items to split
      alert('Split bill functionality coming soon!');
    } catch (error) {
      console.error('[TABLE CARD] Split bill error:', error);
    }
  };

  const getContextualActions = () => {
    const actions = [];

    switch (table.status) {
      case 'FREE':
        // Only show Reserve button if there's no active reservation
        if (!table.reserved_now_id && !table.reserved_later_id) {
          actions.push(
            <DropdownMenuItem 
              key="reserve" 
              onClick={() => setShowReservationDialog(true)}
              disabled={isLoading}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Reserve
            </DropdownMenuItem>
          );
        }
        break;

      case 'ORDERING':
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
        if (table.order_id) {
          actions.push(
            <DropdownMenuItem 
              key="start_prep" 
              onClick={() => handleAction('start_preparing', table.order_id || undefined)}
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
              onClick={() => handleAction('mark_ready', table.order_id || undefined)}
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
              onClick={() => handleAction('mark_served', table.order_id || undefined)}
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

  const isReservedNow = (reservationTime: string, blockWindowMins: number = 30) => {
    const now = new Date();
    const reservation = new Date(reservationTime);
    const diffMs = reservation.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    // Reserved Now = within the blocking window
    return diffMins >= 0 && diffMins <= blockWindowMins;
  };

  const getReservationCountdown = (reservationTime: string) => {
    const now = new Date();
    const reservation = new Date(reservationTime);
    const diffMs = reservation.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins <= 0) {
      return 'Arriving now';
    } else if (diffMins < 60) {
      return `In ${diffMins}m`;
    } else {
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `In ${hours}h ${mins}m`;
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
            {/* Show QR indicator if this table was likely created from QR code */}
            {table.label && /^\d+$/.test(table.label) && (
              <Badge variant="outline" className="text-xs text-blue-600 border-blue-600">
                📱 QR
              </Badge>
            )}
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
            <DropdownMenuContent align="end" className="w-48">
              {getContextualActions()}
              
              {/* Always available actions */}
              <DropdownMenuItem onClick={() => setShowQRDialog(true)}>
                <QrCode className="h-4 w-4 mr-2" />
                Assign QR Code
              </DropdownMenuItem>
              
              {table.order_id && (
                <DropdownMenuItem onClick={() => handleSplitBill()}>
                  <Split className="h-4 w-4 mr-2" />
                  Split Bill
                </DropdownMenuItem>
              )}
              
              <DropdownMenuItem onClick={() => setShowMergeDialog(true)}>
                <Merge className="h-4 w-4 mr-2" />
                Merge Table
              </DropdownMenuItem>
              
              <DropdownMenuItem onClick={() => setShowMoveDialog(true)}>
                <ArrowRight className="h-4 w-4 mr-2" />
                Move to...
              </DropdownMenuItem>
              
              {table.status !== 'FREE' && (
                <DropdownMenuItem 
                  onClick={() => handleAction('close_table')}
                  className="text-red-600"
                >
                  <X className="h-4 w-4 mr-2" />
                  Close Table
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>

        <div className="space-y-2">
          {/* Live Status Chip */}
          <div className="flex items-center gap-2">
            <StatusPill status={table.status} />
            {table.reserved_now_id && (
              <Badge variant="destructive" className="text-xs">
                Reserved Now
              </Badge>
            )}
            {table.reserved_later_id && !table.reserved_now_id && (
              <Badge variant="secondary" className="text-xs">
                Reserved Later
              </Badge>
            )}
          </div>
          
          {/* No-Show Message */}
          {noShowMessage && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <X className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium text-red-700">{noShowMessage}</span>
              </div>
              <p className="text-xs text-red-600 mt-1">Table will be set to free shortly...</p>
            </div>
          )}
          
          {/* Primary action button for FREE tables */}
          {table.status === 'FREE' && (
            <Button 
              onClick={handleSeatParty}
              disabled={isLoading}
              className="w-full"
              size="sm"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Seat Party
            </Button>
          )}
          
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
                  {table.payment_status && (
                    <Badge 
                      variant={table.payment_status === 'paid' ? 'default' : 
                              table.payment_status === 'till' ? 'secondary' : 'destructive'}
                      className="text-xs"
                    >
                      {table.payment_status === 'paid' ? '✅ Paid' :
                       table.payment_status === 'till' ? '🏪 Till' : '❌ Unpaid'}
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
          
          {/* Reservation Information */}
          {(table.reserved_now_id || table.reserved_later_id) && (
            <div className="text-sm text-gray-600 space-y-1">
              <div className="flex items-center gap-2">
                <Calendar className="h-3 w-3" />
                <span className="font-medium">
                  {table.reserved_now_name || table.reserved_later_name || 'Reserved'}
                </span>
              </div>
              {table.reserved_now_start && (
                <div className="text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>
                      {getReservationCountdown(table.reserved_now_start)}
                    </span>
                  </div>
                  <span>
                    {new Date(table.reserved_now_start).toLocaleString('en-GB', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              )}
              {table.reserved_later_start && !table.reserved_now_start && (
                <div className="text-xs text-gray-500">
                  <span>
                    Reserved for {new Date(table.reserved_later_start).toLocaleString('en-GB', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              )}
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
        tableStatus={table.status}
        onReservationComplete={onActionComplete}
      />
      
      <AssignQRCodeModal
        isOpen={showQRDialog}
        onClose={() => setShowQRDialog(false)}
        venueId={venueId}
        tableId={table.id}
        tableLabel={table.label}
      />
      
      {/* Seat Party QR Code Popup */}
      <Dialog open={showSeatPartyQR} onOpenChange={setShowSeatPartyQR}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Table {table.label} - QR Code
            </DialogTitle>
            <DialogDescription>
              Scan this QR code to access the menu for Table {table.label}
            </DialogDescription>
          </DialogHeader>
          
          {qrData && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="bg-white p-4 rounded-lg border-2 border-gray-200 inline-block">
                  {/* QR Code would be generated here */}
                  <div className="w-48 h-48 bg-gray-100 rounded flex items-center justify-center">
                    <QrCode className="h-24 w-24 text-gray-400" />
                  </div>
                </div>
              </div>
              
              <div className="text-center space-y-2">
                <p className="text-sm text-gray-600">
                  <strong>Table:</strong> {table.label}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>URL:</strong> {qrData.qr_url}
                </p>
                {occupiedTime && (
                  <div className="flex items-center justify-center gap-2 text-sm text-blue-600">
                    <Timer className="h-4 w-4" />
                    <span>Occupied for {occupiedTime}</span>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => navigator.clipboard.writeText(qrData.qr_url)}
                >
                  Copy URL
                </Button>
                <Button 
                  className="flex-1"
                  onClick={() => window.print()}
                >
                  Print QR Code
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
