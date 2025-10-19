import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Download, Trash2 } from "lucide-react";
import { QRCodeCanvas } from "./QRCodeCanvas";
import { GeneratedQR } from "../hooks/useQRCodeManagement";

interface QRCodeCardProps {
  qr: GeneratedQR;
  size: number;
  onCopy: (url: string) => void;
  onDownload: (qr: GeneratedQR) => void;
  onRemove: (name: string, type: 'table' | 'counter') => void;
}

export function QRCodeCard({ qr, size, onCopy, onDownload, onRemove }: QRCodeCardProps) {
  return (
    <Card className="shadow-lg rounded-xl border-gray-200">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900 capitalize">
          {qr.type}: {qr.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center">
          <QRCodeCanvas url={qr.url} size={size} />
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCopy(qr.url)}
            className="flex-1"
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy URL
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDownload(qr)}
            className="flex-1"
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRemove(qr.name, qr.type)}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

