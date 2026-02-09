"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, Phone, UserCheck, XCircle, AlertCircle, Calendar } from "lucide-react";
import { UnassignedReservation, TableRuntimeState } from "@/hooks/useTableRuntimeState";
import {
  useAssignReservation,
  useCancelReservation,
  useNoShowReservation,
} from "@/hooks/useTableRuntimeState";
import { formatDistanceToNow } from "date-fns";

interface UnassignedReservationsPanelProps {
  venueId: string;
  reservations: UnassignedReservation[];
  onActionComplete: () => void;
  availableTables: TableRuntimeState[];
}

export function UnassignedReservationsPanel({
  venueId,
  reservations,
  onActionComplete,
  availableTables,
}: UnassignedReservationsPanelProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const assignReservation = useAssignReservation();
  const cancelReservation = useCancelReservation();
  const noShowReservation = useNoShowReservation();

  const handleAction = async (action: string, reservationId: string, tableId?: string) => {
    setIsLoading(reservationId);
    try {
      switch (action) {
        case "assign":
          if (tableId) {
            await assignReservation.mutateAsync({
              reservationId,
              tableId,
              venueId,
            });
          }
          break;
        case "cancel":
          await cancelReservation.mutateAsync({ reservationId, venueId });
          break;
        case "no-show":
          await noShowReservation.mutateAsync({ reservationId, venueId });
          break;
      }
      onActionComplete();
    } catch (_error) {
      // Error silently handled
    } finally {
      setIsLoading(null);
    }
  };

  const getSuggestedTable = (partySize: number) => {
    // Find the smallest available table that can accommodate the party
    const suitableTables = availableTables.filter((table) => table.seat_count >= partySize);
    return suitableTables.sort((a, b) => a.seat_count - b.seat_count)[0];
  };

  const getReservationStatus = (reservation: UnassignedReservation) => {
    const now = new Date();
    const startTime = new Date(reservation.start_at);
    const timeDiff = startTime.getTime() - now.getTime();
    const minutesDiff = Math.floor(timeDiff / (1000 * 60));

    if (minutesDiff < 0) {
      return { status: "overdue", label: "Overdue", color: "destructive" as const };
    } else if (minutesDiff <= 15) {
      return { status: "due", label: "Due Soon", color: "default" as const };
    } else {
      return { status: "upcoming", label: "Upcoming", color: "secondary" as const };
    }
  };

  if (reservations.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Waiting Reservations ({reservations.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reservations.map((reservation) => {
            const status = getReservationStatus(reservation);
            const suggestedTable = getSuggestedTable(reservation.party_size);
            const isActionLoading = isLoading === reservation.id;

            return (
              <Card key={reservation.id} className="relative">
                <CardContent className="p-4">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant={status.color}>{status.label}</Badge>
                      {status.status === "overdue" && (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    <div className="text-sm text-gray-900">
                      {formatDistanceToNow(new Date(reservation.start_at), { addSuffix: true })}
                    </div>
                  </div>

                  {/* Reservation Details */}
                  <div className="space-y-2 mb-4">
                    {reservation.name && (
                      <div className="flex items-center gap-2 text-sm">
                        <UserCheck className="h-4 w-4 text-gray-700" />
                        <span className="font-medium">{reservation.name}</span>
                      </div>
                    )}
                    {reservation.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-900">
                        <Phone className="h-4 w-4 text-gray-700" />
                        {reservation.phone}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-gray-900">
                      <Clock className="h-4 w-4 text-gray-700" />
                      {new Date(reservation.start_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>

                  {/* Suggested Table */}
                  {suggestedTable && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                      <div className="text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="h-4 w-4 text-blue-500" />
                          <span className="font-medium text-blue-700">Suggested Table</span>
                        </div>
                        <div className="text-blue-600">
                          {suggestedTable.label} ({suggestedTable.seat_count} seats)
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="space-y-2">
                    {suggestedTable && (
                      <Button
                        variant="default"
                        size="sm"
                        className="w-full"
                        onClick={() =>
                          handleAction("assign", reservation.id, suggestedTable.table_id)
                        }
                        disabled={isActionLoading}
                      >
                        Assign to {suggestedTable.label}
                      </Button>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleAction("cancel", reservation.id)}
                        disabled={isActionLoading}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleAction("no-show", reservation.id)}
                        disabled={isActionLoading}
                      >
                        No Show
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
