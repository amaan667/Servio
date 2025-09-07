'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Clock, 
  Calendar, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  MoreHorizontal,
  QrCode,
  UserCheck,
  UserX,
  Phone,
  MapPin
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TableRuntimeState } from '@/hooks/useTableRuntimeState';
import { useSeatParty, useCloseTable, useAssignReservation, useCancelReservation, useNoShowReservation } from '@/hooks/useTableRuntimeState';
import { formatDistanceToNow } from 'date-fns';

interface TableCardRefactoredProps {
  table: TableRuntimeState;
  venueId: string;
  onActionComplete: () => void;
  availableTables: TableRuntimeState[];
}

export function TableCardRefactored({ 
  table, 
  venueId, 
  onActionComplete, 
  availableTables 
}: TableCardRefactoredProps) {
  const [isLoading, setIsLoading] = useState(false);
  
  const seatParty = useSeatParty();
  const closeTable = useCloseTable();
  const assignReservation = useAssignReservation();
  const cancelReservation = useCancelReservation();
  const noShowReservation = useNoShowReservation();

  const handleAction = async (action: string, reservationId?: string) => {
    console.log('[TABLE CARD] Action triggered:', { action, tableId: table.table_id, reservationId });
    setIsLoading(true);
    try {
      switch (action) {
        case 'seat':
          console.log('[TABLE CARD] Seating party at table:', table.table_id);
          await seatParty.mutateAsync({ 
            tableId: table.table_id,
            serverId: undefined // Could be passed from user context
          });
          break;
        case 'close':
          console.log('[TABLE CARD] Closing table:', table.table_id);
          await closeTable.mutateAsync({ tableId: table.table_id });
          break;
        case 'assign':
          if (reservationId) {
            console.log('[TABLE CARD] Assigning reservation:', reservationId, 'to table:', table.table_id);
            await assignReservation.mutateAsync({ 
              reservationId, 
              tableId: table.table_id 
            });
          }
          break;
        case 'cancel':
          if (reservationId) {
            console.log('[TABLE CARD] Cancelling reservation:', reservationId);
            await cancelReservation.mutateAsync({ reservationId });
          }
          break;
        case 'no-show':
          if (reservationId) {
            console.log('[TABLE CARD] Marking no-show for reservation:', reservationId);
            await noShowReservation.mutateAsync({ reservationId });
          }
          break;
      }
      console.log('[TABLE CARD] Action completed successfully:', action);
      onActionComplete();
    } catch (error) {
      console.error('[TABLE CARD] Action failed:', error);
      // You might want to show a toast notification here
    } finally {
      setIsLoading(false);
    }
  };

  const getPrimaryStatusBadge = () => {
    // Default to FREE if no primary_status (should not happen if sessions are properly created)
    const status = table.primary_status || 'FREE';
    
    if (status === 'FREE') {
      return (
        <Badge variant="default" className="bg-green-100 text-green-700 border-green-200">
          <CheckCircle className="h-3 w-3 mr-1" />
          Free
        </Badge>
      );
    }

    if (status === 'OCCUPIED') {
      const elapsed = table.opened_at ? formatDistanceToNow(new Date(table.opened_at), { addSuffix: true }) : '';
      return (
        <Badge variant="default" className="bg-amber-100 text-amber-700 border-amber-200">
          <Users className="h-3 w-3 mr-1" />
          Occupied {elapsed && `(${elapsed})`}
        </Badge>
      );
    }

    return null;
  };

  const getReservationBadge = () => {
    if (table.reservation_status === 'NONE') {
      return null;
    }

    if (table.reservation_status === 'RESERVED_NOW') {
      return (
        <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200">
          <AlertCircle className="h-3 w-3 mr-1" />
          Reserved Now
        </Badge>
      );
    }

    if (table.reservation_status === 'RESERVED_LATER') {
      const startTime = table.next_reservation_start 
        ? new Date(table.next_reservation_start).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })
        : '';
      return (
        <Badge variant="default" className="bg-purple-100 text-purple-700 border-purple-200">
          <Calendar className="h-3 w-3 mr-1" />
          Reserved {startTime && `at ${startTime}`}
        </Badge>
      );
    }

    return null;
  };

  const getQuickActions = () => {
    const actions = [];
    const status = table.primary_status || 'FREE';

    // Primary state actions
    if (status === 'FREE') {
      if (table.reservation_status === 'RESERVED_NOW') {
        actions.push({
          label: 'Check In',
          action: 'seat',
          reservationId: table.reserved_now_id,
          variant: 'default' as const
        });
      } else {
        actions.push({
          label: 'Seat Party',
          action: 'seat',
          variant: 'default' as const
        });
      }
    }

    if (status === 'OCCUPIED') {
      actions.push({
        label: 'Close Table',
        action: 'close',
        variant: 'destructive' as const
      });
    }

    // Reservation actions
    if (table.reservation_status === 'RESERVED_NOW' && table.reserved_now_id) {
      actions.push({
        label: 'Cancel Reservation',
        action: 'cancel',
        reservationId: table.reserved_now_id,
        variant: 'outline' as const
      });
      actions.push({
        label: 'Mark No-Show',
        action: 'no-show',
        reservationId: table.reserved_now_id,
        variant: 'outline' as const
      });
    }

    return actions;
  };

  const quickActions = getQuickActions();

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg">{table.label}</h3>
            <Badge variant="outline" className="text-xs">
              {table.seat_count} seats
            </Badge>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <QrCode className="h-4 w-4 mr-2" />
                View QR Code
              </DropdownMenuItem>
              <DropdownMenuItem>
                <MapPin className="h-4 w-4 mr-2" />
                Merge Tables
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Status Badges */}
        <div className="space-y-2 mb-4">
          {/* Primary State Badge */}
          {getPrimaryStatusBadge()}
          {/* Secondary Reservation Badge */}
          {getReservationBadge()}
        </div>

        {/* Reservation Details */}
        {(table.reservation_status === 'RESERVED_NOW' || table.reservation_status === 'RESERVED_LATER') && (
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <div className="text-sm">
              {table.reservation_status === 'RESERVED_NOW' ? (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span className="font-medium">Due Now</span>
                  </div>
                  {table.reserved_now_name && (
                    <div className="flex items-center gap-1 text-gray-600">
                      <UserCheck className="h-3 w-3" />
                      {table.reserved_now_name}
                    </div>
                  )}
                  {table.reserved_now_phone && (
                    <div className="flex items-center gap-1 text-gray-600">
                      <Phone className="h-3 w-3" />
                      {table.reserved_now_phone}
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-gray-600">
                    <Users className="h-3 w-3" />
                    Party of {table.reserved_now_party_size}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="h-4 w-4 text-purple-500" />
                    <span className="font-medium">Upcoming</span>
                  </div>
                  {table.next_reservation_name && (
                    <div className="flex items-center gap-1 text-gray-600">
                      <UserCheck className="h-3 w-3" />
                      {table.next_reservation_name}
                    </div>
                  )}
                  {table.next_reservation_phone && (
                    <div className="flex items-center gap-1 text-gray-600">
                      <Phone className="h-3 w-3" />
                      {table.next_reservation_phone}
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-gray-600">
                    <Users className="h-3 w-3" />
                    Party of {table.next_reservation_party_size}
                  </div>
                  {table.next_reservation_start && (
                    <div className="flex items-center gap-1 text-gray-600">
                      <Clock className="h-3 w-3" />
                      {new Date(table.next_reservation_start).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        {quickActions.length > 0 && (
          <div className="space-y-2">
            {quickActions.map((action, index) => (
              <Button
                key={index}
                variant={action.variant}
                size="sm"
                className="w-full"
                onClick={() => handleAction(action.action, action.reservationId)}
                disabled={isLoading}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}

        {/* Warning for overdue reservations */}
        {table.reservation_status === 'RESERVED_NOW' && (table.primary_status || 'FREE') === 'FREE' && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700 text-sm">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">Guest due but not seated</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
