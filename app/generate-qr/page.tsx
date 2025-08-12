"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { QrCode, Download, Printer, Copy, Check } from "lucide-react";
import { supabase } from "@/lib/sb-client";
import NavigationBreadcrumb from "@/components/navigation-breadcrumb";

export default function GenerateQRPage() {
  const [session, setSession] = useState<any>(null);
  const [venue, setVenue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tableNumber, setTableNumber] = useState("1");
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      
      if (session?.user) {
        const { data: venueData, error } = await supabase
          .from("venues")
          .select("*")
          .eq("owner_id", session.user.id)
          .single();
        
        if (!error && venueData) {
          setVenue(venueData);
        }
      }
      
      setLoading(false);
    };
    
    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    router.replace("/sign-in");
    return null;
  }

  const venueId = venue?.venue_id || "demo";
  // ALWAYS use Railway domain - never localhost
  const orderUrl = process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/order?venue=${venueId}&table=${tableNumber}`
    : `https://servio-production.up.railway.app/order?venue=${venueId}&table=${tableNumber}`;

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
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>QR Code - Table ${tableNumber}</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
              .qr-container { margin: 20px 0; }
              .table-info { margin: 20px 0; font-size: 18px; }
            </style>
          </head>
          <body>
            <h1>Table ${tableNumber}</h1>
            <div class="qr-container">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(orderUrl)}" alt="QR Code" />
            </div>
            <div class="table-info">
              <p>Scan to order</p>
              <p>${venue?.name || "My Venue"}</p>
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <NavigationBreadcrumb customBackPath="/dashboard" customBackLabel="Dashboard" />
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Generate QR Codes
          </h1>
          <p className="text-gray-600">
            Create QR codes for your tables so customers can order easily
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Settings */}
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
                  <p className="font-medium">{venue?.name || "My Venue"}</p>
                  <p className="text-sm text-gray-600">Venue ID: {venueId}</p>
                </div>
              </div>

              <div>
                <Label>Order URL</Label>
                <div className="mt-1 p-3 bg-gray-50 rounded-md">
                  <code className="text-sm break-all">{orderUrl}</code>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* QR Code Preview */}
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
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(orderUrl)}`}
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
                  Print
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Instructions */}
        <Card className="mt-8">
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
    </div>
  );
}