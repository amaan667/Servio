"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { QrCode, ArrowLeft, Download, Printer, Plus, Users, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { buildOrderUrl } from "@/lib/qr-urls";
import { siteOrigin } from "@/lib/site";
import { toast } from "sonner";

interface Table {
  id: string;
  venue_id: string;
  label: string;
  seat_count: number;
  area: string | null;
  is_active: boolean;
  qr_version: number;
  created_at: string;
  updated_at: string;
}

interface GeneratedQR {
  tableId: string;
  tableLabel: string;
  qrUrl: string;
  orderUrl: string;
  qrDataUrl: string;
}

interface Props {
  venueId: string;
  venueName: string;
}

export default function GenerateQRClient({ venueId, venueName }: Props) {
  const [loading, setLoading] = useState(true);
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [generatedQRs, setGeneratedQRs] = useState<GeneratedQR[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    loadTables();
  }, [venueId]);

  // Auto-select and generate QR code if table parameter is present
  useEffect(() => {
    if (tables.length > 0 && generatedQRs.length === 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const tableId = urlParams.get('table');
      
      if (tableId && selectedTables.length === 0) {
        console.log('[QR GEN] Auto-selecting table from URL:', tableId);
        const table = tables.find(t => t.id === tableId);
        if (table) {
          setSelectedTables([tableId]);
        }
      }
    }
  }, [tables]);

  // Auto-generate when tables are selected from URL parameter
  useEffect(() => {
    if (selectedTables.length > 0 && generatedQRs.length === 0 && !generating) {
      const urlParams = new URLSearchParams(window.location.search);
      const tableId = urlParams.get('table');
      
      if (tableId && selectedTables.includes(tableId)) {
        console.log('[QR GEN] Auto-generating QR code for table from URL');
        generateQRCodes();
      }
    }
  }, [selectedTables]);

  const loadTables = async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      
      const { data: tablesData, error: tablesError } = await supabase
        .from('tables')
        .select('*')
        .eq('venue_id', venueId)
        .eq('is_active', true)
        .order('label');

      if (tablesError) {
        console.error('[QR CLIENT] Tables query error:', tablesError);
        setError('Failed to load tables');
        return;
      }

      setTables(tablesData || []);
    } catch (err) {
      console.error('[QR CLIENT] Unexpected error:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const toggleTableSelection = (tableId: string) => {
    setSelectedTables(prev => 
      prev.includes(tableId) 
        ? prev.filter(id => id !== tableId)
        : [...prev, tableId]
    );
  };

  const selectAllTables = () => {
    setSelectedTables(tables.map(table => table.id));
  };

  const clearSelection = () => {
    setSelectedTables([]);
  };

  const generateQRCode = async (orderUrl: string): Promise<string> => {
    console.log('[QR GEN] Generating QR code for URL:', orderUrl);
    return new Promise((resolve, reject) => {
      import('qrcode').then((QRCode) => {
        QRCode.toDataURL(orderUrl, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        }, (err: any, url: string) => {
          if (err) {
            console.error('[QR GEN] Error generating QR code:', err);
            reject(err);
          } else {
            console.log('[QR GEN] QR code generated successfully');
            resolve(url);
          }
        });
      }).catch((err) => {
        console.error('[QR GEN] Error importing qrcode library:', err);
        reject(err);
      });
    });
  };

  const generateQRCodes = async () => {
    if (selectedTables.length === 0) {
      toast.error("Please select at least one table");
      return;
    }

    setGenerating(true);
    const newGeneratedQRs: GeneratedQR[] = [];

    try {
      const baseUrl = siteOrigin();
      console.log('[QR GEN] Using base URL:', baseUrl);
      console.log('[QR GEN] Generating QR codes for tables:', selectedTables.length);

      for (const tableId of selectedTables) {
        const table = tables.find(t => t.id === tableId);
        if (!table) {
          console.warn('[QR GEN] Table not found:', tableId);
          continue;
        }

        // Build the order URL for this table
        const orderUrl = `${baseUrl}/order?venue=${venueId}&table=${encodeURIComponent(table.label)}&source=qr_table`;
        console.log('[QR GEN] Order URL for table', table.label, ':', orderUrl);
        
        // Generate QR code data URL using qrcode library
        const qrDataUrl = await generateQRCode(orderUrl);
        
        // Use the generated data URL for display (more reliable than external API)
        newGeneratedQRs.push({
          tableId: table.id,
          tableLabel: table.label,
          qrUrl: qrDataUrl, // Use the generated data URL directly
          orderUrl,
          qrDataUrl
        });
      }

      console.log('[QR GEN] Successfully generated', newGeneratedQRs.length, 'QR codes');
      setGeneratedQRs(newGeneratedQRs);
      toast.success(`Generated ${newGeneratedQRs.length} QR codes successfully!`);
    } catch (error) {
      console.error('[QR GEN] Error generating QR codes:', error);
      toast.error("Failed to generate QR codes. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const downloadQRCode = (qr: GeneratedQR) => {
    const link = document.createElement('a');
    link.href = qr.qrDataUrl;
    link.download = `${venueName.toLowerCase().replace(/\s+/g, '-')}-${qr.tableLabel.toLowerCase().replace(/\s+/g, '-')}-qr-code.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Downloaded QR code for ${qr.tableLabel}`);
  };

  const downloadAllQRCodes = () => {
    generatedQRs.forEach((qr, index) => {
      setTimeout(() => {
        downloadQRCode(qr);
      }, index * 500); // Stagger downloads
    });
    toast.success(`Downloading ${generatedQRs.length} QR codes...`);
  };

  const printAllQRCodes = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Unable to open print window. Please check your browser settings.');
      return;
    }

    const allQRContent = generatedQRs.map(qr => `
      <div class="qr-container">
        <div class="qr-title">Table: ${qr.tableLabel}</div>
        <div class="venue-name">${venueName}</div>
        <div class="qr-code">
          <img src="${qr.qrDataUrl}" alt="QR Code for ${qr.tableLabel}" style="width: 300px; height: 300px;" />
        </div>
        <div class="instructions">
          <strong>How to use:</strong><br>
          1. Scan this QR code with your phone<br>
          2. View the menu and place your order<br>
          3. Your order will be prepared fresh!
        </div>
        <div class="order-url">${qr.orderUrl}</div>
      </div>
    `).join('');

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
              text-align: center;
              page-break-inside: avoid;
              page-break-after: always;
              margin-bottom: 40px;
            }
            .qr-container:last-child {
              page-break-after: auto;
            }
            .qr-code {
              margin: 20px 0;
            }
            .qr-title {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 10px;
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
              margin-left: auto;
              margin-right: auto;
            }
            .order-url {
              margin-top: 20px;
              font-size: 10px;
              color: #999;
              word-break: break-all;
            }
            @media print {
              body { margin: 0; padding: 10px; }
              .qr-container { 
                margin: 0;
                padding: 20px 0;
              }
            }
          </style>
        </head>
        <body>
          ${allQRContent}
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

    toast.success(`Print preview opened for ${generatedQRs.length} QR codes`);
  };

  const printQRCode = (qr: GeneratedQR) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Unable to open print window. Please check your browser settings.');
      return;
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${qr.tableLabel}</title>
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
            .order-url {
              margin-top: 20px;
              font-size: 10px;
              color: #999;
              word-break: break-all;
            }
            @media print {
              body { margin: 0; padding: 10px; }
              .qr-container { margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <div class="qr-title">Table: ${qr.tableLabel}</div>
            <div class="venue-name">${venueName}</div>
            <div class="qr-code">
              <img src="${qr.qrDataUrl}" alt="QR Code for ${qr.tableLabel}" style="width: 300px; height: 300px;" />
            </div>
            <div class="instructions">
              <strong>How to use:</strong><br>
              1. Scan this QR code with your phone<br>
              2. View the menu and place your order<br>
              3. Your order will be prepared fresh!
            </div>
            <div class="order-url">${qr.orderUrl}</div>
          </div>
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

    toast.success(`Print preview opened for ${qr.tableLabel}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading QR Generator</h2>
          <p className="text-gray-700">Setting up QR code generation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <QrCode className="w-12 h-12 mx-auto" />
          </div>
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error Loading QR Generator</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Preview and download your QR codes
          </h1>
          <p className="text-lg text-foreground mt-2">
            Generate QR codes for {venueName}
          </p>
        </div>

        {generatedQRs.length === 0 ? (
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5" />
                  Select tables to generate QR codes for table service
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {tables.length === 0 ? (
                    <div className="text-center py-8">
                      <QrCode className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Tables Found</h3>
                      <p className="text-gray-600 mb-4">You need to add tables before generating QR codes.</p>
                      <Button onClick={() => router.push('/onboarding/tables')}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Tables
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2 mb-4">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={selectAllTables}
                          disabled={selectedTables.length === tables.length}
                        >
                          Select All ({tables.length})
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={clearSelection}
                          disabled={selectedTables.length === 0}
                        >
                          Clear Selection
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {tables.map((table) => (
                          <div 
                            key={table.id}
                            className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                              selectedTables.includes(table.id)
                                ? 'border-purple-500 bg-purple-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => toggleTableSelection(table.id)}
                          >
                            <div className="flex items-center space-x-3">
                              <Checkbox 
                                checked={selectedTables.includes(table.id)}
                                onChange={() => toggleTableSelection(table.id)}
                              />
                              <div className="flex-1">
                                <h3 className="font-medium text-gray-900">{table.label}</h3>
                                <p className="text-sm text-gray-600">
                                  <Users className="w-3 h-3 inline mr-1" />
                                  {table.seat_count} seats
                                  {table.area && (
                                    <span className="ml-2">
                                      <Badge variant="secondary" className="text-xs">
                                        {table.area}
                                      </Badge>
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-4 pt-4">
                        <Button 
                          onClick={generateQRCodes}
                          disabled={selectedTables.length === 0 || generating}
                          className="flex-1"
                        >
                          {generating ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Generating QR Codes...
                            </>
                          ) : (
                            <>
                              <QrCode className="w-4 h-4 mr-2" />
                              Generate QR Codes ({selectedTables.length})
                            </>
                          )}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <QrCode className="h-5 w-5" />
                    Generated QR Codes ({generatedQRs.length})
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setGeneratedQRs([]);
                        setSelectedTables([]);
                      }}
                    >
                      Generate New
                    </Button>
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={printAllQRCodes}
                    >
                      <Printer className="w-4 h-4 mr-2" />
                      Print All
                    </Button>
                    <Button 
                      size="sm"
                      onClick={downloadAllQRCodes}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download All
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {generatedQRs.map((qr) => (
                    <div key={qr.tableId} className="border rounded-lg p-4">
                      <div className="text-center">
                        <h3 className="font-medium text-gray-900 mb-2">{qr.tableLabel}</h3>
                        <div className="mb-4">
                          <img 
                            src={qr.qrUrl} 
                            alt={`QR Code for ${qr.tableLabel}`}
                            className="w-48 h-48 mx-auto border rounded"
                          />
                        </div>
                        <div className="flex gap-2 justify-center">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => downloadQRCode(qr)}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Download
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => printQRCode(qr)}
                          >
                            <Printer className="w-4 h-4 mr-1" />
                            Print
                          </Button>
                        </div>
                        <div className="mt-2">
                          <p className="text-xs text-gray-500">
                            Scans to: {venueName} ordering page
                          </p>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => window.open(qr.orderUrl, '_blank')}
                            className="mt-1 text-xs h-7"
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            Test URL
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
