"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QrCode, Smartphone, Download } from "lucide-react";

interface QRCodeDisplayProps {
  currentUrl: string;
  venueName?: string;
}

export default function QRCodeDisplay({ currentUrl, venueName = "Servio Café" }: QRCodeDisplayProps) {
  const [showQR, setShowQR] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");

  useEffect(() => {
    if (showQR && !qrCodeDataUrl) {
      generateQRCode();
    }
  }, [showQR, qrCodeDataUrl]);

  const generateQRCode = async () => {
    try {
      // Use a simple QR code service for demo purposes
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(currentUrl)}`;
      setQrCodeDataUrl(qrUrl);
    } catch (error) {
      console.error('[QR CODE] Error generating QR code:', error);
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
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Smartphone className="h-5 w-5" />
          Test on Mobile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-900">
          Scan this QR code with your phone to experience the mobile ordering flow
        </p>
        
        {!showQR ? (
          <Button 
            onClick={() => setShowQR(true)} 
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            <QrCode className="h-4 w-4 mr-2" />
            Show QR Code
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center">
              {qrCodeDataUrl ? (
                <img 
                  src={qrCodeDataUrl} 
                  alt="QR Code for mobile testing" 
                  className="border-2 border-gray-200 rounded-lg"
                />
              ) : (
                <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={downloadQRCode} 
                variant="outline" 
                className="flex-1"
                disabled={!qrCodeDataUrl}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button 
                onClick={() => setShowQR(false)} 
                variant="outline" 
                className="flex-1"
              >
                Hide
              </Button>
            </div>
            
            <div className="text-xs text-gray-900 text-center">
              <p>Point your phone camera at the QR code</p>
              <p>or save the image to scan later</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
