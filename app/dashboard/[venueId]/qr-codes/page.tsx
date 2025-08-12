"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, Download, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { NavBar } from "@/components/NavBar";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Session } from "@supabase/supabase-js";

interface Table {
  id: string;
  qr_code: string | null;
  created_at?: string;
  name?: string;
}

interface Venue {
  venue_id: string;
  name: string;
  owner_id: string;
}

interface Stats {
  totalTables: number;
  activeQRCodes: number;
}

export default function QRCodePage({ params }: { params: { venueId: string } }) {
  const [session, setSession] = useState<Session | null>(null);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    totalTables: 0,
    activeQRCodes: 0
  });
  const [tables, setTables] = useState<Table[]>([]);
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
          await loadStats(venueData.venue_id);
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

  const loadStats = async (venueId: string) => {
    try {
      const { data: tables, error: tablesError } = await supabase
        .from("tables")
        .select("id, qr_code, created_at, name")
        .eq("venue_id", venueId);

      if (tablesError) {
        console.error("Error fetching tables:", tablesError.message);
        return;
      }

      if (tables) {
        const activeQRCodes = tables.filter((table: Table) => table.qr_code)?.length || 0;
        setStats({
          totalTables: tables.length || 0,
          activeQRCodes
        });
        setTables(tables);
      }
    } catch (error) {
      console.error("Error loading QR code stats:", error);
    }
  };

  const [isGenerating, setIsGenerating] = useState(false);
  
  const handleGenerateQR = async () => {
    setIsGenerating(true);
    try {
      router.push(`/generate-qr?venue=${params.venueId}`);
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

  if (!session) {
    router.replace("/sign-in");
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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