import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface GeneratedQR {
  name: string;
  url: string;
  type: 'table' | 'counter';
}

export function useQRCodeManagement(venueId: string) {
  const [tables, setTables] = useState<any[]>([]);
  const [counters, setCounters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatedQRs, setGeneratedQRs] = useState<GeneratedQR[]>([]);
  const [qrCodeType, setQrCodeType] = useState<'tables' | 'counters'>('tables');
  const [inputName, setInputName] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (venueId) {
      loadTablesAndCounters();
    }
  }, [venueId]);

  const loadTablesAndCounters = async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      
      const { data: tablesData, error: tablesError } = await supabase
        .from('tables')
        .select('*')
        .eq('venue_id', venueId)
        .order('label', { ascending: true });

      if (tablesError) {
        console.error('Error loading tables:', tablesError);
      }

      const { data: countersData, error: countersError } = await supabase
        .from('counters')
        .select('*')
        .eq('venue_id', venueId)
        .order('name', { ascending: true });

      if (countersError) {
        console.error('Error loading counters:', countersError);
      }

      setTables(tablesData || []);
      setCounters(countersData || []);
    } catch (error) {
      console.error('Error loading tables and counters:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateQRForName = (name: string, type: 'table' | 'counter' = 'table') => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${baseUrl}/order?venue=${venueId}&${type}=${encodeURIComponent(name)}`;
    
    const newQR: GeneratedQR = {
      name,
      url,
      type
    };

    setGeneratedQRs(prev => {
      const exists = prev.find(qr => qr.name === name && qr.type === type);
      if (exists) {
        toast({
          title: "QR Code Already Generated",
          description: `A QR code for ${name} already exists.`,
        });
        return prev;
      }
      return [...prev, newQR];
    });
  };

  const generateQRForAll = () => {
    const items = qrCodeType === 'tables' ? tables : counters;
    
    items.forEach(item => {
      const name = qrCodeType === 'tables' ? item.label : item.name;
      generateQRForName(name, qrCodeType === 'tables' ? 'table' : 'counter');
    });

    toast({
      title: "QR Codes Generated",
      description: `Generated QR codes for all ${qrCodeType}`,
    });
  };

  const removeQR = (name: string, type: 'table' | 'counter') => {
    setGeneratedQRs(prev => prev.filter(qr => !(qr.name === name && qr.type === type)));
  };

  const clearAllQRs = () => {
    setGeneratedQRs([]);
    toast({
      title: "QR Codes Cleared",
      description: "All generated QR codes have been removed.",
    });
  };

  const copyQRUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: "Copied!",
      description: "QR code URL copied to clipboard",
    });
  };

  const downloadQR = async (qr: GeneratedQR) => {
    try {
      const QRCode = await import('qrcode');
      const dataUrl = await QRCode.toDataURL(qr.url, {
        width: 512,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      });

      const link = document.createElement('a');
      link.download = `qr-${qr.name}-${qr.type}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Error downloading QR code:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download QR code",
        variant: "destructive",
      });
    }
  };

  return {
    tables,
    counters,
    loading,
    generatedQRs,
    qrCodeType,
    setQrCodeType,
    inputName,
    setInputName,
    loadTablesAndCounters,
    generateQRForName,
    generateQRForAll,
    removeQR,
    clearAllQRs,
    copyQRUrl,
    downloadQR
  };
}

