"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Clock, 
  CheckCircle2, 
  ChefHat, 
  PlayCircle, 
  XCircle,
  RefreshCw,
  Timer,
  ArrowRight,
  ArrowLeft,
  Monitor,
  Settings,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
  status: 'new' | 'in_progress' | 'ready' | 'bumped';
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
    created_at: string;
  };
}

interface KitchenClientProps {
  venueId: string;
  venueName: string;
}

export default function KitchenClient({ venueId, venueName }: KitchenClientProps) {
  const [stations, setStations] = useState<KDSStation[]>([]);
  const [tickets, setTickets] = useState<KDSTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);
  const router = useRouter();

  const supabase = createClient();

  const loadStations = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('kds_stations')
        .select('*')
        .eq('venue_id', venueId)
        .eq('is_active', true)
        .order('display_order');

      if (error) {
        console.error('Error loading stations:', error);
        return;
      }

      setStations(data || []);
      if (data && data.length > 0 && !selectedStation) {
        setSelectedStation(data[0].id);
      }
    } catch (error) {
      console.error('Error loading stations:', error);
    }
  }, [venueId, selectedStation, supabase]);

  const loadTickets = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('kds_tickets')
        .select(`
          *,
          kds_stations(*),
          orders(id, customer_name, order_status, created_at)
        `)
        .eq('venue_id', venueId)
        .in('status', ['new', 'in_progress', 'ready', 'bumped'])
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading tickets:', error);
        return;
      }

      setTickets(data || []);
    } catch (error) {
      console.error('Error loading tickets:', error);
    }
  }, [venueId, supabase]);

  const updateTicketStatus = async (ticketId: string, status: string) => {
    try {
      const updateData: any = { status };
      
      if (status === 'in_progress') {
        updateData.started_at = new Date().toISOString();
      } else if (status === 'ready') {
        updateData.ready_at = new Date().toISOString();
      } else if (status === 'bumped') {
        updateData.bumped_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('kds_tickets')
        .update(updateData)
        .eq('id', ticketId);

      if (error) {
        console.error('Error updating ticket status:', error);
        return;
      }

      // Reload tickets
      loadTickets();
    } catch (error) {
      console.error('Error updating ticket status:', error);
    }
  };

  const getTicketsForStation = useMemo(() => {
    if (!selectedStation) return [];
    return tickets.filter(ticket => ticket.station_id === selectedStation);
  }, [tickets, selectedStation]);

  const getTicketCounts = useMemo(() => {
    const counts = {
      new: 0,
      in_progress: 0,
      ready: 0,
      bumped: 0
    };

    tickets.forEach(ticket => {
      counts[ticket.status as keyof typeof counts]++;
    });

    return counts;
  }, [tickets]);

  useEffect(() => {
    loadStations();
    loadTickets();
    setLoading(false);
  }, [loadStations, loadTickets]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadTickets();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, loadTickets]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getTimeElapsed = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return '< 1m';
    if (diffMins < 60) return `${diffMins}m`;
    
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ${diffMins % 60}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'ready': return 'bg-green-100 text-green-800';
      case 'bumped': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new': return <Clock className="h-4 w-4" />;
      case 'in_progress': return <PlayCircle className="h-4 w-4" />;
      case 'ready': return <CheckCircle2 className="h-4 w-4" />;
      case 'bumped': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading kitchen display...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", isFullscreen && "p-4")}>
      {/* Header */}
      {!isFullscreen && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/dashboard/${venueId}`)}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleFullscreen}
              className="flex items-center gap-2"
            >
              <Maximize2 className="h-4 w-4" />
              Fullscreen
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={cn("flex items-center gap-2", autoRefresh && "bg-green-100")}
            >
              <RefreshCw className={cn("h-4 w-4", autoRefresh && "animate-spin")} />
              Auto Refresh
            </Button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Clock className="h-6 w-6 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">New Orders</p>
                <p className="text-xl font-bold text-blue-600">{getTicketCounts.new}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <PlayCircle className="h-6 w-6 text-yellow-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">In Progress</p>
                <p className="text-xl font-bold text-yellow-600">{getTicketCounts.in_progress}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">Ready</p>
                <p className="text-xl font-bold text-green-600">{getTicketCounts.ready}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <XCircle className="h-6 w-6 text-red-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">Bumped</p>
                <p className="text-xl font-bold text-red-600">{getTicketCounts.bumped}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Station Selector */}
      {stations.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {stations.map((station) => (
            <Button
              key={station.id}
              variant={selectedStation === station.id ? "default" : "outline"}
              onClick={() => setSelectedStation(station.id)}
              className="flex items-center gap-2"
            >
              <ChefHat className="h-4 w-4" />
              {station.station_name}
            </Button>
          ))}
        </div>
      )}

      {/* Kitchen Display */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {getTicketsForStation.map((ticket) => (
          <Card key={ticket.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(ticket.status)}
                  <Badge className={getStatusColor(ticket.status)}>
                    {ticket.status.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">
                    {ticket.table_label || `Table ${ticket.table_number || 'N/A'}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatTime(ticket.created_at)}
                  </p>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-3">
              <div>
                <h3 className="font-semibold text-lg">{ticket.item_name}</h3>
                <p className="text-sm text-muted-foreground">Qty: {ticket.quantity}</p>
                {ticket.special_instructions && (
                  <p className="text-sm bg-yellow-50 p-2 rounded border-l-4 border-yellow-400">
                    <strong>Note:</strong> {ticket.special_instructions}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Order #{ticket.order_id.slice(-6)}</span>
                <span className="flex items-center gap-1">
                  <Timer className="h-3 w-3" />
                  {getTimeElapsed(ticket.created_at)}
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                {ticket.status === 'new' && (
                  <Button
                    size="sm"
                    onClick={() => updateTicketStatus(ticket.id, 'in_progress')}
                    className="flex-1"
                  >
                    <PlayCircle className="h-4 w-4 mr-1" />
                    Start
                  </Button>
                )}
                
                {ticket.status === 'in_progress' && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateTicketStatus(ticket.id, 'bumped')}
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Bump
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => updateTicketStatus(ticket.id, 'ready')}
                      className="flex-1"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Ready
                    </Button>
                  </>
                )}
                
                {ticket.status === 'ready' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateTicketStatus(ticket.id, 'in_progress')}
                    className="flex-1"
                  >
                    <ArrowRight className="h-4 w-4 mr-1" />
                    Served
                  </Button>
                )}
                
                {ticket.status === 'bumped' && (
                  <Button
                    size="sm"
                    onClick={() => updateTicketStatus(ticket.id, 'in_progress')}
                    className="flex-1"
                  >
                    <PlayCircle className="h-4 w-4 mr-1" />
                    Restart
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {getTicketsForStation.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <ChefHat className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Active Orders</h3>
            <p className="text-muted-foreground">
              {selectedStation 
                ? `No orders for ${stations.find(s => s.id === selectedStation)?.station_name}`
                : 'Select a station to view orders'
              }
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
