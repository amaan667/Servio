"use client";

import React, { useEffect, useState } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { getRealtimeChannelName } from "@/lib/realtime-device-id";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle2, ChefHat, Timer, ArrowRight } from "lucide-react";
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
  kdsTier?: "basic" | "advanced" | "enterprise" | false;
  tier?: string;
  role?: string;
}

export default function KDSClient({
  venueId,
  initialTickets,
  initialStations,
  kdsTier = false,
  tier: _tier,
  role: _role,
}: KDSClientProps) {
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
  const [refreshInterval, setRefreshInterval] = useState(15); // seconds - increased to reduce rate limiting
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "connecting" | "disconnected" | "error"
  >("connecting");
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  // Throttle fetch requests to prevent rate limiting
  const lastFetchRef = React.useRef<number>(0);
  const minFetchInterval = 3000; // Minimum 3 seconds between fetches
  const selectedStationRef = React.useRef<string | null>(selectedStation);

  // Keep ref in sync with state
  React.useEffect(() => {
    selectedStationRef.current = selectedStation;
  }, [selectedStation]);

  // Fetch stations
  const fetchStations = async () => {
    try {
      const { apiClient } = await import("@/lib/api-client");
      const response = await apiClient.get("/api/kds/stations", { params: { venueId } });

      const data = await response.json();

      if (data.success) {
        const fetchedStations = data.data?.stations || [];
        setStations(fetchedStations);
        if (typeof window !== "undefined") {
          sessionStorage.setItem(`kds_stations_${venueId}`, JSON.stringify(fetchedStations));
        }
        if (!selectedStationRef.current && fetchedStations.length > 0) {
          const firstStationId = fetchedStations[0].id;
          setSelectedStation(firstStationId);
          if (typeof window !== "undefined") {
            sessionStorage.setItem(`kds_selected_station_${venueId}`, firstStationId);
          }
        }
      } else {
        setError(data.error?.message || "Failed to load stations");
      }
    } catch (_error) {
      setError("Failed to load stations");
    }
  };

  // Fetch tickets with throttling to prevent rate limiting
  const fetchTickets = async () => {
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchRef.current;

    if (timeSinceLastFetch < minFetchInterval) {
      return;
    }

    lastFetchRef.current = now;

    try {
      const currentStation = selectedStationRef.current;

      const { apiClient } = await import("@/lib/api-client");
      const response = await apiClient.get("/api/kds/tickets", {
        params: {
          venueId,
          ...(currentStation ? { station_id: currentStation } : {}),
        },
      });

      const data = await response.json();

      if (data.success) {
        const fetchedTickets = (data.data?.tickets || []) as KDSTicket[];
        const activeFetchedTickets = fetchedTickets.filter((t) => t.status !== "bumped");

        setTickets(activeFetchedTickets);
        setError(null);
        if (typeof window !== "undefined") {
          sessionStorage.setItem(`kds_tickets_${venueId}`, JSON.stringify(activeFetchedTickets));
        }
      } else {
        setError(data.error?.message || "Failed to load tickets");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  };

  // Update ticket status (optimistic for "ready" so item moves to Ready section immediately)
  const updateTicketStatus = async (ticketId: string, status: string) => {
    const previousTickets = tickets;
    if (status === "ready") {
      setTickets(
        (prev) =>
          prev.map((t) =>
            t.id === ticketId ? { ...t, status: "ready", ready_at: new Date().toISOString() } : t
          ) as KDSTicket[]
      );
    } else if (status === "bumped") {
      setTickets((prev) => prev.filter((t) => t.id !== ticketId));
    }
    try {
      const { apiClient } = await import("@/lib/api-client");
      const payload = { ticket_id: ticketId, status, venueId };
      const idempotencyKey = `kds-ticket-${ticketId}-${status}-${Date.now()}`;
      const response = await apiClient.patch("/api/kds/tickets", payload, {
        params: { venueId },
        headers: { "x-idempotency-key": idempotencyKey },
      });
      if (!response.ok) {
        setTickets(previousTickets);
        return;
      }
      const data = await response.json();
      if (data.success) {
        const updatedTicket = data.data?.ticket as Partial<KDSTicket> | undefined;
        const effectiveStatus = (updatedTicket?.status ?? status) as KDSTicket["status"];
        setTickets((prev) => {
          if (effectiveStatus === "bumped") {
            return prev.filter((t) => t.id !== ticketId);
          }
          return prev.map((t) =>
            t.id === ticketId ? { ...t, ...updatedTicket, status: effectiveStatus } : t
          );
        });
      } else {
        setTickets(previousTickets);
      }
    } catch (error) {
      setTickets(previousTickets);
      setError(error instanceof Error ? error.message : "Failed to update ticket");
    }
  };

  // Bump all ready tickets for an order
  // Derived function - no useCallback needed (React Compiler handles this)
  const bumpOrder = async (orderId: string) => {
    try {
      const { apiClient } = await import("@/lib/api-client");

      // Collect all ready tickets for this order
      const orderTickets = tickets.filter((t) => t.order_id === orderId && t.status === "ready");

      if (orderTickets.length === 0) {
        return;
      }

      const response = await apiClient.patch(
        "/api/kds/tickets/bulk-update",
        {
          ticket_ids: orderTickets.map((t) => t.id),
          status: "bumped",
          order_id: orderId,
        },
        {
          params: { venueId },
        }
      );

      const data = await response.json();

      if (data.success) {
        // REMOVE bumped tickets from KDS - they move to Live Orders for "Mark Served"
        setTickets((prev) => prev.filter((t) => t.order_id !== orderId));
      } else {
        // Intentionally empty
      }
    } catch (_error) {
      // Error handled silently
    }
  };

  // Calculate time elapsed since ticket creation
  // Derived function - no useCallback needed (React Compiler handles this)
  const getTimeElapsed = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "< 1m";
    if (diffMins < 60) return `${diffMins}m`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
  };

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
  // Derived state - no memoization needed (React Compiler handles this)
  const ticketsByOrder = (() => {
    const grouped = new Map<string, KDSTicket[]>();
    tickets.forEach((ticket) => {
      const existing = grouped.get(ticket.order_id) || [];
      grouped.set(ticket.order_id, [...existing, ticket]);
    });
    return grouped;
  })();

  // Trigger backfill if no tickets found after initial load (only once)
  const backfillTriggeredRef = React.useRef(false);
  useEffect(() => {
    // Only trigger backfill once per session
    if (backfillTriggeredRef.current) return;

    const triggerBackfill = async () => {
      // Wait a bit for initial fetch to complete
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // If still no tickets, trigger backfill ONCE
      if (tickets.length === 0 && !loading && !backfillTriggeredRef.current) {
        backfillTriggeredRef.current = true;
        try {
          const { apiClient } = await import("@/lib/api-client");
          const response = await apiClient.post("/api/kds/backfill", {
            venueId,
            scope: "today",
          });
          const data = await response.json();

          if (data.ok && data.tickets_created > 0) {
            // Wait a moment then refresh tickets
            setTimeout(() => {
              fetchTickets();
            }, 1000);
          }
        } catch {
          // Backfill failed, continue without tickets
        }
      }
    };

    triggerBackfill();
  }, [tickets.length, loading, venueId]); // Removed fetchTickets from deps to prevent infinite loop

  // Initial load - only run once on mount
  useEffect(() => {
    // Use initial data if available, otherwise fetch
    if (!initialStations || (Array.isArray(initialStations) && initialStations.length === 0)) {
      fetchStations();
    }
    if (!initialTickets || (Array.isArray(initialTickets) && initialTickets.length === 0)) {
      fetchTickets();
    }
  }, [venueId]); // Only depend on venueId, ignore fetch functions to prevent infinite loop

  // Set up realtime subscription with token refresh handling
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;
    let authSubscription: { unsubscribe: () => void } | null = null;
    let isMounted = true;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    const maxReconnectAttempts = 5;

    const attemptReconnect = () => {
      if (!isMounted || reconnectAttempts >= maxReconnectAttempts) {
        if (reconnectAttempts >= maxReconnectAttempts) {
          setConnectionStatus("error");
          setError("Lost connection to KDS. Please refresh the page.");
        }
        return;
      }

      setReconnectAttempts((prev) => prev + 1);
      setConnectionStatus("connecting");

      // Exponential backoff: 1s, 2s, 4s, 8s, 16s
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);

      reconnectTimeout = setTimeout(async () => {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (session && channel) {
            // Clean up old channel
            if (channel.state === "joined") {
              supabase.removeChannel(channel);
            }

            // Create new channel
            channel = setupChannel();

            // Trigger backfill to ensure we have latest data
            setTimeout(() => {
              if (isMounted) {
                fetchTickets();
              }
            }, 1000);
          } else {
            // Session invalid, stop trying to reconnect
            setConnectionStatus("error");
            setError("Authentication expired. Please refresh the page.");
          }
        } catch {
          attemptReconnect();
        }
      }, delay);
    };

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
              const newTicket = payload.new as KDSTicket | undefined;
              if (newTicket) {
                if (newTicket.status === "bumped") {
                  return;
                }

                const currentStation = selectedStationRef.current;
                if (!currentStation) {
                  setTickets((prev) => {
                    if (prev.some((t) => t.id === newTicket.id)) {
                      return prev;
                    }
                    return [...prev, newTicket];
                  });
                } else if (newTicket.station_id === currentStation) {
                  setTickets((prev) => {
                    if (prev.some((t) => t.id === newTicket.id)) {
                      return prev;
                    }
                    return [...prev, newTicket];
                  });
                }
              }
            } else if (payload.eventType === "UPDATE") {
              // For updates, merge the updated ticket data
              // But only if it matches the current station filter (or no filter for "All Stations")
              const updatedTicket = payload.new as KDSTicket | undefined;
              if (updatedTicket) {
                // CRITICAL: Always remove bumped tickets immediately - they disappear from KDS
                if (updatedTicket.status === "bumped") {
                  setTickets((prev) => prev.filter((t) => t.id !== updatedTicket.id));
                  return;
                }

                const oldTicket = payload.old as KDSTicket | undefined;
                const stationChanged =
                  oldTicket && oldTicket.station_id !== updatedTicket.station_id;
                const currentStation = selectedStationRef.current;

                if (!currentStation) {
                  setTickets((prev) => {
                    const existingIndex = prev.findIndex((t) => t.id === updatedTicket.id);
                    if (existingIndex >= 0) {
                      return prev.map((t) =>
                        t.id === updatedTicket.id ? { ...t, ...updatedTicket } : t
                      );
                    } else {
                      if (updatedTicket.status !== "bumped") {
                        return [...prev, updatedTicket];
                      }
                      return prev;
                    }
                  });
                } else {
                  if (updatedTicket.station_id === currentStation) {
                    setTickets((prev) => {
                      const existingIndex = prev.findIndex((t) => t.id === updatedTicket.id);
                      if (existingIndex >= 0) {
                        return prev.map((t) =>
                          t.id === updatedTicket.id ? { ...t, ...updatedTicket } : t
                        );
                      } else {
                        if (updatedTicket.status !== "bumped") {
                          return [...prev, updatedTicket];
                        }
                        return prev;
                      }
                    });
                  } else {
                    if (currentStation && stationChanged) {
                      setTickets((prev) => prev.filter((t) => t.id !== updatedTicket.id));
                    }
                  }
                }
              }
            } else if (payload.eventType === "DELETE") {
              setTickets((prev) => prev.filter((t) => t.id !== payload.old?.id));
            }
          }
        )
        .subscribe((status: string) => {
          if (!isMounted) return;

          if (status === "SUBSCRIBED") {
            setConnectionStatus("connected");
            setReconnectAttempts(0);
            setError(null);
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            setConnectionStatus("disconnected");
            attemptReconnect();
          } else if (status === "SUBSCRIBING") {
            setConnectionStatus("connecting");
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
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
      if (authSubscription) {
        authSubscription.unsubscribe();
        authSubscription = null;
      }
    };
  }, [venueId, selectedStation]); // Removed fetchTickets from deps to prevent infinite loop

  // Auto-refresh with configurable interval
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchTickets();
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, venueId, selectedStation]); // Removed fetchTickets from deps to prevent infinite loop

  // No loading spinner - show content immediately with empty state
  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">Error: {error}</p>
      </div>
    );
  }

  // Filter out bumped tickets - they disappear from KDS and move to Live Orders
  const activeTickets = tickets.filter((t) => t.status !== "bumped");

  // Sort by created_at (oldest first for priority)
  const sortedTickets = [...activeTickets].sort((a, b) => {
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  // Split into Preparing and Ready columns
  const newTickets = sortedTickets.filter((t) => t.status === "new" || t.status === "in_progress");
  const readyTickets = sortedTickets.filter((t) => t.status === "ready");

  return (
    <div className="space-y-6">
      {/* Connection Status - Always visible at top */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-200 -mx-2 px-2 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                {
                  "bg-green-100 text-green-800 border border-green-200":
                    connectionStatus === "connected",
                  "bg-yellow-100 text-yellow-800 border border-yellow-200":
                    connectionStatus === "connecting",
                  "bg-red-100 text-red-800 border border-red-200":
                    connectionStatus === "disconnected" || connectionStatus === "error",
                }
              )}
            >
              <div
                className={cn("w-2 h-2 rounded-full", {
                  "bg-green-500": connectionStatus === "connected",
                  "bg-yellow-500 animate-pulse": connectionStatus === "connecting",
                  "bg-red-500": connectionStatus === "disconnected" || connectionStatus === "error",
                })}
              />
              <span>
                {connectionStatus === "connected" && "KDS Online"}
                {connectionStatus === "connecting" && "Reconnecting..."}
                {connectionStatus === "disconnected" && "Disconnected"}
                {connectionStatus === "error" && "Connection Failed"}
                {reconnectAttempts > 0 && ` (${reconnectAttempts}/5)`}
              </span>
            </div>
          </div>

          {/* Auto-Refresh Controls */}
          <div className="flex items-center gap-3">
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
                  <option value={10}>10s</option>
                  <option value={15}>15s</option>
                  <option value={20}>20s</option>
                  <option value={30}>30s</option>
                  <option value={60}>1m</option>
                  <option value={120}>2m</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-2">
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
      <div className="space-y-2 px-2">
        <div className="flex gap-2 overflow-x-auto pb-2">
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
        {/* Tier-specific station limit info */}
        {kdsTier === "advanced" && (
          <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
            <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
              Advanced KDS
            </Badge>
            <span>Multi-station enabled ({stations.length} active stations)</span>
          </div>
        )}
        {kdsTier === "enterprise" && (
          <div className="flex items-center gap-2 text-sm text-purple-600 bg-purple-50 border border-purple-200 rounded-md px-3 py-2">
            <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300">
              Enterprise KDS
            </Badge>
            <span>
              Multi-venue, multi-station enabled ({stations.length} active stations in this venue)
            </span>
          </div>
        )}
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
                        <div className="text-sm text-gray-600 font-medium">
                          {ticket.orders?.customer_name ||
                            ticket.table_label ||
                            `Table ${ticket.table_number}`}
                        </div>
                        {ticket.orders?.customer_name && ticket.table_number && (
                          <div className="text-xs text-gray-500">Table {ticket.table_number}</div>
                        )}
                      </div>
                      <Badge className="text-lg font-bold shrink-0">{ticket.quantity}x</Badge>
                    </div>

                    {/* Modifiers */}
                    {(ticket as { modifiers?: Record<string, string[]> }).modifiers && (
                      <div className="bg-purple-50 border border-purple-200 p-2 rounded text-sm">
                        <p className="font-medium text-purple-800 mb-1">Modifiers:</p>
                        {Object.entries(
                          (ticket as { modifiers?: Record<string, string[]> }).modifiers || {}
                        ).map(([modName, options]) => (
                          <p key={modName} className="text-xs text-purple-700">
                            {modName}: {options.join(", ")}
                          </p>
                        ))}
                      </div>
                    )}
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
            {/* Show individual ready tickets with Mark Bumped button */}
            {readyTickets.map((ticket) => (
              <Card
                key={ticket.id}
                className="transition-all hover:shadow-lg cursor-pointer border-l-4 border-green-500"
              >
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-lg">{ticket.item_name}</div>
                        <div className="text-sm text-gray-600 font-medium">
                          {ticket.orders?.customer_name ||
                            ticket.table_label ||
                            `Table ${ticket.table_number}`}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-green-600 text-white">{ticket.quantity}x</Badge>
                      </div>
                    </div>

                    {/* Special Instructions */}
                    {ticket.special_instructions && (
                      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-2 rounded">
                        <p className="text-sm text-yellow-800">
                          <strong>Note:</strong> {ticket.special_instructions}
                        </p>
                      </div>
                    )}

                    {/* Time Elapsed */}
                    <div className="flex items-center text-sm text-gray-500">
                      <Clock className="h-4 w-4 mr-1" />
                      {getTimeElapsed(ticket.ready_at || ticket.created_at)}
                    </div>

                    {/* Bump Item Button */}
                    <Button
                      onClick={() => updateTicketStatus(ticket.id, "bumped")}
                      className="w-full bg-purple-600 hover:bg-purple-700"
                      size="sm"
                    >
                      <ArrowRight className="h-4 w-4 mr-2" />
                      Bump Item
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {readyTickets.length === 0 && (
              <div className="text-center text-gray-400 py-8">No ready tickets</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
