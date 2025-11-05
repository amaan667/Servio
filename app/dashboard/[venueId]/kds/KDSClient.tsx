"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { getRealtimeChannelName } from "@/lib/realtime-device-id";
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
  ticket_status?: "bumped" | string;
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
  initialTickets?: unknown;
  initialStations?: unknown;
}

export default function KDSClient({ venueId, initialTickets, initialStations }: KDSClientProps) {
  // Cache KDS stations to prevent flicker
  const getCachedStations = () => {
    if (typeof window === "undefined") return [];
    const cached = sessionStorage.getItem(`kds_stations_${venueId}`);
    return cached ? JSON.parse(cached) : [];
  };

  const getCachedSelectedStation = () => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem(`kds_selected_station_${venueId}`);
  };

  const getCachedTickets = () => {
    if (typeof window === "undefined") return [];
    const cached = sessionStorage.getItem(`kds_tickets_${venueId}`);
    return cached ? JSON.parse(cached) : [];
  };

  // Use server-provided data, then cached, then empty array
  const [stations, setStations] = useState<KDSStation[]>(
    (initialStations as KDSStation[]) || getCachedStations() || []
  );
  const [tickets, setTickets] = useState<KDSTicket[]>(
    (initialTickets as KDSTicket[]) || getCachedTickets() || []
  );
  const [loading, setLoading] = useState(false); // Start with false to prevent flicker
  const [error, setError] = useState<string | null>(null);
  const [selectedStation, setSelectedStation] = useState<string | null>(getCachedSelectedStation());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5); // seconds

  // Fetch stations
  const fetchStations = useCallback(async () => {
    try {
      const { apiClient } = await import("@/lib/api-client");
      const response = await apiClient.get("/api/kds/stations", { params: { venueId } });
      const data = await response.json();

      if (data.ok) {
        const fetchedStations = data.stations || [];
        setStations(fetchedStations);
        // Cache stations to prevent flicker
        if (typeof window !== "undefined") {
          sessionStorage.setItem(`kds_stations_${venueId}`, JSON.stringify(fetchedStations));
        }
        // Auto-select first station if none selected
        if (!selectedStation && fetchedStations.length > 0) {
          const firstStationId = fetchedStations[0].id;
          setSelectedStation(firstStationId);
          if (typeof window !== "undefined") {
            sessionStorage.setItem(`kds_selected_station_${venueId}`, firstStationId);
          }
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
      const { apiClient } = await import("@/lib/api-client");
      const response = await apiClient.get("/api/kds/tickets", {
        params: {
          venueId,
          ...(selectedStation
            ? { stationId: selectedStation }
            : {
                /* Empty */
              }),
        },
      });
      const data = await response.json();

      if (data.ok) {
        setTickets(data.tickets || []);
        // Cache tickets
        if (typeof window !== "undefined") {
          sessionStorage.setItem(`kds_tickets_${venueId}`, JSON.stringify(data.tickets || []));
        }
      } else {
        setError(data.error || "Failed to load tickets");
      }
    } catch (_error) {
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
        // REMOVE bumped tickets from KDS entirely
        setTickets((prev) => prev.filter((t) => t.order_id !== orderId));
      } else {
        // Intentionally empty
      }
    } catch (_error) {
      // Error handled silently
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

  // Set up realtime subscription with token refresh handling
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null;
    let authSubscription: { unsubscribe: () => void } | null = null;
    let isMounted = true;

    const setupChannel = () => {
      // Use unique channel name with device ID to prevent conflicts
      const channelName = getRealtimeChannelName("kds", venueId);
      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "kds_tickets",
            filter: `venue_id=eq.${venueId}`,
          },
          (payload: {
            eventType: string;
            new?: Record<string, unknown>;
            old?: Record<string, unknown>;
          }) => {
            if (!isMounted) return;

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
        .subscribe((status: string) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            // Try to reconnect after token refresh
            setTimeout(async () => {
              try {
                const {
                  data: { session },
                } = await supabase.auth.getSession();
                if (session && channel) {
                  channel.subscribe();
                }
              } catch (_error) {
                // Session invalid
              }
            }, 3000);
          }
        });

      return channel;
    };

    // Set up auth state change listener to reconnect on token refresh
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED" && channel) {
        if (channel.state !== "joined") {
          channel.subscribe();
        }
      }
    });
    authSubscription = subscription;

    channel = setupChannel();

    return () => {
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
      if (authSubscription) {
        authSubscription.unsubscribe();
        authSubscription = null;
      }
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

  // Sort tickets: non-bumped first (by created_at), then bumped at bottom
  const sortedTickets = [...tickets].sort((a, b) => {
    // Bumped tickets always go to bottom
    if (a.ticket_status === "bumped" && b.ticket_status !== "bumped") return 1;
    if (a.ticket_status !== "bumped" && b.ticket_status === "bumped") return -1;

    // For non-bumped tickets, sort by created_at (oldest first for priority)
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const activeTickets = sortedTickets.filter((t) => t.status !== "bumped");
  const newTickets = activeTickets.filter((t) => t.status === "new" || t.status === "in_progress"); // Treat both as "preparing"
  const readyTickets = activeTickets.filter((t) => t.status === "ready");
  const bumpedTickets = sortedTickets.filter((t) => t.status === "bumped");

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
            <CardTitle className="text-sm font-medium text-gray-500">Preparing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{newTickets.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Ready to Serve</CardTitle>
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

      {/* Tickets Grid - Kanban Style (2 columns: Preparing + Ready) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-2">
        {/* Preparing Column (no action needed - automatically in prep) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg">
            <h3 className="font-semibold text-blue-800">Preparing ({newTickets.length})</h3>
            <ChefHat className="h-5 w-5 text-blue-600" />
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
                      <div className="flex-1">
                        <div className="font-semibold text-lg">{ticket.item_name}</div>
                        <div className="text-sm text-gray-500">
                          {ticket.table_label || `Table ${ticket.table_number}`}
                        </div>
                      </div>
                      <Badge className="text-lg font-bold shrink-0">{ticket.quantity}x</Badge>
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

                    {/* Mark as Ready when done preparing */}
                    <Button
                      onClick={() => updateTicketStatus(ticket.id, "ready")}
                      className="w-full bg-green-600 hover:bg-green-700"
                      size="sm"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Mark Ready
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {newTickets.length === 0 && (
              <div className="text-center text-gray-400 py-8">No items preparing</div>
            )}
          </div>
        </div>

        {/* Not Used - removed this column since orders go straight to preparing */}

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
