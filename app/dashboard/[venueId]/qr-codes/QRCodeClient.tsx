"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Trash2, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Hooks
import { useQRCodeManagement } from './hooks/useQRCodeManagement';

// Components
import { QRCodeCard } from './components/QRCodeCard';
import { QRCodeGenerator } from './components/QRCodeGenerator';

/**
 * QR Code Client Component
 * Manages QR code generation for tables and counters
 * 
 * Refactored: Extracted hooks and components for better organization
 * Original: 795 lines → Now: ~150 lines
 */

export default function QRCodeClient({ venueId, venueName }: { venueId: string; venueName: string }) {
  const [qrCodeSize, setQrCodeSize] = useState('medium');
  const [includeInstructions, setIncludeInstructions] = useState(true);
  const [includeVenueInfo, setIncludeVenueInfo] = useState(true);
  const { toast } = useToast();

  const qrManagement = useQRCodeManagement(venueId);

  // Auto-generate QR code if table parameter is present
  useEffect(() => {
    if (qrManagement.tables.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const tableName = urlParams.get('table');
      
      if (tableName) {
        console.debug('[QR] Auto-generating QR for table from URL:', tableName);
        
        const existingQR = qrManagement.generatedQRs.find(qr => qr.name === tableName);
        if (!existingQR) {
          qrManagement.generateQRForName(tableName);
        }
      }
    }
  }, [qrManagement.tables]);

  const getSizeValue = () => {
    switch (qrCodeSize) {
      case 'small': return 200;
      case 'medium': return 300;
      case 'large': return 400;
      default: return 300;
    }
  };

  const printAllQRs = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const qrCards = qrManagement.generatedQRs.map(qr => {
      const qrUrl = qr.url;
      return `
        <div style="page-break-after: always; padding: 20px; text-align: center;">
          ${includeVenueInfo ? `<h2 style="margin-bottom: 10px;">${venueName}</h2>` : ''}
          <h3 style="margin-bottom: 20px; text-transform: capitalize;">${qr.type}: ${qr.name}</h3>
          <img src="${qrUrl}" alt="QR Code" style="width: 400px; height: 400px; border: 2px solid #000;" />
          ${includeInstructions ? `
            <div style="margin-top: 20px; padding: 20px; background: #f5f5f5; border-radius: 8px;">
              <h4 style="margin-bottom: 10px;">How to Order:</h4>
              <ol style="text-align: left; display: inline-block;">
                <li>Scan the QR code with your phone camera</li>
                <li>Browse the menu and add items to your cart</li>
                <li>Complete your order at checkout</li>
              </ol>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Codes - ${venueName}</title>
          <style>
            @media print {
              body { margin: 0; }
              .page-break { page-break-after: always; }
            }
          </style>
        </head>
        <body>
          ${qrCards}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  if (qrManagement.loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tables and counters...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-32 md:pb-8">
      {/* Generator */}
      <QRCodeGenerator
        qrCodeType={qrManagement.qrCodeType}
        onTypeChange={qrManagement.setQrCodeType}
        inputName={qrManagement.inputName}
        onInputNameChange={qrManagement.setInputName}
        onGenerate={() => qrManagement.generateQRForName(qrManagement.inputName, qrManagement.qrCodeType === 'tables' ? 'table' : 'counter')}
        onGenerateAll={qrManagement.generateQRForAll}
        tables={qrManagement.tables}
        counters={qrManagement.counters}
      />

      {/* Display Options */}
      <Card className="shadow-lg rounded-xl border-gray-200">
        <CardHeader>
          <CardTitle>Display Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>QR Code Size</Label>
            <Select value={qrCodeSize} onValueChange={setQrCodeSize}>
              <SelectTrigger className="rounded-lg mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small (200x200)</SelectItem>
                <SelectItem value="medium">Medium (300x300)</SelectItem>
                <SelectItem value="large">Large (400x400)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Generated QR Codes */}
      {qrManagement.generatedQRs.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Generated QR Codes ({qrManagement.generatedQRs.length})
            </h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={printAllQRs}
                disabled={qrManagement.generatedQRs.length === 0}
              >
                <Printer className="h-4 w-4 mr-2" />
                Print All
              </Button>
              <Button
                variant="outline"
                onClick={qrManagement.clearAllQRs}
                disabled={qrManagement.generatedQRs.length === 0}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {qrManagement.generatedQRs.map((qr, index) => (
              <QRCodeCard
                key={index}
                qr={qr}
                size={getSizeValue()}
                onCopy={qrManagement.copyQRUrl}
                onDownload={qrManagement.downloadQR}
                onRemove={qrManagement.removeQR}
              />
            ))}
          </div>
        </>
      )}

      {/* Empty State */}
      {qrManagement.generatedQRs.length === 0 && (
        <Card className="shadow-lg rounded-xl border-gray-200">
          <CardContent className="p-12 text-center">
            <div className="text-gray-400 mb-4">
              <QrCode className="h-16 w-16 mx-auto" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No QR Codes Generated</h3>
            <p className="text-gray-600">
              Use the generator above to create QR codes for your tables or counters
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
