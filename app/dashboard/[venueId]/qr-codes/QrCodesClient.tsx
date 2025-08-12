"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NavBar } from "@/components/NavBar";
import { ArrowLeft, QrCode, Download, Copy, Plus, Printer } from "lucide-react";

interface GeneratedQR {
  table: number;
  url: string;
  qrDataUrl: string;
}

export default function QrCodesClient({ venueId, venueName }: { venueId: string; venueName: string }) {
  const [tableNumber, setTableNumber] = useState(1);
  const [generatedQRs, setGeneratedQRs] = useState<GeneratedQR[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const router = useRouter();

  const generateQRCode = async (tableNum: number) => {
    setIsGenerating(true);
    
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://servio-production.up.railway.app";
    const qrUrl = `${baseUrl}/order?venue=${venueId}&table=${tableNum}`;
    
    try {
      // Generate QR code using a simple QR library or API
      const qrDataUrl = await generateQRDataURL(qrUrl);
      
      const newQR: GeneratedQR = {
        table: tableNum,
        url: qrUrl,
        qrDataUrl
      };
      
      setGeneratedQRs(prev => [...prev, newQR]);
    } catch (error) {
      console.error('Error generating QR code:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateQRDataURL = async (url: string): Promise<string> => {
    // Simple QR code generation using a public API
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
    
    try {
      const response = await fetch(qrApiUrl);
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (error) {
      // Fallback to a placeholder
      return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjEwMCIgeT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5RUkNvZGU8L3RleHQ+PC9zdmc+';
    }
  };

  const bulkGenerate = async () => {
    const startTable = tableNumber;
    const endTable = Math.min(startTable + 9, 50); // Generate up to 10 tables, max 50
    
    for (let i = startTable; i <= endTable; i++) {
      await generateQRCode(i);
    }
    setTableNumber(endTable + 1);
  };

  const downloadQR = async (qr: GeneratedQR) => {
    try {
      const link = document.createElement('a');
      link.href = qr.qrDataUrl;
      link.download = `table-${qr.table}-qr.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading QR code:', error);
    }
  };

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      // You could add a toast notification here
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  const printQR = (qr: GeneratedQR) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Table ${qr.table} QR Code</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
              .qr-container { margin: 20px 0; }
              .qr-code { max-width: 200px; }
              .table-info { margin: 10px 0; font-size: 18px; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="qr-container">
              <div class="table-info">Table ${qr.table}</div>
              <img src="${qr.qrDataUrl}" alt="QR Code" class="qr-code" />
              <p>Scan to order</p>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="outline" 
            onClick={() => router.push(`/dashboard/${venueId}`)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">QR Codes</h1>
          <p className="text-gray-600 mt-2">Generate QR codes for {venueName}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* QR Code Generator */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <QrCode className="h-5 w-5 mr-2" />
                Generate QR Codes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="tableNumber">Table Number</Label>
                <Input
                  id="tableNumber"
                  type="number"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(parseInt(e.target.value) || 1)}
                  min="1"
                  max="50"
                />
              </div>
              <div className="flex space-x-2">
                <Button 
                  onClick={() => generateQRCode(tableNumber)} 
                  disabled={isGenerating}
                  className="flex-1"
                >
                  <QrCode className="h-4 w-4 mr-2" />
                  Generate Single
                </Button>
                <Button 
                  onClick={bulkGenerate}
                  disabled={isGenerating}
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Bulk (10)
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Generated QR Codes */}
          <Card>
            <CardHeader>
              <CardTitle>Generated QR Codes</CardTitle>
            </CardHeader>
            <CardContent>
              {generatedQRs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <QrCode className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No QR codes generated yet</p>
                  <p className="text-sm">Generate your first QR code to get started</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {generatedQRs.map((qr, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium text-lg">Table {qr.table}</span>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(qr.url)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadQR(qr)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => printQR(qr)}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <img 
                          src={qr.qrDataUrl} 
                          alt={`QR Code for Table ${qr.table}`}
                          className="w-20 h-20 border rounded"
                        />
                        <div className="flex-1">
                          <div className="bg-gray-50 p-2 rounded text-xs font-mono text-gray-600 break-all">
                            {qr.url}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Instructions */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>How to Use QR Codes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <span className="text-blue-600 font-bold">1</span>
                </div>
                <h3 className="font-medium mb-1">Generate QR Code</h3>
                <p className="text-sm text-gray-600">Create a QR code for each table</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <span className="text-green-600 font-bold">2</span>
                </div>
                <h3 className="font-medium mb-1">Print & Display</h3>
                <p className="text-sm text-gray-600">Print QR codes and place on tables</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <span className="text-purple-600 font-bold">3</span>
                </div>
                <h3 className="font-medium mb-1">Customers Order</h3>
                <p className="text-sm text-gray-600">Customers scan to place orders</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
