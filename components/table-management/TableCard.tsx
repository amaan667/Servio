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
  const [showSeatPartyQR, setShowSeatPartyQR] = useState(false);
  const [qrData, setQrData] = useState<any>(null);
  const [occupiedTime, setOccupiedTime] = useState<string>('');
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
      
      // Call the seat party API
      const response = await fetch('/api/table-management/seat-party', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id: table.id,
          venue_id: venueId,
          reservation_id: table.reserved_now_id || null
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Show QR code popup
        setQrData(result.qr_data);
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
      }
    } catch (error) {
      console.error('[TABLE CARD] Seat party error:', error);
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
        actions.push(
          <DropdownMenuItem 
            key="seat_party" 
            onClick={handleSeatParty}
            disabled={isLoading}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Seat Party
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

  const isReservedNow = (reservationTime: string) => {
    const now = new Date();
    const reservation = new Date(reservationTime);
    const diffMs = reservation.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    // Reserved Now = within the next 30 minutes
    return diffMins >= 0 && diffMins <= 30;
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
                <Eye className="h-4 w-4 mr-2" />
                View QR Code
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
          
          {table.status === 'RESERVED' && (
            <div className="text-sm text-gray-600 space-y-1">
              <div className="flex items-center gap-2">
                <Calendar className="h-3 w-3" />
                <span className="font-medium">{table.customer_name || 'Reserved'}</span>
                {table.reservation_time && (
                  <Badge 
                    variant={isReservedNow(table.reservation_time) ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {isReservedNow(table.reservation_time) ? 'Now' : 'Later'}
                  </Badge>
                )}
              </div>
              {table.reservation_time && (
                <div className="text-xs text-gray-500">
                  {isReservedNow(table.reservation_time) ? (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>
                        {getReservationCountdown(table.reservation_time)}
                      </span>
                    </div>
                  ) : (
                    <span>
                      Reserved for {new Date(table.reservation_time).toLocaleString('en-GB', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  )}
                  {table.reservation_duration_minutes && (
                    <span> ({table.reservation_duration_minutes} min)</span>
                  )}
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
