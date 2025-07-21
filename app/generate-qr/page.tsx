"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Download, ExternalLink } from "lucide-react";
import { getValidatedSession, type AuthSession } from "@/lib/supabase";

export default function GenerateQrPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [tableNumber, setTableNumber] = useState<string>("1");
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const router = useRouter();

  useEffect(() => {
    const validatedSession = getValidatedSession();
    if (!validatedSession) {
      router.push("/sign-in");
      return;
    }

    setSession(validatedSession);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    if (session && tableNumber && canvasRef.current) {
      const venueId = session.venue.venue_id;
      const url = `${window.location.origin}/order?venue=${venueId}&table=${tableNumber}`;
      setQrCodeUrl(url);

      QRCode.toCanvas(
        canvasRef.current,
        url,
        {
          width: 256,
          margin: 2,
          color: {
            dark: "#8B5CF6",
            light: "#FFFFFF",
          },
        },
        (error: Error | null) => {
          if (error) {
            console.error("Failed to generate QR code:", error);
          } else {
            console.log(`QR Code generated for URL: ${url}`);
          }
        },
      );
    }
  }, [session, tableNumber]);

  const handleDownload = () => {
    if (canvasRef.current) {
      const link = document.createElement("a");
      link.download = `servio-qr-table-${tableNumber}-${session?.venue.name?.replace(/\s+/g, "-").toLowerCase()}.png`;
      link.href = canvasRef.current.toDataURL("image/png");
      link.click();
    }
  };

  const handleTestQR = () => {
    if (qrCodeUrl) {
      window.open(qrCodeUrl, "_blank");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-servio-purple"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Please sign in to generate QR codes.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-24">
            <div className="flex items-center space-x-6">
              <div className="border-l border-gray-300 pl-6">
                <h1 className="text-2xl font-bold text-gray-900">
                  QR Code Generator
                </h1>
                <p className="text-lg text-gray-600">
                  {session.venue.name} - {session.venue.business_type}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => router.push("/dashboard")}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Generate QR Code for Table</CardTitle>
            <CardDescription>
              Create a unique QR code for each table at{" "}
              <strong>{session.venue.name}</strong>. Customers will scan this to
              access your menu and place orders.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <Label htmlFor="table-number">Table Number</Label>
                <Input
                  id="table-number"
                  type="number"
                  min="1"
                  max="999"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="Enter table number (e.g., 5)"
                  className="mt-1"
                />
              </div>

              <div className="bg-white border-2 border-gray-200 rounded-lg p-8 flex justify-center">
                <div className="text-center">
                  <canvas ref={canvasRef} className="mx-auto mb-4" />
                  <p className="text-sm text-gray-600 font-medium">
                    Table {tableNumber}
                  </p>
                  <p className="text-xs text-gray-500">
                    Scan to view menu & order
                  </p>
                </div>
              </div>

              {qrCodeUrl && (
                <div className="text-center text-xs text-gray-500 break-all bg-gray-50 p-3 rounded border">
                  <p className="mb-1">
                    <span className="font-semibold">QR Code URL:</span>
                  </p>
                  <p className="font-mono">{qrCodeUrl}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button
                  onClick={handleDownload}
                  className="bg-servio-purple hover:bg-servio-purple-dark"
                  disabled={!qrCodeUrl}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download QR Code
                </Button>
                <Button
                  variant="outline"
                  onClick={handleTestQR}
                  disabled={!qrCodeUrl}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Test QR Code
                </Button>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Pro Tip:</strong> Print the QR code and place it on
                  each table. Make sure it's clearly visible and easy to scan.
                  You can also laminate it for durability.
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
