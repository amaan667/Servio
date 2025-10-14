"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QrCode, Smartphone, Download } from "lucide-react";
import { generateQRCodeUrl } from "@/lib/qr-service";
import { handleQRError } from "@/lib/qr-errors";

interface QRCodeDisplayProps {
  currentUrl: string;
  venueName?: string;
}

export default function QRCodeDisplay({ currentUrl, venueName = "Demo Café" }: QRCodeDisplayProps) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");

  useEffect(() => {
    if (!qrCodeDataUrl) {
      generateQRCode();
    }
  }, [qrCodeDataUrl]);

  const generateQRCode = async () => {
    try {
      // Use centralized QR code service
      const qrUrl = generateQRCodeUrl(currentUrl, 200);
      setQrCodeDataUrl(qrUrl);
    } catch (error) {
      handleQRError(error, 'generate_qr_display');
    }
  };

  const downloadQRCode = () => {
    if (qrCodeDataUrl) {
      const link = document.createElement('a');
      link.href = qrCodeDataUrl;
      link.download = `${venueName.toLowerCase().replace(/\s+/g, '-')}-qr-code.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="w-full">
      <div className="flex justify-center">
        {qrCodeDataUrl ? (
          <img 
            src={qrCodeDataUrl} 
            alt="QR Code" 
            className="border-2 border-gray-200 rounded-lg"
          />
        ) : (
          <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        )}
      </div>
    </div>
  );
}
