"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, QrCode, Download, Copy } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function QRCodeManagementPage({ params }: { params: { venueId: string } }) {
  const [session, setSession] = useState<any>(null);
  const [venue, setVenue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tableNumber, setTableNumber] = useState(1);
  const [generatedQRs, setGeneratedQRs] = useState<Array<{table: number, url: string}>>([]);
  const router = useRouter();

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      
      if (session?.user) {
        // Fetch venue for the user
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

  const generateQRCode = () => {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://servio-production.up.railway.app";
    const qrUrl = `${baseUrl}/order?venue=${venue?.venue_id}&table=${tableNumber}`;
    
    setGeneratedQRs(prev => [...prev, { table: tableNumber, url: qrUrl }]);
    setTableNumber(prev => prev + 1);
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    // You could add a toast notification here
  };

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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => router.push(`/dashboard/${params.venueId}`)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            QR Code Management
          </h1>
          <p className="text-gray-600">
            Generate QR codes for your tables to enable easy ordering
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* QR Code Generator */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <QrCode className="h-5 w-5 mr-2" />
                Generate QR Codes
              </CardTitle>
              <CardDescription>
                Create QR codes for your tables
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Table Number
                </label>
                <input
                  type="number"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(parseInt(e.target.value) || 1)}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <Button onClick={generateQRCode} className="w-full">
                <QrCode className="h-4 w-4 mr-2" />
                Generate QR Code
              </Button>
            </CardContent>
          </Card>

          {/* Generated QR Codes */}
          <Card>
            <CardHeader>
              <CardTitle>Generated QR Codes</CardTitle>
              <CardDescription>
                Your table QR codes for easy access
              </CardDescription>
            </CardHeader>
            <CardContent>
              {generatedQRs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <QrCode className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No QR codes generated yet</p>
                  <p className="text-sm">Generate your first QR code to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {generatedQRs.map((qr, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Table {qr.table}</span>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(qr.url)}
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Copy URL
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(qr.url, '_blank')}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Test
                          </Button>
                        </div>
                      </div>
                      <div className="bg-gray-50 p-2 rounded text-sm font-mono text-gray-600 break-all">
                        {qr.url}
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