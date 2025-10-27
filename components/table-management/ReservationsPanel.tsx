"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Users, Phone, X, UserCheck, Timer } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, ArrowRight } from "lucide-react";
import {
  useCheckInReservation,
  useCancelReservation,
  Reservation,
} from "@/hooks/useTableReservations";

interface ReservationsPanelProps {
  reservations: Reservation[];
  onActionComplete?: () => void;
}

export function ReservationsPanel({ reservations, onActionComplete }: ReservationsPanelProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const checkInReservation = useCheckInReservation();
  const cancelReservation = useCancelReservation();

  const handleCheckIn = async (reservationId: string, tableId: string) => {
    try {
      setIsLoading(reservationId);
      await checkInReservation.mutateAsync({ reservationId, tableId });
      onActionComplete?.();
    } catch {
      // Error silently handled
    } finally {
      setIsLoading(null);
    }
  };

  const handleCancel = async (reservationId: string) => {
    try {
      setIsLoading(reservationId);
      await cancelReservation.mutateAsync({ reservationId });
      onActionComplete?.();
    } catch {
      // Error silently handled
    } finally {
      setIsLoading(null);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
  };

  const getDuration = (startAt: string, endAt: string) => {
    const start = new Date(startAt);
    const end = new Date(endAt);
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.round(diffMs / (1000 * 60));

    if (diffMins < 60) {
      return `${diffMins} minutes`;
    } else {
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      if (mins === 0) {
        return `${hours} hour${hours > 1 ? "s" : ""}`;
      } else {
        return `${hours}h ${mins}m`;
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "BOOKED":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "CHECKED_IN":
        return "bg-green-100 text-green-800 border-green-200";
      case "COMPLETED":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "CANCELLED":
        return "bg-gray-100 text-gray-800 border-gray-200";
      case "NO_SHOW":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const activeReservations = reservations.filter((r) => {
    // Show reservations that are BOOKED or CHECKED_IN and haven't expired
    if (!["BOOKED", "CHECKED_IN"].includes(r.status)) return false;

    // Check if the reservation has expired
    const now = new Date();
    const endTime = new Date(r.end_at);

    return endTime > now;
  });

  if (activeReservations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Reservations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-900">No active reservations</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Reservations ({activeReservations.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {activeReservations.map((reservation) => (
          <div
            key={reservation.id}
            className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">
                  {reservation.customer_name || "Unnamed Reservation"}
                </span>
                <Badge variant="outline" className={getStatusColor(reservation.status)}>
                  {reservation.status}
                </Badge>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-900">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDate(reservation.start_at)} at {formatTime(reservation.start_at)}
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {reservation.party_size} people
                </div>
                <div className="flex items-center gap-1">
                  <Timer className="h-3 w-3" />
                  {getDuration(reservation.start_at, reservation.end_at)}
                </div>
                {reservation.customer_phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {reservation.customer_phone}
                  </div>
                )}
                {reservation.table_id && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {(() => {
                      const tableLabel =
                        (reservation as { table?: { label?: string } }).table?.label ||
                        reservation.table_id;
                      // If the label already starts with "table", don't add "Table" prefix
                      if (tableLabel.toLowerCase().startsWith("table")) {
                        return tableLabel;
                      }
                      return `Table ${tableLabel}`;
                    })()}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {reservation.table_id && reservation.status === "BOOKED" && (
                <Button
                  size="sm"
                  onClick={() => handleCheckIn(reservation.id, reservation.table_id!)}
                  disabled={isLoading === reservation.id}
                  className="h-8"
                >
                  <UserCheck className="h-3 w-3 mr-1" />
                  Check In
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Move to Table
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleCancel(reservation.id)}
                    disabled={isLoading === reservation.id}
                    className="text-red-600"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
