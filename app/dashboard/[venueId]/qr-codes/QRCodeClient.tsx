'use client';

import { useState, useEffect } from 'react';
import { useAuth } from "@/app/auth/AuthProvider";
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Download, Trash2, Copy } from 'lucide-react';
import QRCode from 'qrcode';

interface QRCodeItem {
  id: string;
  table_number: number;
  qr_code_url: string;
  created_at: string;
}

export default function QRCodeClient({ venueId, venueName }: { venueId: string; venueName?: string }) {
  const { session } = useAuth();
  const [qrCodes, setQrCodes] = useState<QRCodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (session?.user) {
      fetchQRCodes();
    }
  }, [session, venueId]);

  const fetchQRCodes = async () => {
    try {
      const { data, error } = await supabase()
        .from('qr_codes')
        .select('*')
        .eq('venue_id', venueId)
        .order('table_number', { ascending: true });

      if (error) {
        console.error('Error fetching QR codes:', error);
      } else {
        setQrCodes(data || []);
      }
    } catch (error) {
      console.error('Error fetching QR codes:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateQRCode = async () => {
    if (!newTableNumber || isNaN(Number(newTableNumber))) return;

    setIsAdding(true);
    try {
      const tableNumber = parseInt(newTableNumber);
      const orderUrl = `${window.location.origin}/order?venue=${venueId}&table=${tableNumber}`;
      
      // Generate QR code as data URL
      const qrDataUrl = await QRCode.toDataURL(orderUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      const { data, error } = await supabase()
        .from('qr_codes')
        .insert({
          venue_id: venueId,
          table_number: tableNumber,
          qr_code_url: qrDataUrl,
          order_url: orderUrl,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating QR code:', error);
      } else {
        setQrCodes([...qrCodes, data]);
        setNewTableNumber('');
      }
    } catch (error) {
      console.error('Error generating QR code:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const deleteQRCode = async (qrCodeId: string) => {
    try {
      const { error } = await supabase()
        .from('qr_codes')
        .delete()
        .eq('id', qrCodeId);

      if (error) {
        console.error('Error deleting QR code:', error);
      } else {
        setQrCodes(qrCodes.filter(qr => qr.id !== qrCodeId));
      }
    } catch (error) {
      console.error('Error deleting QR code:', error);
    }
  };

  const downloadQRCode = async (qrCodeUrl: string, tableNumber: number) => {
    try {
      const link = document.createElement('a');
      link.href = qrCodeUrl;
      link.download = `qr-code-table-${tableNumber}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading QR code:', error);
    }
  };

  const copyOrderUrl = async (orderUrl: string) => {
    try {
      await navigator.clipboard.writeText(orderUrl);
      // You could add a toast notification here
    } catch (error) {
      console.error('Error copying URL:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* QR Code Stats */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <QrCode className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{qrCodes.length} QR codes</span>
          </div>
          <span className="text-sm text-muted-foreground">•</span>
          <span className="text-sm text-muted-foreground">
            {qrCodes.length > 0 ? `${Math.max(...qrCodes.map(qr => qr.table_number))} tables` : 'No tables'}
          </span>
        </div>
        <Button onClick={() => setIsAdding(!isAdding)}>
          <Plus className="w-4 h-4 mr-2" />
          Add QR Code
        </Button>
      </div>

      {isAdding && (
        <Card>
          <CardHeader>
            <CardTitle>Generate New QR Code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="tableNumber">Table Number</Label>
              <Input
                id="tableNumber"
                type="number"
                value={newTableNumber}
                onChange={(e) => setNewTableNumber(e.target.value)}
                placeholder="Enter table number"
                min="1"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={generateQRCode} disabled={isAdding || !newTableNumber}>
                Generate QR Code
              </Button>
              <Button variant="outline" onClick={() => setIsAdding(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {qrCodes.map((qrCode) => (
          <Card key={qrCode.id}>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">Table {qrCode.table_number}</CardTitle>
                <Badge variant="secondary">QR Code</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center">
                <img 
                  src={qrCode.qr_code_url} 
                  alt={`QR Code for Table ${qrCode.table_number}`}
                  className="w-48 h-48 border rounded-lg"
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => downloadQRCode(qrCode.qr_code_url, qrCode.table_number)}
                    className="flex-1"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => copyOrderUrl(qrCode.order_url || '')}
                    className="flex-1"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy URL
                  </Button>
                </div>
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={() => deleteQRCode(qrCode.id)}
                  className="w-full"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {qrCodes.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">No QR codes generated yet.</p>
            <Button onClick={() => setIsAdding(true)} className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Generate Your First QR Code
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
