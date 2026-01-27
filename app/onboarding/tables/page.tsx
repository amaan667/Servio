"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [tables, setTables] = useState<Array<{ name: string; section: string; capacity: number }>>(
    []
  );
  const [qrColor, setQrColor] = useState("#7c3aed"); // Default purple
  const [qrLogo, setQrLogo] = useState<string | null>(null);

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
        // Check if user has pending signup data - ensure venue is created
        const pendingSignup = user.user_metadata?.pending_signup;
        if (pendingSignup) {
          // Ensure venue is created
          const response = await fetch("/api/signup/complete-onboarding", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });

          const data = await response.json();
          if (response.ok && data.success && data.venueId) {
            setVenueId(data.venueId);
            generatePreview(selectedCount, data.venueId);
            setLoading(false);
            return;
          }
        }
        // No venue and no pending signup - redirect to venue setup
        router.push("/onboarding/venue-setup");
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
    const previews = [];
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://servio-production.up.railway.app";

    for (let i = 1; i <= Math.min(count, 3); i++) {
      const tableName = tables[i - 1]?.name || `Table ${i}`;
      const tableUrl = `${baseUrl}/order?venue=${vId}&table=${i}`;
      try {
        const qrDataUrl = await QRCode.toDataURL(tableUrl, {
          width: 200,
          margin: 2,
          color: {
            dark: qrColor,
            light: "#ffffff",
          },
        });
        previews.push({
          number: i,
          qrCode: qrDataUrl,
          url: tableUrl,
        });
      } catch (_error) {
        // Error silently handled
      }
    }

    setPreviewTables(previews);
  };

  useEffect(() => {
    // Initialize tables array when count changes
    if (selectedCount > 0 && tables.length === 0) {
      setTables(
        Array.from({ length: selectedCount }, (_, i) => ({
          name: `Table ${i + 1}`,
          section: "Main",
          capacity: 4,
        }))
      );
    } else if (selectedCount !== tables.length) {
      const newTables = Array.from(
        { length: selectedCount },
        (_, i) => tables[i] || { name: `Table ${i + 1}`, section: "Main", capacity: 4 }
      );
      setTables(newTables);
    }
  }, [selectedCount]);

  const handleCountChange = (count: number) => {
    setSelectedCount(count);
    if (venueId) {
      generatePreview(count, venueId);
    }
  };

  const updateTable = (index: number, field: string, value: string | number) => {
    const updated = [...tables];
    const prev = updated[index];
    updated[index] = { ...(prev ?? { name: "", section: "", capacity: 2 }), [field]: value };
    setTables(updated);
    if (venueId) {
      generatePreview(selectedCount, venueId);
    }
  };

  const handleCreateTables = async () => {
    if (!venueId) return;

    setCreating(true);

    try {
      const supabase = await createClient();

      // Create tables with custom names, sections, and capacity
      const tablesToInsert = tables.slice(0, selectedCount).map((table, i) => ({
        venue_id: venueId,
        table_number: i + 1,
        label: table.name,
        section: table.section,
        seat_count: table.capacity,
        status: "available",
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

      // Store progress (both local and server-side)
      localStorage.setItem("onboarding_step", "3");
      localStorage.setItem("onboarding_tables_complete", "true");
      await import("@/lib/onboarding-progress").then(({ saveOnboardingProgress }) =>
        saveOnboardingProgress(3, [1, 2, 3], { tables_complete: true })
      );

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
      <OnboardingProgress
        currentStep={3}
        allowSkip={true}
        allowNavigation={true}
        onStepChange={(step) => {
          const routes = {
            1: "/onboarding/venue-setup",
            2: "/onboarding/menu",
            3: "/onboarding/tables",
            4: "/onboarding/test-order"
          };
          router.push(routes[step as keyof typeof routes]);
        }}
      />

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
                  variant="servio"
                  onClick={() => handleCountChange(count)}
                  className={selectedCount === count ? "" : ""}
                >
                  {count}
                </Button>
              ))}
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Don't worry, you can add or remove tables later.
            </p>
          </div>

          {/* Table Configuration */}
          {tables.length > 0 && (
            <div className="space-y-4 border-t pt-6">
              <h3 className="font-semibold text-lg mb-3">Configure Your Tables</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {tables.slice(0, selectedCount).map((table, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <Label>Table Name</Label>
                      <Input
                        value={table.name}
                        onChange={(e) => updateTable(index, "name", e.target.value)}
                        placeholder={`Table ${index + 1}`}
                        disabled={creating}
                      />
                    </div>
                    <div>
                      <Label>Section</Label>
                      <Input
                        value={table.section}
                        onChange={(e) => updateTable(index, "section", e.target.value)}
                        placeholder="Main"
                        disabled={creating}
                      />
                    </div>
                    <div>
                      <Label>Capacity</Label>
                      <Input
                        type="number"
                        value={table.capacity}
                        onChange={(e) =>
                          updateTable(index, "capacity", parseInt(e.target.value) || 4)
                        }
                        min="1"
                        max="20"
                        disabled={creating}
                      />
                    </div>
                    <div className="flex items-end">
                      <div className="text-sm text-gray-600">
                        {table.section} • {table.capacity} seats
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* QR Code Customization */}
          <div className="space-y-4 border-t pt-6">
            <h3 className="font-semibold text-lg mb-3">QR Code Customization</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="qrColor">QR Code Color</Label>
                <div className="flex items-center gap-4 mt-2">
                  <input
                    type="color"
                    id="qrColor"
                    value={qrColor}
                    onChange={(e) => {
                      setQrColor(e.target.value);
                      if (venueId) {
                        generatePreview(selectedCount, venueId);
                      }
                    }}
                    className="w-16 h-10 rounded border"
                    disabled={creating}
                  />
                  <Input
                    type="text"
                    value={qrColor}
                    onChange={(e) => {
                      setQrColor(e.target.value);
                      if (venueId) {
                        generatePreview(selectedCount, venueId);
                      }
                    }}
                    placeholder="#7c3aed"
                    className="flex-1"
                    disabled={creating}
                  />
                </div>
              </div>
            </div>
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
              variant="servio"
              className="flex-1 h-12 text-lg"
            >
              {creating ? "Creating Tables..." : `Create ${selectedCount} Tables`}
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                if (!venueId) return;
                try {
                  // Generate QR codes for all tables
                  const baseUrl =
                    process.env.NEXT_PUBLIC_SITE_URL || "https://servio-production.up.railway.app";
                  const qrCodes = await Promise.all(
                    tables.slice(0, selectedCount).map(async (table, i) => {
                      const tableUrl = `${baseUrl}/order?venue=${venueId}&table=${i + 1}`;
                      const qrDataUrl = await QRCode.toDataURL(tableUrl, {
                        width: 400,
                        margin: 2,
                        color: { dark: qrColor, light: "#ffffff" },
                      });
                      return { name: table.name, qr: qrDataUrl };
                    })
                  );

                  // Create download links
                  qrCodes.forEach(({ name, qr }) => {
                    const link = document.createElement("a");
                    link.href = qr;
                    link.download = `${name.replace(/\s+/g, "-")}-qr-code.png`;
                    link.click();
                  });

                  toast({
                    title: "QR codes downloaded!",
                    description: `Downloaded ${qrCodes.length} QR code images.`,
                  });
                } catch (_error) {
                  toast({
                    title: "Download failed",
                    description: "Failed to generate QR codes. Please try again.",
                    variant: "destructive",
                  });
                }
              }}
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
