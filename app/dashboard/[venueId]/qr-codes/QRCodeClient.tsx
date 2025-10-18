"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { QrCode, Plus, Trash2, Copy, Download, Settings, Table, Printer, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Simple QR Code Canvas Component
function QRCodeCanvas({ url, size }: { url: string; size: number }) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const generateQR = async () => {
      try {
        const QRCode = await import('qrcode');
        const dataUrl = await QRCode.toDataURL(url, {
          width: size,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' }
        });
        setQrDataUrl(dataUrl);
      } catch (error) {
        console.error('Error generating QR code:', error);
      } finally {
        setLoading(false);
      }
    };

    generateQR();
  }, [url, size]);

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <img 
      src={qrDataUrl} 
      alt="QR Code" 
      className="border rounded-lg"
      style={{ width: size, height: size }}
    />
  );
}

export default function QRCodeClient({ venueId, venueName }: { venueId: string; venueName: string }) {
  const [tables, setTables] = useState<any[]>([]);
  const [counters, setCounters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatedQRs, setGeneratedQRs] = useState<Array<{name: string, url: string, type: 'table' | 'counter'}>>([]);
  const [qrCodeType, setQrCodeType] = useState<'tables' | 'counters'>('tables');
  const [inputName, setInputName] = useState('');
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

  // Auto-generate QR code if table parameter is present
  useEffect(() => {
    if (tables.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const tableName = urlParams.get('table');
      
      if (tableName) {
        console.log('[QR] Auto-generating QR for table from URL:', tableName);
        
        // Check if this QR already exists
        const existingQR = generatedQRs.find(qr => qr.name === tableName);
        if (!existingQR) {
          generateQRForName(tableName);
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

  const generateQRForName = (name: string) => {
    // Check for duplicates
    const existingQR = generatedQRs.find(qr => qr.name === name);
    if (existingQR) {
      toast({
        title: "Duplicate Name",
        description: `QR code for "${name}" already exists. Please choose a different name.`,
        variant: "destructive",
      });
      return;
    }

    // Generate QR URL
    const baseUrl = window.location.origin;
    const qrUrl = qrCodeType === 'tables' 
      ? `${baseUrl}/order?venue=${venueId}&table=${encodeURIComponent(name)}`
      : `${baseUrl}/order?venue=${venueId}&counter=${encodeURIComponent(name)}`;

    // Add to generated QRs
    setGeneratedQRs(prev => [...prev, {
      name,
      url: qrUrl,
      type: qrCodeType === 'tables' ? 'table' : 'counter'
    }]);
  };

  const handleInputSubmit = () => {
    if (!inputName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a name",
        variant: "destructive",
      });
      return;
    }

    generateQRForName(inputName.trim());
    setInputName(''); // Clear input after generating
  };

  const removeQR = (name: string) => {
    setGeneratedQRs(prev => prev.filter(qr => qr.name !== name));
  };

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Copied",
        description: "QR code URL copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy URL",
        variant: "destructive",
      });
    }
  };

  const downloadQRCode = async (url: string, name: string, type: 'table' | 'counter') => {
    try {
      const QRCode = await import('qrcode');
      const dataUrl = await QRCode.toDataURL(url, {
        width: qrCodeSize === 'small' ? 150 : qrCodeSize === 'large' ? 250 : 200,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      });
      
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${name.toLowerCase().replace(/\s+/g, '-')}-qr-code.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Downloaded",
        description: `QR code for ${name} downloaded`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download QR code",
        variant: "destructive",
      });
    }
  };

  const printQRCode = async (url: string, name: string, type: 'table' | 'counter') => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; text-align: center; }
            .qr-container { max-width: 400px; margin: 0 auto; }
            .qr-title { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
            .venue-name { font-size: 14px; color: #666; margin-bottom: 15px; }
            .qr-code { margin: 20px 0; }
            .instructions { font-size: 12px; margin-top: 15px; padding: 10px; background: #f5f5f5; border-radius: 5px; }
            @media print {
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
            QRCode.toCanvas(canvas, '${url}', {
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

  const printAllQRCodes = async () => {
    if (generatedQRs.length === 0) {
      toast({
        title: "No QR Codes",
        description: "Generate some QR codes first",
        variant: "destructive",
      });
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const qrSize = qrCodeSize === 'small' ? 150 : qrCodeSize === 'large' ? 250 : 200;
    
    // Create a grid layout for multiple QR codes
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>All QR Codes - ${venueName}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px; 
              padding: 20px;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #333;
              padding-bottom: 15px;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: bold;
            }
            .venue-name {
              margin-top: 5px;
              font-size: 16px;
              color: #666;
            }
            .qr-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 40px;
              margin-bottom: 30px;
            }
            .qr-item {
              text-align: center;
              page-break-inside: avoid;
              border: 1px solid #ddd;
              padding: 20px;
              border-radius: 8px;
            }
            .qr-label {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 15px;
              color: #333;
            }
            .qr-type {
              font-size: 12px;
              color: #666;
              margin-bottom: 10px;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .qr-code {
              margin: 15px 0;
              display: flex;
              justify-content: center;
            }
            .instructions {
              font-size: 11px;
              margin-top: 15px;
              padding: 10px;
              background: #f5f5f5;
              border-radius: 5px;
              text-align: left;
            }
            @media print {
              body { margin: 0; padding: 10px; }
              .qr-grid { gap: 20px; }
              .qr-item { border: 1px solid #000; }
            }
            @page {
              margin: 1cm;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>QR Codes</h1>
            ${venueName ? `<div class="venue-name">${venueName}</div>` : ''}
            <div style="font-size: 12px; color: #999; margin-top: 5px;">
              Generated: ${new Date().toLocaleDateString()}
            </div>
          </div>
          
          <div class="qr-grid">
            ${generatedQRs.map((qr, index) => `
              <div class="qr-item">
                <div class="qr-type">${qr.type}</div>
                <div class="qr-label">${qr.name}</div>
                <div class="qr-code">
                  <canvas id="qrcode-${index}"></canvas>
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
            `).join('')}
          </div>
          
          <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
          <script>
            const qrData = ${JSON.stringify(generatedQRs)};
            const size = ${qrSize};
            
            qrData.forEach((qr, index) => {
              const canvas = document.getElementById('qrcode-' + index);
              QRCode.toCanvas(canvas, qr.url, {
                width: size,
                margin: 2,
                color: {
                  dark: '#000000',
                  light: '#FFFFFF'
                }
              }, function (error) {
                if (error) console.error('Error generating QR code:', error);
              });
            });
            
            // Auto-print after all QR codes are generated
            setTimeout(() => {
              window.print();
              window.close();
            }, 2000);
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();

    toast({
      title: "Print Preview",
      description: `Print preview opened for all ${generatedQRs.length} QR codes`,
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

  return (
    <div className="space-y-8">
      {/* Stats Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tables Set Up</p>
                <p className="text-2xl font-bold">{tables.length}</p>
              </div>
              <Table className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">QR Codes Generated</p>
                <p className="text-2xl font-bold">{generatedQRs.length}</p>
              </div>
              <QrCode className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Counters Set Up</p>
                <p className="text-2xl font-bold">{counters.length}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Panel - QR Code Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5" />
              <span>QR Code Settings</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
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
                  <Users className="h-4 w-4 mr-2" />
                  Counters
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {qrCodeType === 'tables' 
                  ? 'Generate QR codes for table service (dine-in restaurants).'
                  : 'Generate QR codes for pickup service (food trucks, cafes).'
                }
              </p>
            </div>

            <div>
              <Label className="text-base font-medium">Generate QR Code</Label>
              <div className="flex space-x-2 mt-2">
                <Input
                  placeholder={`Enter ${qrCodeType === 'tables' ? 'table' : 'counter'} name or number`}
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleInputSubmit()}
                />
                <Button 
                  onClick={handleInputSubmit}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Plus className="h-4 w-4" />
                  Generate
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Type a name and click Generate to create a QR code instantly
              </p>
            </div>

            <div>
              <Label className="text-base font-medium">Venue</Label>
              <div className="mt-2 p-3 bg-muted rounded-lg">
                <p className="font-medium">{venueName}</p>
                <p className="text-sm text-muted-foreground">Venue ID: {venueId}</p>
              </div>
            </div>

            <div>
              <Label className="text-base font-medium">Print Settings</Label>
              <div className="space-y-4 mt-2">
                <div>
                  <Label htmlFor="qrSize" className="text-sm">QR Code Size</Label>
                  <Select value={qrCodeSize} onValueChange={setQrCodeSize}>
                    <SelectTrigger>
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
                <span>Generated QR Codes</span>
              </div>
              {generatedQRs.length > 0 && (
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      generatedQRs.forEach((qr, index) => {
                        setTimeout(() => {
                          downloadQRCode(qr.url, qr.name, qr.type);
                        }, index * 500);
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
                      const printWindow = window.open('', '_blank');
                      if (!printWindow) return;

                      const qrCodesHtml = generatedQRs.map(qr => `
                        <div class="qr-item" style="margin-bottom: 30px; page-break-inside: avoid;">
                          <div class="qr-title">${qr.type === 'table' ? 'Table' : 'Counter'}: ${qr.name}</div>
                          ${venueName ? `<div class="venue-name">${venueName}</div>` : ''}
                          <div class="qr-code">
                            <canvas id="qrcode-${qr.name.replace(/\s+/g, '-')}"></canvas>
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
                      `).join('');

                      const printContent = `
                        <!DOCTYPE html>
                        <html>
                          <head>
                            <title>QR Codes - ${venueName}</title>
                            <style>
                              body { font-family: Arial, sans-serif; margin: 20px; }
                              .qr-item { text-align: center; margin-bottom: 30px; page-break-inside: avoid; }
                              .qr-title { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
                              .venue-name { font-size: 14px; color: #666; margin-bottom: 15px; }
                              .qr-code { margin: 20px 0; }
                              .instructions { font-size: 12px; margin-top: 15px; padding: 10px; background: #f5f5f5; border-radius: 5px; }
                              @media print {
                                .qr-container { margin: 0; }
                              }
                            </style>
                          </head>
                          <body>
                            ${qrCodesHtml}
                            
                            <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
                            <script>
                              ${generatedQRs.map(qr => `
                                const canvas${qr.name.replace(/\s+/g, '')} = document.getElementById('qrcode-${qr.name.replace(/\s+/g, '-')}');
                                const size = ${qrCodeSize === 'small' ? 150 : qrCodeSize === 'large' ? 250 : 200};
                                QRCode.toCanvas(canvas${qr.name.replace(/\s+/g, '')}, '${qr.url}', {
                                  width: size,
                                  margin: 2,
                                  color: { dark: '#000000', light: '#FFFFFF' }
                                });
                              `).join('')}
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
                        description: `Print preview opened for ${generatedQRs.length} QR codes`,
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
            {generatedQRs.length === 0 ? (
              <div className="text-center py-12">
                <QrCode className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No QR Codes Generated</h3>
                <p className="text-muted-foreground mb-4">
                  Enter a name and click Generate to create your first QR code
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {generatedQRs.map((qr, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex justify-end mb-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeQR(qr.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="text-center mb-3">
                      <h3 className="font-medium text-lg">{qr.name}</h3>
                    </div>
                    <div style={{ 
                      transform: qrCodeSize === 'small' ? 'scale(0.67)' : qrCodeSize === 'large' ? 'scale(1.33)' : 'scale(1)',
                      transformOrigin: 'center'
                    }}>
                      <div className="flex justify-center">
                        <QRCodeCanvas url={qr.url} size={qrCodeSize === 'small' ? 150 : qrCodeSize === 'large' ? 250 : 200} />
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(qr.url)}
                      >
                        <Copy className="h-3 w-3 mr-2" />
                        Copy URL
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadQRCode(qr.url, qr.name, qr.type)}
                      >
                        <Download className="h-3 w-3 mr-2" />
                        Download
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="col-span-2"
                        onClick={() => printAllQRCodes()}
                      >
                        <Printer className="h-3 w-3 mr-2" />
                        Print All QR Codes
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* How to Use QR Codes */}
      <Card>
        <CardHeader>
          <CardTitle>How to Use QR Codes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <QrCode className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Generate QR Codes</h3>
              <p className="text-sm text-muted-foreground">
                Create QR codes for tables (dine-in) or counters (pickup/food trucks) in your venue.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Printer className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Print and Display</h3>
              <p className="text-sm text-muted-foreground">
                Print the QR codes and place them on tables or at counter locations.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Customers Order</h3>
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