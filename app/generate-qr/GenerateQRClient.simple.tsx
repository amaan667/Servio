"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QrCode, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface Props {
  venueId: string;
  venueName: string;
  activeTablesCount: number;
}

export default function GenerateQRClientSimple({ venueId, venueName, activeTablesCount }: Props) {
  const [loading, setLoading] = useState(true);
  const [tables, setTables] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const loadTables = async () => {
      try {
        setLoading(true);
        const supabase = createClient();
        
        const { data: tablesData, error: tablesError } = await supabase
          .from('tables')
          .select('*')
          .eq('venue_id', venueId)
          .order('table_number');

        if (tablesError) {
          setError('Failed to load tables');
          return;
        }

        setTables(tablesData || []);
      } catch (err) {
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    loadTables();
  }, [venueId]);

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
            QR Code Generator
          </h1>
          <p className="text-lg text-foreground mt-2">
            Generate QR codes for {venueName}
          </p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                QR Code Generator
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  ✅ QR Code Generator is working! Found {tables.length} tables.
                </p>
                <p className="text-sm text-gray-600">
                  Venue: {venueName} (ID: {venueId})
                </p>
                <p className="text-sm text-gray-600">
                  Active Tables: {activeTablesCount}
                </p>
                
                {tables.length > 0 && (
                  <div className="mt-4">
                    <h3 className="font-medium mb-2">Available Tables:</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {tables.slice(0, 6).map((table) => (
                        <div key={table.id} className="p-2 bg-gray-100 rounded text-sm">
                          Table {table.table_number || table.id}
                        </div>
                      ))}
                    </div>
                    {tables.length > 6 && (
                      <p className="text-xs text-gray-500 mt-2">
                        ... and {tables.length - 6} more tables
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
