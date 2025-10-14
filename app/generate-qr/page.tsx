"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { QrCode, Plus, Trash2, Copy, Download, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import QRCodeDisplay from "@/components/qr-code-display";
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';

export default function GenerateQRPage() {
  const [venueId, setVenueId] = useState<string>('');
  const [venueName, setVenueName] = useState<string>('Your Venue');
  const [tables, setTables] = useState<any[]>([]);
  const [counters, setCounters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [venue, setVenue] = useState<any>(null);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [newCounterName, setNewCounterName] = useState('');
  const [isAddingTable, setIsAddingTable] = useState(false);
  const [isAddingCounter, setIsAddingCounter] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const getSession = async () => {
      const supabase = createClient();
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error getting session:', error);
        return;
      }
      
      setSession(session);
      
      if (session?.user) {
        // Get user's venue
        const { data: venues, error: venueError } = await supabase
          .from('venues')
          .select('venue_id, venue_name')
          .eq('owner_user_id', session.user.id)
          .order('created_at', { ascending: true })
          .limit(1);
          
        if (venueError) {
          console.error('Error fetching venue:', venueError);
          return;
        }
        
        if (venues && venues.length > 0) {
          const userVenue = venues[0];
          setVenueId(userVenue.venue_id);
          setVenueName(userVenue.venue_name);
          setVenue(userVenue);
          await loadTablesAndCounters(userVenue.venue_id);
        } else {
          // No venue found, redirect to complete profile
          router.push('/complete-profile');
        }
      } else {
        // No session, redirect to sign in
        router.push('/sign-in');
      }
    };

    getSession();
  }, [router]);

  const loadTablesAndCounters = async (vid: string) => {
    try {
      setLoading(true);
      const supabase = createClient();
      
      // Load tables
      const { data: tablesData, error: tablesError } = await supabase
        .from('tables')
        .select('*')
        .eq('venue_id', vid)
        .eq('is_counter', false)
        .order('table_number', { ascending: true });

      if (tablesError) {
        console.error('Error loading tables:', tablesError);
      } else {
        setTables(tablesData || []);
      }

      // Load counters
      const { data: countersData, error: countersError } = await supabase
        .from('tables')
        .select('*')
        .eq('venue_id', vid)
        .eq('is_counter', true)
        .order('table_number', { ascending: true });

      if (countersError) {
        console.error('Error loading counters:', countersError);
      } else {
        setCounters(countersData || []);
      }
    } catch (error) {
      console.error('Error in loadTablesAndCounters:', error);
      toast({
        title: "Error",
        description: "Failed to load tables and counters",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addTable = async () => {
    if (!newTableNumber.trim()) {
      toast({
        title: "Error",
        description: "Please enter a table number",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsAddingTable(true);
      const supabase = createClient();
      
      const { error } = await supabase
        .from('tables')
        .insert({
          venue_id: venueId,
          table_number: parseInt(newTableNumber),
          is_counter: false,
          is_active: true,
          created_at: new Date().toISOString()
        });

      if (error) {
        throw error;
      }

      toast({
        title: "Table added",
        description: `Table ${newTableNumber} has been added successfully.`,
      });

      setNewTableNumber('');
      await loadTablesAndCounters(venueId);
    } catch (error: any) {
      console.error('Error adding table:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add table",
        variant: "destructive",
      });
    } finally {
      setIsAddingTable(false);
    }
  };

  const addCounter = async () => {
    if (!newCounterName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a counter name",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsAddingCounter(true);
      const supabase = createClient();
      
      const { error } = await supabase
        .from('tables')
        .insert({
          venue_id: venueId,
          table_number: 0, // Counters use 0 as table number
          is_counter: true,
          is_active: true,
          counter_name: newCounterName.trim(),
          created_at: new Date().toISOString()
        });

      if (error) {
        throw error;
      }

      toast({
        title: "Counter added",
        description: `${newCounterName} counter has been added successfully.`,
      });

      setNewCounterName('');
      await loadTablesAndCounters(venueId);
    } catch (error: any) {
      console.error('Error adding counter:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add counter",
        variant: "destructive",
      });
    } finally {
      setIsAddingCounter(false);
    }
  };

  const deleteTable = async (tableId: string, tableNumber: number) => {
    if (!confirm(`Are you sure you want to delete Table ${tableNumber}?`)) {
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('tables')
        .delete()
        .eq('id', tableId);

      if (error) {
        throw error;
      }

      toast({
        title: "Table deleted",
        description: `Table ${tableNumber} has been deleted successfully.`,
      });

      await loadTablesAndCounters(venueId);
    } catch (error: any) {
      console.error('Error deleting table:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete table",
        variant: "destructive",
      });
    }
  };

  const deleteCounter = async (counterId: string, counterName: string) => {
    if (!confirm(`Are you sure you want to delete ${counterName} counter?`)) {
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('tables')
        .delete()
        .eq('id', counterId);

      if (error) {
        throw error;
      }

      toast({
        title: "Counter deleted",
        description: `${counterName} counter has been deleted successfully.`,
      });

      await loadTablesAndCounters(venueId);
    } catch (error: any) {
      console.error('Error deleting counter:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete counter",
        variant: "destructive",
      });
    }
  };

  const getQRUrl = (tableId: string, isCounter: boolean = false, counterName?: string) => {
    const baseUrl = window.location.origin;
    const tableParam = isCounter ? `counter=${counterName || 'counter'}` : `table=${tableId}`;
    return `${baseUrl}/order?venue=${venueId}&${tableParam}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "QR code URL copied to clipboard",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading QR generator...</p>
        </div>
      </div>
    );
  }

  if (!venueId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">No venue found. Please complete your profile first.</p>
          <Button onClick={() => router.push('/complete-profile')} className="mt-4">
            Complete Profile
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <NavigationBreadcrumb venueId={venueId} />
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            QR Code Generator
          </h1>
          <p className="text-lg text-foreground mt-2">
            Generate and manage QR codes for your tables and counters
          </p>
        </div>

        {/* Tables Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <QrCode className="h-5 w-5" />
                <span>Tables ({tables.length})</span>
              </div>
              <div className="flex items-center space-x-2">
                <Input
                  type="number"
                  placeholder="Table number"
                  value={newTableNumber}
                  onChange={(e) => setNewTableNumber(e.target.value)}
                  className="w-32"
                />
                <Button 
                  onClick={addTable} 
                  disabled={isAddingTable}
                  className="flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>{isAddingTable ? 'Adding...' : 'Add Table'}</span>
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tables.length === 0 ? (
              <div className="text-center py-8">
                <QrCode className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No tables yet</h3>
                <p className="text-muted-foreground">Add your first table to generate QR codes for customers.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tables.map(table => {
                  const qrUrl = getQRUrl(table.id);
                  return (
                    <div key={table.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-medium text-foreground">Table {table.table_number}</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteTable(table.id, table.table_number)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <QRCodeDisplay currentUrl={qrUrl} venueName={venueName} />
                      <div className="mt-3 flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(qrUrl)}
                          className="flex items-center space-x-1"
                        >
                          <Copy className="h-3 w-3" />
                          <span>Copy</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(qrUrl, '_blank')}
                          className="flex items-center space-x-1"
                        >
                          <Download className="h-3 w-3" />
                          <span>Test</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Counters Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>Counters ({counters.length})</span>
              </div>
              <div className="flex items-center space-x-2">
                <Input
                  placeholder="Counter name"
                  value={newCounterName}
                  onChange={(e) => setNewCounterName(e.target.value)}
                  className="w-40"
                />
                <Button 
                  onClick={addCounter} 
                  disabled={isAddingCounter}
                  className="flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>{isAddingCounter ? 'Adding...' : 'Add Counter'}</span>
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {counters.length === 0 ? (
              <div className="text-center py-8">
                <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No counters yet</h3>
                <p className="text-muted-foreground">Add counters for takeout and pickup orders.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {counters.map(counter => {
                  const qrUrl = getQRUrl(counter.id, true, counter.counter_name);
                  return (
                    <div key={counter.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-medium text-foreground">{counter.counter_name || 'Counter'}</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteCounter(counter.id, counter.counter_name || 'Counter')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <QRCodeDisplay currentUrl={qrUrl} venueName={venueName} />
                      <div className="mt-3 flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(qrUrl)}
                          className="flex items-center space-x-1"
                        >
                          <Copy className="h-3 w-3" />
                          <span>Copy</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(qrUrl, '_blank')}
                          className="flex items-center space-x-1"
                        >
                          <Download className="h-3 w-3" />
                          <span>Test</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}