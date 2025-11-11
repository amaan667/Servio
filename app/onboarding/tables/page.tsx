"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, QrCode, Download } from "lucide-react";
import OnboardingProgress from "@/components/onboarding-progress";
import { createClient } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import QRCode from "qrcode";

interface PreviewTable {
  number: number;
  qrCode: string;
  url: string;
}

export default function OnboardingTablesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [selectedCount, setSelectedCount] = useState(5);
  const [previewTables, setPreviewTables] = useState<PreviewTable[]>([]);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const supabase = await createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) {
        setLoading(false);
        return;
      }

      // Get venue
      const { data: venues } = await supabase
        .from("venues")
        .select("venue_id, name")
        .eq("owner_user_id", user.id)
        .limit(1);

      if (!venues || venues.length === 0) {
        setLoading(false);
        return;
      }

      setVenueId(venues[0]?.venue_id);
      generatePreview(selectedCount, venues[0]?.venue_id);
      setLoading(false);
    } catch (_error) {
      setLoading(false);
    }
  };

  const generatePreview = async (count: number, vId: string) => {
    const tables = [];
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://servio-production.up.railway.app";

    for (let i = 1; i <= Math.min(count, 3); i++) {
      const tableUrl = `${baseUrl}/order?venue=${vId}&table=${i}`;
      try {
        const qrDataUrl = await QRCode.toDataURL(tableUrl, {
          width: 200,
          margin: 2,
          color: {
            dark: "#7c3aed",
            light: "#ffffff",
          },
        });
        tables.push({
          number: i,
          qrCode: qrDataUrl,
          url: tableUrl,
        });
      } catch (_error) {
        // Error silently handled
      }
    }

    setPreviewTables(tables);
  };

  const handleCountChange = (count: number) => {
    setSelectedCount(count);
    if (venueId) {
      generatePreview(count, venueId);
    }
  };

  const handleCreateTables = async () => {
    if (!venueId) return;

    setCreating(true);

    try {
      const supabase = await createClient();

      // Create tables
      const tablesToInsert = Array.from({ length: selectedCount }, (_, i) => ({
        venue_id: venueId,
        table_number: i + 1,
        status: "available",
        capacity: 4,
      }));

      const { error } = await supabase.from("tables").insert(tablesToInsert);

      if (error) {
        // Check if tables already exist
        if (error.code === "23505") {
          // Unique constraint violation - tables already exist
          toast({
            title: "Tables already exist",
            description: "Moving to next step...",
          });
        } else {
          throw error;
        }
      } else {
        toast({
          title: "Tables created!",
          description: `Successfully created ${selectedCount} tables with QR codes.`,
        });
      }

      // Store progress
      localStorage.setItem("onboarding_step", "3");
      localStorage.setItem("onboarding_tables_complete", "true");

      // Move to next step
      router.push("/onboarding/test-order");
    } catch (_error) {
      toast({
        title: "Failed to create tables",
        description: _error instanceof Error ? _error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDownloadQR = async () => {
    if (!venueId) return;

    toast({
      title: "Coming soon!",
      description: "QR code download will be available after setup.",
    });
  };

  const handleSkip = () => {
    localStorage.setItem("onboarding_step", "3");
    router.push("/onboarding/test-order");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div>
      <OnboardingProgress currentStep={3} />

      <Card className="border-2 border-purple-200">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <QrCode className="w-6 h-6 mr-2 text-purple-600" />
            Set up your tables & QR codes
          </CardTitle>
          <CardDescription className="text-base">
            Generate QR codes for your tables so customers can start ordering instantly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Table Count Selection */}
          <div>
            <h3 className="font-semibold text-lg mb-3">How many tables do you have?</h3>
            <div className="grid grid-cols-4 gap-3">
              {[5, 10, 15, 20].map((count) => (
                <Button
                  key={count}
                  variant={selectedCount === count ? "default" : "outline"}
                  onClick={() => handleCountChange(count)}
                  className={
                    selectedCount === count ? "bg-purple-600 hover:bg-purple-700 text-white" : ""
                  }
                >
                  {count}
                </Button>
              ))}
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Don't worry, you can add or remove tables later.
            </p>
          </div>

          {/* Preview */}
          <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-6">
            <h3 className="font-semibold text-lg mb-4">Preview (First 3 tables)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {previewTables.map((table) => (
                <div
                  key={table.number}
                  className="bg-white rounded-lg p-4 text-center border-2 border-gray-200"
                >
                  <div className="font-bold text-gray-900 mb-2">Table {table.number}</div>
                  <img
                    src={table.qrCode}
                    alt={`QR Code for Table ${table.number}`}
                    className="w-full max-w-[150px] mx-auto"
                  />
                  <div className="text-xs text-gray-600 mt-2 break-all">{table.url}</div>
                </div>
              ))}
            </div>
            {selectedCount > 3 && (
              <p className="text-center text-sm text-gray-600 mt-4">
                + {selectedCount - 3} more {selectedCount - 3 === 1 ? "table" : "tables"} will be
                created
              </p>
            )}
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>💡 How it works:</strong> Each table gets a unique QR code. When customers
              scan it, they'll see your menu and can place orders directly from their phones. No app
              download required!
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleCreateTables}
              disabled={creating}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white h-12 text-lg"
            >
              {creating ? "Creating Tables..." : `Create ${selectedCount} Tables`}
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadQR}
              disabled={creating}
              className="sm:w-auto"
            >
              <Download className="w-4 h-4 mr-2" />
              Download QR Codes
            </Button>
          </div>

          {/* Skip Button */}
          <div className="pt-4 border-t">
            <Button variant="ghost" onClick={handleSkip} disabled={creating} className="w-full">
              Skip for Now
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
