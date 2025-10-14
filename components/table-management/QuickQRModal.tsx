'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { 
  QrCode, 
  Copy, 
  Download, 
  Printer,
  Users,
  ExternalLink
} from 'lucide-react';
import { siteOrigin } from '@/lib/site';
import { toast } from 'sonner';

interface QuickQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableId: string;
  tableLabel: string;
  venueId: string;
}

export function QuickQRModal({
  isOpen,
  onClose,
  tableId,
  tableLabel,
  venueId
}: QuickQRModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Build the order URL for this table
  const baseUrl = siteOrigin();
  const orderUrl = `${baseUrl}/order?venue=${venueId}&table=${encodeURIComponent(tableLabel)}&source=qr_table`;
  
  console.log('[QUICK QR] Generated order URL:', orderUrl, 'for table:', tableLabel);

  useEffect(() => {
    if (isOpen && !qrDataUrl) {
      generateQRCode();
    }
  }, [isOpen, qrDataUrl]);

  const generateQRCode = async () => {
    setLoading(true);
    try {
      console.log('[QUICK QR] Generating QR code for:', orderUrl);
      const QRCode = await import('qrcode');
      const dataUrl = await QRCode.toDataURL(orderUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      console.log('[QUICK QR] QR code generated successfully');
      setQrDataUrl(dataUrl);
    } catch (error) {
      console.error('[QUICK QR] Error generating QR code:', error);
      toast.error('Failed to generate QR code');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(orderUrl);
      toast.success('Order link copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy link:', error);
      toast.error('Failed to copy link');
    }
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `${tableLabel.toLowerCase().replace(/\s+/g, '-')}-qr-code.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Downloaded QR code for ${tableLabel}`);
  };

  const handlePrint = () => {
    if (!qrDataUrl) {
      toast.error('QR code not ready. Please wait...');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Unable to open print window. Please check your browser settings.');
      return;
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${tableLabel}</title>
          <style>
            body {
              margin: 0;
              padding: 20px;
              font-family: Arial, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
            }
            .qr-container {
              text-align: center;
              page-break-inside: avoid;
            }
            .qr-code {
              margin: 20px 0;
            }
            .qr-title {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 10px;
            }
            .instructions {
              margin-top: 30px;
              font-size: 14px;
              color: #666;
              max-width: 300px;
              text-align: center;
            }
            .order-url {
              margin-top: 20px;
              font-size: 10px;
              color: #999;
              word-break: break-all;
            }
            @media print {
              body { margin: 0; padding: 10px; }
              .qr-container { margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <div class="qr-title">Table: ${tableLabel}</div>
            <div class="qr-code">
              <img src="${qrDataUrl}" alt="QR Code for ${tableLabel}" style="width: 300px; height: 300px;" />
            </div>
            <div class="instructions">
              <strong>How to use:</strong><br>
              1. Scan this QR code with your phone<br>
              2. View the menu and place your order<br>
              3. Your order will be prepared fresh!
            </div>
            <div class="order-url">${orderUrl}</div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 1000);
    };

    toast.success(`Print preview opened for ${tableLabel}`);
  };

  const handleOpenOrderPage = () => {
    window.open(orderUrl, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            QR Code for {tableLabel}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Table Info */}
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <Users className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-medium">{tableLabel}</span>
            <Badge variant="secondary" className="text-xs">
              Table Service
            </Badge>
          </div>

          {/* QR Code Display */}
          <div className="flex justify-center">
            {loading || !qrDataUrl ? (
              <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              </div>
            ) : (
              <img 
                src={qrDataUrl} 
                alt={`QR Code for ${tableLabel}`}
                className="w-48 h-48 border rounded-lg"
              />
            )}
          </div>

          {/* Order URL Preview */}
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-800 font-medium mb-1">Order URL:</p>
            <p className="text-xs text-blue-700 break-all">{orderUrl}</p>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleCopyLink}
              className="flex items-center gap-2"
            >
              <Copy className="h-4 w-4" />
              Copy Link
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleDownload}
              disabled={!qrDataUrl}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handlePrint}
              className="flex items-center gap-2"
            >
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleOpenOrderPage}
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Test Order
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
