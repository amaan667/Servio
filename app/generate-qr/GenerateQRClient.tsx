"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Printer, Copy, Check, Download, Settings } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { siteOrigin } from "@/lib/site";

interface Props {
  venueId: string;
  venueName: string;
}

export default function GenerateQRClient({ venueId, venueName }: Props) {
  const [tableNumber, setTableNumber] = useState("1");
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState({ totalTablesToday: 0, activeTablesNow: 0 });
  const [printSettings, setPrintSettings] = useState({
    qrSize: 150,
    qrPerPage: 4,
    includeInstructions: true,
    includeVenueInfo: true
  });
  const router = useRouter();

  const orderUrl = `${siteOrigin()}/order?venue=${venueId}&table=${tableNumber}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(orderUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handlePrint = () => {
    // Create a hidden iframe for printing instead of opening a new window
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'absolute';
    printFrame.style.left = '-9999px';
    printFrame.style.top = '-9999px';
    document.body.appendChild(printFrame);
    
    const printContent = printFrame.contentDocument || printFrame.contentWindow?.document;
    if (printContent) {
      printContent.write(`
        <html>
          <head>
            <title>QR Code - Table ${tableNumber}</title>
            <style>
              @media print {
                body { margin: 0; padding: 0; }
                .page-break { page-break-after: always; }
                .no-break { page-break-inside: avoid; }
              }
              
              body { 
                font-family: Arial, sans-serif; 
                margin: 0; 
                padding: 20px; 
                background: white;
              }
              
              .header { 
                text-align: center; 
                margin-bottom: 30px; 
                border-bottom: 2px solid #333;
                padding-bottom: 20px;
              }
              
              .venue-name { 
                font-size: 28px; 
                font-weight: bold; 
                color: #333;
                margin-bottom: 10px;
              }
              
              .venue-subtitle { 
                font-size: 16px; 
                color: #666;
                margin-bottom: 20px;
              }
              
              .qr-grid { 
                display: grid; 
                grid-template-columns: repeat(2, 1fr); 
                gap: 40px; 
                margin-bottom: 40px;
              }
              
              .qr-item { 
                text-align: center; 
                padding: 20px; 
                border: 2px solid #ddd; 
                border-radius: 12px;
                background: white;
                page-break-inside: avoid;
              }
              
              .table-number { 
                font-size: 24px; 
                font-weight: bold; 
                color: #333;
                margin-bottom: 15px;
              }
              
              .qr-code { 
                margin: 15px 0; 
                display: flex;
                justify-content: center;
              }
              
              .qr-code img { 
                border: 1px solid #ccc;
                border-radius: 8px;
              }
              
              .scan-text { 
                font-size: 18px; 
                color: #666;
                margin-bottom: 10px;
              }
              
              .venue-info { 
                font-size: 16px; 
                color: #333;
                font-weight: 500;
              }
              
              .instructions { 
                margin-top: 40px; 
                padding: 20px; 
                background: #f8f9fa; 
                border-radius: 8px;
                border-left: 4px solid #007bff;
              }
              
              .instructions h3 { 
                color: #007bff; 
                margin-bottom: 15px;
              }
              
              .instructions ul { 
                margin: 0; 
                padding-left: 20px;
              }
              
              .instructions li { 
                margin-bottom: 8px; 
                color: #555;
              }
              
              .footer { 
                margin-top: 30px; 
                text-align: center; 
                color: #999; 
                font-size: 12px;
                border-top: 1px solid #eee;
                padding-top: 20px;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="venue-name">${venueName || "My Venue"}</div>
              <div class="venue-subtitle">QR Code Ordering System</div>
            </div>
            
            <div class="qr-grid">
              <div class="qr-item">
                <div class="table-number">Table ${tableNumber}</div>
                <div class="qr-code">
                  <img src="https://api.qrserver.com/v1/create-qr-code/?size=${printSettings.qrSize}x${printSettings.qrSize}&data=${encodeURIComponent(orderUrl)}&format=png&margin=2" alt="QR Code for Table ${tableNumber}" />
                </div>
                <div class="scan-text">Scan to order</div>
                <div class="venue-info">${venueName || "My Venue"}</div>
              </div>
            </div>
            
            ${printSettings.includeInstructions ? `
            <div class="instructions">
              <h3>Instructions for Customers:</h3>
              <ul>
                <li>Scan the QR code with your phone's camera</li>
                <li>Browse the menu and select your items</li>
                <li>Add special instructions if needed</li>
                <li>Complete your order and payment</li>
                <li>Your order will be prepared and served</li>
              </ul>
            </div>
            ` : ''}
            
            <div class="footer">
              <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
              <p>Venue ID: ${venueId}</p>
            </div>
          </body>
        </html>
      `);
      printContent.close();
      
      // Wait for images to load, then print and remove iframe
      setTimeout(() => {
        printFrame.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(printFrame);
        }, 1000);
      }, 500);
    }
  };

  const handlePrintMultiple = () => {
    // Create a hidden iframe for printing instead of opening a new window
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'absolute';
    printFrame.style.left = '-9999px';
    printFrame.style.top = '-9999px';
    document.body.appendChild(printFrame);
    
    const printContent = printFrame.contentDocument || printFrame.contentWindow?.document;
    if (printContent) {
      // Generate multiple QR codes for tables 1-10 (or adjust as needed)
      const tables = Array.from({length: 10}, (_, i) => i + 1);
      
      printContent.write(`
        <html>
          <head>
            <title>Multiple QR Codes - ${venueName}</title>
            <style>
              @media print {
                body { margin: 0; padding: 0; }
                .page-break { page-break-after: always; }
                .no-break { page-break-inside: avoid; }
              }
              
              body { 
                font-family: Arial, sans-serif; 
                margin: 0; 
                padding: 20px; 
                background: white;
              }
              
              .header { 
                text-align: center; 
                margin-bottom: 30px; 
                border-bottom: 2px solid #333;
                padding-bottom: 20px;
              }
              
              .venue-name { 
                font-size: 28px; 
                font-weight: bold; 
                color: #333;
                margin-bottom: 10px;
              }
              
              .venue-subtitle { 
                font-size: 16px; 
                color: #666;
                margin-bottom: 20px;
              }
              
              .qr-grid { 
                display: grid; 
                grid-template-columns: repeat(2, 1fr); 
                gap: 30px; 
                margin-bottom: 40px;
              }
              
              .qr-item { 
                text-align: center; 
                padding: 15px; 
                border: 2px solid #ddd; 
                border-radius: 8px;
                background: white;
                page-break-inside: avoid;
              }
              
              .table-number { 
                font-size: 20px; 
                font-weight: bold; 
                color: #333;
                margin-bottom: 10px;
              }
              
              .qr-code { 
                margin: 10px 0; 
                display: flex;
                justify-content: center;
              }
              
              .qr-code img { 
                border: 1px solid #ccc;
                border-radius: 6px;
              }
              
              .scan-text { 
                font-size: 14px; 
                color: #666;
                margin-bottom: 8px;
              }
              
              .venue-info { 
                font-size: 14px; 
                color: #333;
                font-weight: 500;
              }
              
              .footer { 
                margin-top: 30px; 
                text-align: center; 
                color: #999; 
                font-size: 12px;
                border-top: 1px solid #eee;
                padding-top: 20px;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="venue-name">${venueName || "My Venue"}</div>
              <div class="venue-subtitle">QR Code Ordering System - All Tables</div>
            </div>
            
            ${tables.map((tableNum, index) => {
              const tableOrderUrl = `${siteOrigin()}/order?venue=${venueId}&table=${tableNum}`;
              return `
                <div class="qr-item">
                  <div class="table-number">Table ${tableNum}</div>
                  <div class="qr-code">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=${printSettings.qrSize}x${printSettings.qrSize}&data=${encodeURIComponent(tableOrderUrl)}&format=png&margin=2" alt="QR Code for Table ${tableNum}" />
                  </div>
                  <div class="scan-text">Scan to order</div>
                  <div class="venue-info">${venueName || "My Venue"}</div>
                </div>
                ${(index + 1) % 4 === 0 && index < tables.length - 1 ? '<div class="page-break"></div>' : ''}
              `;
            }).join('')}
            
            <div class="footer">
              <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
              <p>Venue ID: ${venueId}</p>
            </div>
          </body>
        </html>
      `);
      printContent.close();
      
      // Wait for images to load, then print and remove iframe
      setTimeout(() => {
        printFrame.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(printFrame);
        }, 1000);
      }, 1000);
    }
  };

  useEffect(() => {
    const loadStats = async () => {
      // Today window
      const today = new Date(); today.setHours(0,0,0,0);
      const startIso = today.toISOString();
      const endIso = new Date(today.getTime() + 24*60*60*1000).toISOString();
      // Any tables that interacted today (orders placed). If qr_scans table exists, union here later.
      const { data: anyOrders } = await supabase
        .from('orders')
        .select('table_number,status,created_at')
        .eq('venue_id', venueId)
        .gte('created_at', startIso)
        .lt('created_at', endIso);
      const totalTablesToday = new Set((anyOrders ?? []).map((o:any)=>o.table_number).filter((t:any)=>t!=null)).size;
      const activeTablesNow = new Set((anyOrders ?? []).filter((o:any)=>['pending','preparing'].includes(String(o.status))).map((o:any)=>o.table_number).filter((t:any)=>t!=null)).size;
      setStats({ totalTablesToday, activeTablesNow });
    };
    loadStats();
  }, [venueId]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Tables (today)</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalTablesToday}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active QR Codes (now)</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activeTablesNow}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>QR Code Settings</CardTitle>
            <CardDescription>
              Configure your QR code generation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="tableNumber">Table Number</Label>
              <Input
                id="tableNumber"
                type="number"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                min="1"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Venue</Label>
              <div className="mt-1 p-3 bg-gray-50 rounded-md">
                <p className="font-medium">{venueName || "My Venue"}</p>
                <p className="text-sm text-gray-600">Venue ID: {venueId}</p>
              </div>
            </div>

            <div>
              <Label>Order URL</Label>
              <div className="mt-1 p-3 bg-gray-50 rounded-md">
                <code className="text-sm break-all">{orderUrl}</code>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Label className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Print Settings
              </Label>
              <div className="mt-2 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">QR Code Size:</span>
                  <select 
                    value={printSettings.qrSize} 
                    onChange={(e) => setPrintSettings(prev => ({...prev, qrSize: parseInt(e.target.value)}))}
                    className="text-sm border rounded px-2 py-1"
                  >
                    <option value={120}>Small (120px)</option>
                    <option value={150}>Medium (150px)</option>
                    <option value={200}>Large (200px)</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Include Instructions:</span>
                  <input 
                    type="checkbox" 
                    checked={printSettings.includeInstructions}
                    onChange={(e) => setPrintSettings(prev => ({...prev, includeInstructions: e.target.checked}))}
                    className="rounded"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Include Venue Info:</span>
                  <input 
                    type="checkbox" 
                    checked={printSettings.includeVenueInfo}
                    onChange={(e) => setPrintSettings(prev => ({...prev, includeVenueInfo: e.target.checked}))}
                    className="rounded"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>QR Code Preview</CardTitle>
            <CardDescription>
              Preview and download your QR code
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className="bg-white p-4 rounded-lg shadow-sm inline-block">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=${printSettings.qrSize}x${printSettings.qrSize}&data=${encodeURIComponent(orderUrl)}&format=png&margin=2`}
                  alt="QR Code"
                  className="w-48 h-48"
                />
              </div>
              <div className="mt-4">
                <Badge variant="secondary">Table {tableNumber}</Badge>
              </div>
            </div>

            <div className="flex space-x-2 mt-4">
              <Button onClick={handleCopy} variant="outline" className="flex-1">
                {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied ? "Copied!" : "Copy URL"}
              </Button>
              <Button onClick={handlePrint} variant="outline" className="flex-1">
                <Printer className="mr-2 h-4 w-4" />
                Print Single
              </Button>
            </div>
            
            <div className="mt-3">
              <Button onClick={handlePrintMultiple} variant="default" className="w-full">
                <Printer className="mr-2 h-4 w-4" />
                Print All Tables (1-10)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How to Use QR Codes</CardTitle>
          <CardDescription>
            Follow these steps to set up QR code ordering
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-purple-600 font-semibold">1</span>
              </div>
              <div>
                <h4 className="font-medium">Generate QR Codes</h4>
                <p className="text-sm text-gray-600">
                  Create a QR code for each table in your venue
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 font-semibold">2</span>
              </div>
              <div>
                <h4 className="font-medium">Print and Display</h4>
                <p className="text-sm text-gray-600">
                  Print the QR codes and place them on each table
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-green-600 font-semibold">3</span>
              </div>
              <div>
                <h4 className="font-medium">Customers Order</h4>
                <p className="text-sm text-gray-600">
                  Customers scan the QR code to view your menu and place orders
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
