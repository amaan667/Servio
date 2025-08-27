"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, QrCode, Download } from "lucide-react";
import ClientNavBar from "@/components/ClientNavBar";
import { useAuth } from "@/app/authenticated-client-provider";
import { toast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import Image from "next/image";
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';

const supabase = createClient();

interface Table {
  id: string;
  qr_code: string | null;
  created_at?: string;
  name?: string;
}

interface Stats {
  totalTables: number; // distinct tables that had scans or any orders today
  activeQRCodes: number; // tables currently active (open orders today)
}

interface QRCodeClientProps {
  venueId: string;
  venueName: string;
}

export default function QRCodeClient({ venueId, venueName }: QRCodeClientProps) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    totalTables: 0,
    activeQRCodes: 0
  });
  const [tables, setTables] = useState<Table[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadStats();
    // Listen to orders changes to reflect active tables today
    const channel = supabase
      .channel('qr-dashboard-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `venue_id=eq.${venueId}` }, () => {
        loadStats();
      })
      .subscribe();
    return () => { createClient().removeChannel(channel); };
  }, [venueId]);

  const loadStats = async () => {
    try {
      // Load tables list
      const { data: tables, error: tablesError } = await supabase
        .from("tables")
        .select("id, qr_code, created_at, name")
        .eq("venue_id", venueId);
      if (tablesError) {
        console.error("Error fetching tables:", tablesError.message);
      } else {
        setTables(tables || []);
      }

      // Today window in UTC (device-based)
      const today = new Date(); today.setHours(0,0,0,0);
      const startIso = today.toISOString();
      const endIso = new Date(today.getTime() + 24*60*60*1000).toISOString();
      // Active open orders today (pending|preparing)
      const { data: openOrders } = await supabase
        .from('orders')
        .select('table_number, status, created_at')
        .eq('venue_id', venueId)
        .in('status', ['pending','preparing'])
        .gte('created_at', startIso)
        .lt('created_at', endIso);
      const activeTables = new Set((openOrders ?? []).map((o:any)=>o.table_number).filter((t:any)=>t!=null)).size;
      // Any tables that interacted today (any order placed). If you later add a qr_scans table,
      // union those table_numbers here as well.
      const { data: anyOrders } = await supabase
        .from('orders')
        .select('table_number')
        .eq('venue_id', venueId)
        .gte('created_at', startIso)
        .lt('created_at', endIso);
      const interactedTables = new Set((anyOrders ?? []).map((o:any)=>o.table_number).filter((t:any)=>t!=null)).size;

      setStats({ totalTables: interactedTables, activeQRCodes: activeTables });
    } catch (error) {
      console.error("Error loading QR code stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateQR = async () => {
    setIsGenerating(true);
    try {
      router.push(`/generate-qr?venue=${venueId}`);
    } catch (error) {
      console.error("Error navigating to QR generation:", error);
    } finally {
      setIsGenerating(false);
    }
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

  return (
    <div className="min-h-screen bg-gray-50">
      <ClientNavBar venueId={venueId} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <NavigationBreadcrumb customBackPath={`/dashboard/${venueId}`} customBackLabel="Dashboard" venueId={venueId} />
        
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">QR Code Management</h2>
            <p className="text-gray-600">Generate and manage QR codes for your tables</p>
          </div>
          <Button 
            onClick={handleGenerateQR} 
            disabled={isGenerating}
          >
            {isGenerating ? (
              <div className="h-4 w-4 mr-2 animate-spin rounded-full border-b-2 border-white" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            {isGenerating ? 'Generating...' : 'Generate New QR Code'}
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Tables</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalTables}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <QrCode className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active QR Codes</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.activeQRCodes}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <QrCode className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* QR Code List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Add placeholder card for when no QR codes exist */}
          {stats.totalTables === 0 && (
            <Card className="col-span-full">
              <CardContent className="p-6 text-center">
                <QrCode className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold mb-2">No QR Codes Yet</h3>
                <p className="text-gray-500 mb-4">Get started by generating your first QR code</p>
                <Button 
                  onClick={handleGenerateQR}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-b-2 border-white" />
                  ) : null}
                  {isGenerating ? 'Generating...' : 'Generate QR Code'}
                </Button>
              </CardContent>
            </Card>
          )}

          {tables.map((table: Table) => (
            <Card key={table.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="aspect-square relative mb-4 bg-gray-100 rounded-lg flex items-center justify-center">
                  {table.qr_code ? (
                    <Image
                      src={table.qr_code}
                      alt={`QR Code for ${table.name || `Table ${table.id}`}`}
                      fill
                      className="object-contain p-4"
                    />
                  ) : (
                    <QrCode className="h-12 w-12 text-gray-400" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{table.name || `Table ${table.id}`}</h4>
                    <p className="text-sm text-gray-500">
                      Created on {new Date(table.created_at || Date.now()).toLocaleDateString()}
                    </p>
                  </div>
                  {table.qr_code && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={table.qr_code} download={`qr-${table.name || table.id}.png`}>
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
