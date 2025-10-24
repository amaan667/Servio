"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle2, ChefHat, PlayCircle, XCircle, Timer, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface KDSStation {
  id: string;
  venue_id: string;
  station_name: string;
  station_type: string;
  display_order: number;
  color_code: string;
  is_active: boolean;
}

interface KDSTicket {
  id: string;
  venue_id: string;
  order_id: string;
  station_id: string;
  item_name: string;
  quantity: number;
  special_instructions?: string;
  status: "new" | "in_progress" | "ready" | "bumped";
  created_at: string;
  started_at?: string;
  ready_at?: string;
  bumped_at?: string;
  table_number?: number;
  table_label?: string;
  priority: number;
  kds_stations?: KDSStation;
  orders?: {
    id: string;
    customer_name: string;
    order_status: string;
    payment_status?: string;
  };
}

interface KDSClientProps {
  venueId: string;
  venueName?: string;
}

export default function KDSClient({ venueId }: KDSClientProps) {
  const [stations, setStations] = useState<KDSStation[]>([]);
  const [tickets, setTickets] = useState<KDSTicket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5); // seconds

  // Fetch stations
  const fetchStations = useCallback(async () => {
    try {
      const { apiClient } = await import("@/lib/api-client");
      const response = await apiClient.get("/api/kds/stations", { params: { venueId } });
      const data = await response.json();

      if (data.ok) {
        setStations(data.stations || []);
        // Auto-select first station if none selected
        if (!selectedStation && data.stations?.length > 0) {
          setSelectedStation(data.stations[0].id);
        }
      } else {
        setError(data.error || "Failed to load stations");
      }
    } catch {
      setError("Failed to load stations");
    }
  }, [venueId, selectedStation]);

  // Fetch tickets
  const fetchTickets = useCallback(async () => {
    try {
      console.info("[KDS CLIENT] 📤 Fetching tickets...", { venueId, selectedStation });
      const { apiClient } = await import("@/lib/api-client");
      const response = await apiClient.get("/api/kds/tickets", {
        params: { venueId, ...(selectedStation ? { stationId: selectedStation } : {}) },
      });
      const data = await response.json();

      console.info("[KDS CLIENT] 📥 Tickets response:", {
        ok: data.ok,
        count: data.tickets?.length,
      });

      if (data.ok) {
        setTickets(data.tickets || []);
      } else {
        console.error("[KDS CLIENT] ❌ Failed to load tickets:", data.error);
        setError(data.error || "Failed to load tickets");
      }
    } catch (error) {
      console.error("[KDS CLIENT] ❌ Fetch tickets error:", error);
      setError("Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }, [venueId, selectedStation]);

  // Update ticket status
  const updateTicketStatus = useCallback(async (ticketId: string, status: string) => {
    try {
      const { apiClient } = await import("@/lib/api-client");
      const response = await apiClient.patch("/api/kds/tickets", { ticketId, status });

      const data = await response.json();

      if (data.ok) {
        // Update local state
        setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, ...data.ticket } : t)));
      }
    } catch {
      // Silently fail
    }
  }, []);

  // Bump all ready tickets for an order
  const bumpOrder = useCallback(async (orderId: string) => {
    try {
      const { apiClient } = await import("@/lib/api-client");
      const response = await apiClient.patch("/api/kds/tickets/bulk-update", {
        orderId,
        status: "bumped",
      });

      const data = await response.json();

      if (data.ok) {
        // Remove bumped tickets from view
        setTickets((prev) => prev.filter((t) => t.order_id !== orderId));
      }
    } catch {
      // Silently fail
    }
  }, []);

  // Calculate time elapsed since ticket creation
  const getTimeElapsed = useCallback((createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "< 1m";
    if (diffMins < 60) return `${diffMins}m`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
  }, []);

  // Get priority color
  const getPriorityIndicator = (createdAt: string) => {
    const elapsed = new Date().getTime() - new Date(createdAt).getTime();
    const minutes = elapsed / 60000;

    if (minutes > 15) return "border-l-4 border-l-red-500";
    if (minutes > 10) return "border-l-4 border-l-orange-500";
    if (minutes > 5) return "border-l-4 border-l-yellow-500";
    return "border-l-4 border-l-green-500";
  };

  // Group tickets by order
  const ticketsByOrder = useMemo(() => {
    const grouped = new Map<string, KDSTicket[]>();
    tickets.forEach((ticket) => {
      const existing = grouped.get(ticket.order_id) || [];
      grouped.set(ticket.order_id, [...existing, ticket]);
    });
    return grouped;
  }, [tickets]);

  // Initial load
  useEffect(() => {
    fetchStations();
    fetchTickets();
  }, [fetchStations, fetchTickets]);

  // Set up realtime subscription
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`kds-${venueId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "kds_tickets",
          filter: `venue_id=eq.${venueId}`,
        },
        (payload: { eventType: string; new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
          if (payload.eventType === "INSERT") {
            fetchTickets();
          } else if (payload.eventType === "UPDATE") {
            setTickets((prev) =>
              prev.map((t) => (t.id === payload.new?.id ? { ...t, ...payload.new } : t))
            );
          } else if (payload.eventType === "DELETE") {
            setTickets((prev) => prev.filter((t) => t.id !== payload.old?.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [venueId, fetchTickets]);

  // Auto-refresh with configurable interval
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchTickets();
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchTickets]);

  // No loading spinner - show content immediately with empty state
  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">Error: {error}</p>
      </div>
    );
  }

  const activeTickets = tickets.filter((t) => t.status !== "bumped");
  const newTickets = activeTickets.filter((t) => t.status === "new");
  const inProgressTickets = activeTickets.filter((t) => t.status === "in_progress");
  const readyTickets = activeTickets.filter((t) => t.status === "ready");

  return (
    <div className="space-y-6">
      {/* Auto-Refresh Controls */}
      <div className="flex items-center justify-end gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Auto-refresh:</span>
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Timer className="h-4 w-4 mr-2" />
            {autoRefresh ? "ON" : "OFF"}
          </Button>
        </div>
        {autoRefresh && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Every:</span>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="text-sm border rounded-md px-2 py-1 bg-white"
            >
              <option value={3}>3s</option>
              <option value={5}>5s</option>
              <option value={10}>10s</option>
              <option value={15}>15s</option>
              <option value={30}>30s</option>
              <option value={60}>1m</option>
            </select>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">New Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{newTickets.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{inProgressTickets.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Ready</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{readyTickets.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Total Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{activeTickets.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Station Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2 px-2">
        <Button
          variant={selectedStation === null ? "default" : "outline"}
          onClick={() => setSelectedStation(null)}
          className="whitespace-nowrap"
        >
          All Stations
        </Button>
        {stations.map((station) => (
          <Button
            key={station.id}
            variant={selectedStation === station.id ? "default" : "outline"}
            onClick={() => setSelectedStation(station.id)}
            className="whitespace-nowrap"
            style={{
              backgroundColor: selectedStation === station.id ? station.color_code : undefined,
              borderColor: station.color_code,
            }}
          >
            <ChefHat className="h-4 w-4 mr-2" />
            {station.station_name}
          </Button>
        ))}
      </div>

      {/* Tickets Grid - Kanban Style */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-2">
        {/* New Column */}
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg">
            <h3 className="font-semibold text-blue-800">New ({newTickets.length})</h3>
            <Clock className="h-5 w-5 text-blue-600" />
          </div>
          <div className="space-y-3">
            {newTickets.map((ticket) => (
              <Card
                key={ticket.id}
                className={cn(
                  "transition-all hover:shadow-lg cursor-pointer",
                  getPriorityIndicator(ticket.created_at)
                )}
              >
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-lg">{ticket.item_name}</div>
                        <div className="text-sm text-gray-500">
                          {ticket.table_label || `Table ${ticket.table_number}`}
                        </div>
                      </div>
                      <Badge className="text-lg font-bold">{ticket.quantity}x</Badge>
                    </div>

                    {/* Special Instructions */}
                    {ticket.special_instructions && (
                      <div className="bg-yellow-50 border border-yellow-200 p-2 rounded text-sm">
                        <p className="font-medium text-yellow-800">Special Instructions:</p>
                        <p className="text-yellow-700">{ticket.special_instructions}</p>
                      </div>
                    )}

                    {/* Time */}
                    <div className="flex items-center text-sm text-gray-500">
                      <Clock className="h-4 w-4 mr-1" />
                      {getTimeElapsed(ticket.created_at)}
                    </div>

                    {/* Actions */}
                    <Button
                      onClick={() => updateTicketStatus(ticket.id, "in_progress")}
                      className="w-full"
                      size="sm"
                    >
                      <PlayCircle className="h-4 w-4 mr-2" />
                      Start Prep
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {newTickets.length === 0 && (
              <div className="text-center text-gray-400 py-8">No new tickets</div>
            )}
          </div>
        </div>

        {/* In Progress Column */}
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-yellow-50 p-3 rounded-lg">
            <h3 className="font-semibold text-yellow-800">
              In Progress ({inProgressTickets.length})
            </h3>
            <ChefHat className="h-5 w-5 text-yellow-600" />
          </div>
          <div className="space-y-3">
            {inProgressTickets.map((ticket) => (
              <Card
                key={ticket.id}
                className={cn(
                  "transition-all hover:shadow-lg cursor-pointer",
                  getPriorityIndicator(ticket.created_at)
                )}
              >
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-lg">{ticket.item_name}</div>
                        <div className="text-sm text-gray-500">
                          {ticket.table_label || `Table ${ticket.table_number}`}
                        </div>
                      </div>
                      <Badge className="text-lg font-bold">{ticket.quantity}x</Badge>
                    </div>

                    {/* Special Instructions */}
                    {ticket.special_instructions && (
                      <div className="bg-yellow-50 border border-yellow-200 p-2 rounded text-sm">
                        <p className="font-medium text-yellow-800">Special Instructions:</p>
                        <p className="text-yellow-700">{ticket.special_instructions}</p>
                      </div>
                    )}

                    {/* Time */}
                    <div className="flex items-center text-sm text-gray-500">
                      <Clock className="h-4 w-4 mr-1" />
                      {getTimeElapsed(ticket.created_at)}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        onClick={() => updateTicketStatus(ticket.id, "new")}
                        variant="outline"
                        className="flex-1"
                        size="sm"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reset
                      </Button>
                      <Button
                        onClick={() => updateTicketStatus(ticket.id, "ready")}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        size="sm"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Ready
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {inProgressTickets.length === 0 && (
              <div className="text-center text-gray-400 py-8">No tickets in progress</div>
            )}
          </div>
        </div>

        {/* Ready Column */}
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-green-50 p-3 rounded-lg">
            <h3 className="font-semibold text-green-800">Ready ({readyTickets.length})</h3>
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          </div>
          <div className="space-y-3">
            {/* Group ready tickets by order */}
            {Array.from(ticketsByOrder.entries())
              .filter(([, tickets]) => tickets.some((t) => t.status === "ready"))
              .map(([orderId, orderTickets]) => {
                const readyOrderTickets = orderTickets.filter((t) => t.status === "ready");
                const allReady = orderTickets.every((t) => t.status === "ready");
                const firstTicket = readyOrderTickets[0];

                return (
                  <Card key={orderId} className="transition-all hover:shadow-lg">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Order Info */}
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-semibold">
                              {firstTicket.table_label || `Table ${firstTicket.table_number}`}
                            </div>
                            <div className="text-sm text-gray-500">
                              {firstTicket.orders?.customer_name}
                            </div>
                          </div>
                          <Badge
                            variant={allReady ? "default" : "secondary"}
                            className="bg-green-600"
                          >
                            {readyOrderTickets.length} ready
                          </Badge>
                        </div>

                        {/* Items */}
                        <div className="space-y-1">
                          {readyOrderTickets.map((ticket) => (
                            <div
                              key={ticket.id}
                              className="flex items-center justify-between text-sm"
                            >
                              <span>
                                {ticket.quantity}x {ticket.item_name}
                              </span>
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            </div>
                          ))}
                        </div>

                        {/* Time */}
                        <div className="flex items-center text-sm text-gray-500">
                          <Clock className="h-4 w-4 mr-1" />
                          {getTimeElapsed(firstTicket.ready_at || firstTicket.created_at)}
                        </div>

                        {/* Actions */}
                        <Button
                          onClick={() => bumpOrder(orderId)}
                          className="w-full bg-green-600 hover:bg-green-700"
                          size="sm"
                        >
                          <ArrowRight className="h-4 w-4 mr-2" />
                          Bump Order
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            {readyTickets.length === 0 && (
              <div className="text-center text-gray-400 py-8">No ready tickets</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
