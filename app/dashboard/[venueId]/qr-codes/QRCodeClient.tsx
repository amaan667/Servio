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
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
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

  // Auto-select and generate QR code if table parameter is present
  useEffect(() => {
    if (tables.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const tableName = urlParams.get('table');
      
      if (tableName && selectedTables.length === 0) {
        console.log('[OLD QR] Auto-selecting table from URL:', tableName);
        
        // Find table by label
        const table = tables.find(t => t.label === tableName);
        if (table) {
          setSelectedTables([table.id]);
          console.log('[OLD QR] Table found and selected:', table);
          // Auto-generate QR code immediately when table is found from URL
          // The QR code will be displayed automatically in the preview section
        } else {
          // IMPORTANT: Do NOT call addTable here. If the table doesn't exist,
          // we should not create it automatically.
          console.log('[OLD QR] Table not found for auto-selection:', tableName);
          // Optionally, you could show a toast here indicating the table wasn't found.
        }
      }
    }
  }, [tables]);

  const loadTablesAndCounters = async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      
      // Load tables
      const { data: tablesData, error: tablesError } = await supabase
        .from('tables')
        .select('*')
        .eq('venue_id', venueId)
        .eq('is_active', true)
        .order('label', { ascending: true });

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
        .order('label', { ascending: true });

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

  const addTable = async (tableNumber?: string) => {
    const numToAdd = tableNumber || newTableNumber;
    if (!numToAdd.trim()) {
      toast({
        title: "Error",
        description: "Please enter a table name or number",
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
          label: numToAdd,
          seat_count: 4,
          area: null,
          is_active: true
        });

      if (error) {
        throw error;
      }

      toast({
        title: "Table added",
        description: `Table ${numToAdd} has been added successfully.`,
      });

      setNewTableNumber('');
      await loadTablesAndCounters();
      
      // Auto-select the newly added table (will be selected after reload)
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

  const addCounter = async (counterName?: string) => {
    const nameToAdd = counterName || newCounterName;
    if (!nameToAdd.trim()) {
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
          name: nameToAdd.trim()
        });

      if (error) {
        throw error;
      }

      toast({
        title: "Counter added",
        description: `${nameToAdd} counter has been added successfully.`,
      });

      setNewCounterName('');
      await loadTablesAndCounters();
      
      // Auto-select the newly added counter
      setSelectedCounters(prev => [...prev, nameToAdd.trim()]);
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
    if (isCounter) {
      return `${baseUrl}/order?venue=${venueId}&counter=${encodeURIComponent(counterName || 'counter')}`;
    } else {
      // For tables, we need to find the table number from the tableId
      const table = tables.find(t => t.id === tableId);
      return `${baseUrl}/order?venue=${venueId}&table=${table?.table_number || tableId}`;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "QR code URL copied to clipboard",
    });
  };

  const downloadQRCode = (qrUrl: string, name: string, type: 'table' | 'counter') => {
    // Create a canvas to generate the QR code as an image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size based on selected size
    const baseSize = 300;
    const size = qrCodeSize === 'small' ? 200 : qrCodeSize === 'large' ? 400 : baseSize;
    canvas.width = size;
    canvas.height = size;

    // Create a temporary QR code element to get the image
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.width = `${size}px`;
    tempDiv.style.height = `${size}px`;
    document.body.appendChild(tempDiv);

    // Generate QR code using the existing component logic
    import('qrcode').then((QRCode) => {
      QRCode.toCanvas(canvas, qrUrl, {
        width: size,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      }).then(() => {
        // Add venue info if enabled
        if (includeVenueInfo) {
          const textCanvas = document.createElement('canvas');
          const textCtx = textCanvas.getContext('2d');
          if (textCtx) {
            textCanvas.width = size;
            textCanvas.height = size + 60; // Extra space for text
            
            // Fill background
            textCtx.fillStyle = '#FFFFFF';
            textCtx.fillRect(0, 0, textCanvas.width, textCanvas.height);
            
            // Draw QR code
            textCtx.drawImage(canvas, 0, 0);
            
            // Add text
            textCtx.fillStyle = '#000000';
            textCtx.font = 'bold 16px Arial';
            textCtx.textAlign = 'center';
            textCtx.fillText(`${type === 'table' ? 'Table' : 'Counter'}: ${name}`, size/2, size + 25);
            
            if (venueName) {
              textCtx.font = '14px Arial';
              textCtx.fillText(venueName, size/2, size + 45);
            }
            
            // Download the image
            const link = document.createElement('a');
            link.download = `qr-${type}-${name}-${venueName || 'venue'}.png`;
            link.href = textCanvas.toDataURL();
            link.click();
          }
        } else {
          // Download just the QR code
          const link = document.createElement('a');
          link.download = `qr-${type}-${name}.png`;
          link.href = canvas.toDataURL();
          link.click();
        }
        
        document.body.removeChild(tempDiv);
        toast({
          title: "Downloaded",
          description: `QR code for ${type} ${name} downloaded successfully`,
        });
      }).catch((error: any) => {
        console.error('Error generating QR code:', error);
        document.body.removeChild(tempDiv);
        toast({
          title: "Error",
          description: "Failed to generate QR code for download",
          variant: "destructive",
        });
      });
    });
  };

  const printQRCode = (qrUrl: string, name: string, type: 'table' | 'counter') => {
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${type === 'table' ? 'Table' : 'Counter'} ${name}</title>
          <style>
            body {
              margin: 0;
              padding: 20px;
              font-family: Arial, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
            }
            .qr-container {
              text-align: center;
              page-break-inside: avoid;
            }
            .qr-code {
              margin: 20px 0;
            }
            .qr-title {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 10px;
            }
            .qr-subtitle {
              font-size: 18px;
              margin-bottom: 5px;
            }
            .venue-name {
              font-size: 16px;
              color: #666;
              margin-top: 10px;
            }
            .instructions {
              margin-top: 30px;
              font-size: 14px;
              color: #666;
              max-width: 300px;
              text-align: center;
            }
            @media print {
              body { margin: 0; padding: 10px; }
              .qr-container { margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <div class="qr-title">${type === 'table' ? 'Table' : 'Counter'}: ${name}</div>
            ${venueName ? `<div class="venue-name">${venueName}</div>` : ''}
            <div class="qr-code">
              <canvas id="qrcode"></canvas>
            </div>
            ${includeInstructions ? `
              <div class="instructions">
                <strong>How to use:</strong><br>
                1. Scan this QR code with your phone<br>
                2. View the menu and place your order<br>
                3. Your order will be prepared fresh!
              </div>
            ` : ''}
          </div>
          
          <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
          <script>
            const canvas = document.getElementById('qrcode');
            const size = ${qrCodeSize === 'small' ? 200 : qrCodeSize === 'large' ? 400 : 300};
            QRCode.toCanvas(canvas, '${qrUrl}', {
              width: size,
              margin: 2,
              color: {
                dark: '#000000',
                light: '#FFFFFF'
              }
            }, function (error) {
              if (error) console.error(error);
            });
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Wait for QR code to load, then print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 1000);
    };

    toast({
      title: "Print Preview",
      description: `Print preview opened for ${type} ${name}`,
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

  const toggleTableSelection = (tableId: string) => {
    setSelectedTables(prev => 
      prev.includes(tableId) 
        ? prev.filter(t => t !== tableId)
        : [...prev, tableId]
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
                          variant={selectedTables.includes(table.id) ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleTableSelection(table.id)}
                          className="aspect-square"
                        >
                          {table.label}
                        </Button>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex space-x-2">
                    <Input
                      placeholder="Table name or number"
                      value={newTableNumber}
                      onChange={(e) => setNewTableNumber(e.target.value)}
                      className="flex-1"
                    />
                    <Button onClick={() => addTable()} disabled={isAddingTable}>
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
                          variant={selectedCounters.includes(counter.label) ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleCounterSelection(counter.label)}
                          className="w-full justify-start"
                        >
                          {counter.label}
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
                    <Button onClick={() => addCounter()} disabled={isAddingCounter}>
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
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Printer className="h-5 w-5" />
                <span>Preview and download your QR codes</span>
              </div>
              {(selectedTables.length > 0 || selectedCounters.length > 0) && (
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Download all selected QR codes
                      const allSelected = [
                        ...selectedTables.map(id => ({ type: 'table' as const, id, name: tables.find(t => t.id === id)?.label || id })),
                        ...selectedCounters.map(label => ({ type: 'counter' as const, id: counters.find(c => c.label === label)?.id || label, name: label }))
                      ];
                      
                      allSelected.forEach((item, index) => {
                        const qrUrl = item.type === 'table' 
                          ? getQRUrl(item.id, false)
                          : getQRUrl(counters.find(c => c.label === item.name)?.id || '', true, item.name);
                        
                        setTimeout(() => {
                          downloadQRCode(qrUrl, item.name, item.type);
                        }, index * 500); // Stagger downloads
                      });
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download All
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      // Print all selected QR codes
                      const allSelected = [
                        ...selectedTables.map(id => ({ type: 'table' as const, id, name: tables.find(t => t.id === id)?.label || id })),
                        ...selectedCounters.map(label => ({ type: 'counter' as const, id: counters.find(c => c.label === label)?.id || label, name: label }))
                      ];
                      
                      // Create a print window with all QR codes
                      const printWindow = window.open('', '_blank');
                      if (!printWindow) return;

                      const qrCodesHtml = allSelected.map(item => {
                        const qrUrl = item.type === 'table' 
                          ? getQRUrl(item.id, false)
                          : getQRUrl(counters.find(c => c.label === item.name)?.id || '', true, item.name);
                        
                        return `
                          <div class="qr-item" style="margin-bottom: 30px; page-break-inside: avoid;">
                            <div class="qr-title">${item.type === 'table' ? 'Table' : 'Counter'}: ${item.name}</div>
                            ${venueName ? `<div class="venue-name">${venueName}</div>` : ''}
                            <div class="qr-code">
                              <canvas id="qrcode-${item.type}-${item.name.replace(/\s+/g, '-')}"></canvas>
                            </div>
                            ${includeInstructions ? `
                              <div class="instructions">
                                <strong>How to use:</strong><br>
                                1. Scan this QR code with your phone<br>
                                2. View the menu and place your order<br>
                                3. Your order will be prepared fresh!
                              </div>
                            ` : ''}
                          </div>
                        `;
                      }).join('');

                      const printContent = `
                        <!DOCTYPE html>
                        <html>
                          <head>
                            <title>QR Codes - ${venueName}</title>
                            <style>
                              body {
                                margin: 0;
                                padding: 20px;
                                font-family: Arial, sans-serif;
                              }
                              .qr-container {
                                display: grid;
                                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                                gap: 20px;
                              }
                              .qr-item {
                                text-align: center;
                                border: 1px solid #ddd;
                                padding: 20px;
                                border-radius: 8px;
                              }
                              .qr-title {
                                font-size: 20px;
                                font-weight: bold;
                                margin-bottom: 10px;
                              }
                              .venue-name {
                                font-size: 14px;
                                color: #666;
                                margin-bottom: 15px;
                              }
                              .qr-code {
                                margin: 15px 0;
                              }
                              .instructions {
                                margin-top: 15px;
                                font-size: 12px;
                                color: #666;
                                max-width: 250px;
                                margin-left: auto;
                                margin-right: auto;
                              }
                              @media print {
                                body { margin: 0; padding: 10px; }
                                .qr-container { gap: 10px; }
                                .qr-item { page-break-inside: avoid; }
                              }
                            </style>
                          </head>
                          <body>
                            <h1 style="text-align: center; margin-bottom: 30px;">QR Codes - ${venueName}</h1>
                            <div class="qr-container">
                              ${qrCodesHtml}
                            </div>
                            
                            <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
                            <script>
                              ${allSelected.map(item => {
                                const qrUrl = item.type === 'table' 
                                  ? getQRUrl(item.id, false)
                                  : getQRUrl(counters.find(c => c.label === item.name)?.id || '', true, item.name);
                                
                                return `
                                  const canvas${item.type}${item.name.replace(/\s+/g, '')} = document.getElementById('qrcode-${item.type}-${item.name.replace(/\s+/g, '-')}');
                                  const size = ${qrCodeSize === 'small' ? 150 : qrCodeSize === 'large' ? 250 : 200};
                                  QRCode.toCanvas(canvas${item.type}${item.name.replace(/\s+/g, '')}, '${qrUrl}', {
                                    width: size,
                                    margin: 2,
                                    color: { dark: '#000000', light: '#FFFFFF' }
                                  });
                                `;
                              }).join('')}
                            </script>
                          </body>
                        </html>
                      `;

                      printWindow.document.write(printContent);
                      printWindow.document.close();
                      
                      printWindow.onload = () => {
                        setTimeout(() => {
                          printWindow.print();
                          printWindow.close();
                        }, 2000);
                      };

                      toast({
                        title: "Print Preview",
                        description: `Print preview opened for ${allSelected.length} QR codes`,
                      });
                    }}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Print All
                  </Button>
                </div>
              )}
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
                        const tableName = prompt('Enter table name or number:');
                        if (tableName && tableName.trim()) {
                          addTable(tableName);
                        }
                      }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add a Table
                      </Button>
                      <Button variant="outline" onClick={() => {
                        const startNum = prompt('Enter starting table number:');
                        const endNum = prompt('Enter ending table number:');
                        if (startNum && endNum && !isNaN(parseInt(startNum)) && !isNaN(parseInt(endNum))) {
                          const start = parseInt(startNum);
                          const end = parseInt(endNum);
                          if (start <= end) {
                            for (let i = start; i <= end; i++) {
                              setTimeout(() => addTable(i.toString()), (i - start) * 500); // Stagger the requests
                            }
                          }
                        }
                      }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Multiple Tables
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button onClick={() => {
                        const counterName = prompt('Enter counter name:');
                        if (counterName && counterName.trim()) {
                          addCounter(counterName.trim());
                        }
                      }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add a Counter
                      </Button>
                      <Button variant="outline" onClick={() => {
                        const counterNames = prompt('Enter counter names separated by commas:');
                        if (counterNames && counterNames.trim()) {
                          const names = counterNames.split(',').map(name => name.trim()).filter(name => name);
                          names.forEach((name, index) => {
                            setTimeout(() => addCounter(name), index * 500); // Stagger the requests
                          });
                        }
                      }}>
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
                {selectedTables.map(tableId => {
                  const table = tables.find(t => t.id === tableId);
                  if (!table) return null;
                  
                  const qrUrl = getQRUrl(table.id);
                  return (
                    <div key={table.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium">{table.label}</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteTable(table.id, table.label)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div style={{ 
                        transform: qrCodeSize === 'small' ? 'scale(0.67)' : qrCodeSize === 'large' ? 'scale(1.33)' : 'scale(1)',
                        transformOrigin: 'center'
                      }}>
                        <QRCodeDisplay currentUrl={qrUrl} venueName={venueName} />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(qrUrl)}
                        >
                          <Copy className="h-3 w-3 mr-2" />
                          Copy
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadQRCode(qrUrl, table.label, 'table')}
                        >
                          <Download className="h-3 w-3 mr-2" />
                          Download
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => printQRCode(qrUrl, table.label, 'table')}
                        >
                          <Printer className="h-3 w-3 mr-2" />
                          Print
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {/* Show selected counters */}
                {selectedCounters.map(counterName => {
                  const counter = counters.find(c => c.label === counterName);
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
                      <div style={{ 
                        transform: qrCodeSize === 'small' ? 'scale(0.67)' : qrCodeSize === 'large' ? 'scale(1.33)' : 'scale(1)',
                        transformOrigin: 'center'
                      }}>
                        <QRCodeDisplay currentUrl={qrUrl} venueName={venueName} />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(qrUrl)}
                        >
                          <Copy className="h-3 w-3 mr-2" />
                          Copy
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadQRCode(qrUrl, counterName, 'counter')}
                        >
                          <Download className="h-3 w-3 mr-2" />
                          Download
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => printQRCode(qrUrl, counterName, 'counter')}
                        >
                          <Printer className="h-3 w-3 mr-2" />
                          Print
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
