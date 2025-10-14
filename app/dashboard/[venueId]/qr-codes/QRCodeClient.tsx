"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { QrCode, Plus, Trash2, Copy, Download, Settings, Table, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import QRCodeDisplay from "@/components/qr-code-display";

export default function QRCodeClient({ venueId, venueName }: { venueId: string; venueName: string }) {
  const [tables, setTables] = useState<any[]>([]);
  const [counters, setCounters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTables, setSelectedTables] = useState<number[]>([]);
  const [selectedCounters, setSelectedCounters] = useState<string[]>([]);
  const [qrCodeType, setQrCodeType] = useState<'tables' | 'counters'>('tables');
  const [newTableNumber, setNewTableNumber] = useState('');
  const [newCounterName, setNewCounterName] = useState('');
  const [isAddingTable, setIsAddingTable] = useState(false);
  const [isAddingCounter, setIsAddingCounter] = useState(false);
  const [qrCodeSize, setQrCodeSize] = useState('medium');
  const [includeInstructions, setIncludeInstructions] = useState(true);
  const [includeVenueInfo, setIncludeVenueInfo] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (venueId) {
      loadTablesAndCounters();
    }
  }, [venueId]);

  const loadTablesAndCounters = async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      
      // Load tables
      const { data: tablesData, error: tablesError } = await supabase
        .from('tables')
        .select('*')
        .eq('venue_id', venueId)
        .eq('is_counter', false)
        .order('table_number', { ascending: true });

      if (tablesError) {
        console.error('Error loading tables:', tablesError);
      } else {
        setTables(tablesData || []);
      }

      // Load counters
      const { data: countersData, error: countersError } = await supabase
        .from('counters')
        .select('*')
        .eq('venue_id', venueId)
        .order('name', { ascending: true });

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
    if (!newTableNumber.trim() || isNaN(parseInt(newTableNumber))) {
      toast({
        title: "Error",
        description: "Please enter a valid table number",
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
          label: newTableNumber,
          is_counter: false,
          is_active: true
        });

      if (error) {
        throw error;
      }

      toast({
        title: "Table added",
        description: `Table ${newTableNumber} has been added successfully.`,
      });

      setNewTableNumber('');
      await loadTablesAndCounters();
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
        .from('counters')
        .insert({
          venue_id: venueId,
          name: newCounterName.trim()
        });

      if (error) {
        throw error;
      }

      toast({
        title: "Counter added",
        description: `${newCounterName} counter has been added successfully.`,
      });

      setNewCounterName('');
      await loadTablesAndCounters();
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

      await loadTablesAndCounters();
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

      await loadTablesAndCounters();
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
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading QR codes...</p>
        </div>
      </div>
    );
  }

  const toggleTableSelection = (tableNumber: number) => {
    setSelectedTables(prev => 
      prev.includes(tableNumber) 
        ? prev.filter(t => t !== tableNumber)
        : [...prev, tableNumber]
    );
  };

  const toggleCounterSelection = (counterName: string) => {
    setSelectedCounters(prev => 
      prev.includes(counterName) 
        ? prev.filter(c => c !== counterName)
        : [...prev, counterName]
    );
  };

  return (
    <div className="space-y-8">
      {/* Stats Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{tables.length}</div>
              <div className="text-sm text-muted-foreground">Tables Set Up</div>
              <div className="text-xs text-muted-foreground mt-1">Tables configured in your venue</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{selectedTables.length + selectedCounters.length}</div>
              <div className="text-sm text-muted-foreground">QR Codes Generated</div>
              <div className="text-xs text-muted-foreground mt-1">Ready for printing</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{counters.length}</div>
              <div className="text-sm text-muted-foreground">Counters Set Up</div>
              <div className="text-xs text-muted-foreground mt-1">For pickup orders</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Panel - QR Code Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <QrCode className="h-5 w-5" />
              <span>QR Code Settings</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* QR Code Type */}
            <div>
              <Label className="text-base font-medium">QR Code Type</Label>
              <div className="flex space-x-2 mt-2">
                <Button
                  variant={qrCodeType === 'tables' ? 'default' : 'outline'}
                  onClick={() => setQrCodeType('tables')}
                  className="flex-1"
                >
                  <Table className="h-4 w-4 mr-2" />
                  Tables
                </Button>
                <Button
                  variant={qrCodeType === 'counters' ? 'default' : 'outline'}
                  onClick={() => setQrCodeType('counters')}
                  className="flex-1"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Counters
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {qrCodeType === 'tables' 
                  ? 'Generate QR codes for table service (dine-in restaurants).'
                  : 'Generate QR codes for counter service (pickup/food trucks).'
                }
              </p>
            </div>

            {/* Table/Counter Selection */}
            <div>
              <Label className="text-base font-medium">
                {qrCodeType === 'tables' ? 'Table Numbers' : 'Counter Names'}
              </Label>
              
              {qrCodeType === 'tables' ? (
                <div className="mt-3 space-y-3">
                  {tables.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      <p>No tables selected - click the buttons below to add tables for QR code generation.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2">
                      {tables.map(table => (
                        <Button
                          key={table.id}
                          variant={selectedTables.includes(table.table_number) ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleTableSelection(table.table_number)}
                          className="aspect-square"
                        >
                          {table.table_number}
                        </Button>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex space-x-2">
                    <Input
                      type="number"
                      placeholder="Table number"
                      value={newTableNumber}
                      onChange={(e) => setNewTableNumber(e.target.value)}
                      className="flex-1"
                    />
                    <Button onClick={addTable} disabled={isAddingTable}>
                      <Plus className="h-4 w-4 mr-2" />
                      {isAddingTable ? 'Adding...' : 'Add Table'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  {counters.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      <p>No counters selected - click the buttons below to add counters for QR code generation.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {counters.map(counter => (
                        <Button
                          key={counter.id}
                          variant={selectedCounters.includes(counter.name) ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleCounterSelection(counter.name)}
                          className="w-full justify-start"
                        >
                          {counter.name}
                        </Button>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex space-x-2">
                    <Input
                      placeholder="Counter name"
                      value={newCounterName}
                      onChange={(e) => setNewCounterName(e.target.value)}
                      className="flex-1"
                    />
                    <Button onClick={addCounter} disabled={isAddingCounter}>
                      <Plus className="h-4 w-4 mr-2" />
                      {isAddingCounter ? 'Adding...' : 'Add Counter'}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Venue Info */}
            <div>
              <Label className="text-base font-medium">Venue</Label>
              <div className="mt-2 p-3 bg-muted rounded-lg">
                <div className="font-medium">{venueName}</div>
                <div className="text-sm text-muted-foreground">Venue ID: {venueId}</div>
              </div>
            </div>

            {/* Print Settings */}
            <div>
              <Label className="text-base font-medium">Print Settings</Label>
              <div className="mt-3 space-y-4">
                <div>
                  <Label className="text-sm">QR Code Size:</Label>
                  <Select value={qrCodeSize} onValueChange={setQrCodeSize}>
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small (100px)</SelectItem>
                      <SelectItem value="medium">Medium (150px)</SelectItem>
                      <SelectItem value="large">Large (200px)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="includeInstructions"
                      checked={includeInstructions}
                      onChange={(e) => setIncludeInstructions(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="includeInstructions" className="text-sm">Include Instructions</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="includeVenueInfo"
                      checked={includeVenueInfo}
                      onChange={(e) => setIncludeVenueInfo(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="includeVenueInfo" className="text-sm">Include Venue Info</Label>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Panel - QR Code Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Printer className="h-5 w-5" />
              <span>Preview and download your QR codes</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(selectedTables.length === 0 && selectedCounters.length === 0) ? (
              <div className="text-center py-12">
                <QrCode className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No QR Codes Generated</h3>
                <p className="text-muted-foreground mb-4">
                  {qrCodeType === 'tables' 
                    ? 'Select tables to generate QR codes for table service.'
                    : 'Select counters to generate QR codes for pickup service.'
                  }
                </p>
                <div className="flex space-x-2 justify-center">
                  {qrCodeType === 'tables' ? (
                    <>
                      <Button onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'number';
                        input.placeholder = 'Table number';
                        // Add table logic here
                      }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add a Table
                      </Button>
                      <Button variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Multiple Tables
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'text';
                        input.placeholder = 'Counter name';
                        // Add counter logic here
                      }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add a Counter
                      </Button>
                      <Button variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Multiple Counters
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Show selected tables */}
                {selectedTables.map(tableNumber => {
                  const table = tables.find(t => t.table_number === tableNumber);
                  if (!table) return null;
                  
                  const qrUrl = getQRUrl(table.id);
                  return (
                    <div key={table.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium">Table {tableNumber}</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteTable(table.id, tableNumber)}
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
                          className="flex-1"
                        >
                          <Copy className="h-3 w-3 mr-2" />
                          Copy Link
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(qrUrl, '_blank')}
                          className="flex-1"
                        >
                          <Download className="h-3 w-3 mr-2" />
                          Test
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {/* Show selected counters */}
                {selectedCounters.map(counterName => {
                  const counter = counters.find(c => c.name === counterName);
                  if (!counter) return null;
                  
                  const qrUrl = getQRUrl(counter.id, true, counterName);
                  return (
                    <div key={counter.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium">{counterName}</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteCounter(counter.id, counterName)}
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
                          className="flex-1"
                        >
                          <Copy className="h-3 w-3 mr-2" />
                          Copy Link
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(qrUrl, '_blank')}
                          className="flex-1"
                        >
                          <Download className="h-3 w-3 mr-2" />
                          Test
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

      {/* How to Use Section */}
      <Card>
        <CardHeader>
          <CardTitle>How to Use QR Codes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="bg-primary/10 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                <QrCode className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-medium mb-2">1. Generate QR Codes</h3>
              <p className="text-sm text-muted-foreground">
                Create QR codes for tables (dine-in) or counters (pickup/food trucks) in your venue.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-primary/10 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                <Printer className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-medium mb-2">2. Print and Display</h3>
              <p className="text-sm text-muted-foreground">
                Print the QR codes and place them on tables or at counter locations.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-primary/10 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                <Table className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-medium mb-2">3. Customers Order</h3>
              <p className="text-sm text-muted-foreground">
                Customers scan the QR code to view your menu and place orders for pickup or delivery.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
