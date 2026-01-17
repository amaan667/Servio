"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Download, Trash2, Check } from "lucide-react";
import { QRCodeCanvas } from "./QRCodeCanvas";
import { GeneratedQR } from "../hooks/useQRCodeManagement";

interface QRCodeCardProps {
  qr: GeneratedQR;
  size: number;
  onCopy: (url: string) => void;
  onDownload: (qr: GeneratedQR) => void;
  onRemove: (name: string, type: "table" | "counter" | "table_pickup") => void;
}

export function QRCodeCard({ qr, size, onCopy, onDownload, onRemove }: QRCodeCardProps) {
  // Ensure all values are strings to prevent React error #310
  const displayType = String(qr.type || "item");
  const displayName = String(qr.name || "Unknown");
  const displayUrl = String(qr.url || "");

  // Format type for display
  const getTypeLabel = (type: string) => {
    switch (type) {
      case "table_pickup":
        return "Table (Pickup)";
      case "counter":
        return "Counter";
      case "table":
        return "Table";
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  const displayTypeLabel = getTypeLabel(displayType);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy(displayUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="shadow-lg rounded-xl border-gray-200">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900">
          {displayName} ({displayTypeLabel})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center space-y-2">
          <QRCodeCanvas url={displayUrl} size={size} />
          <div className="text-center">
            <p className="text-sm font-medium text-gray-900">
              {displayName}
            </p>
            <p className="text-xs text-gray-500">
              ({displayTypeLabel})
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className={`flex-1 transition-all duration-200 ${
              copied ? "bg-green-50 border-green-500 text-green-600" : ""
            }`}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copy URL
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={() => onDownload(qr)} className="flex-1">
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRemove(displayName, qr.type)}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
