import { useState, useEffect } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

export interface GeneratedQR {
  name: string;
  url: string;
  type: "table" | "counter";
}

interface TableItem {
  id?: string;
  table_id?: string;
  label?: string;
  table_number?: string | number;
  name?: string;
}

interface CounterItem {
  id?: string;
  counter_id?: string;
  name?: string;
  label?: string;
  counter_name?: string;
}

export function useQRCodeManagement(venueId: string) {
  const [tables, setTables] = useState<TableItem[]>([]);
  const [counters, setCounters] = useState<CounterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatedQRs, setGeneratedQRs] = useState<GeneratedQR[]>([]);
  const [qrCodeType, setQrCodeType] = useState<"tables" | "counters" | "custom">("custom");
  const [inputName, setInputName] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== "undefined" && venueId) {
      loadTablesAndCounters();
    }
  }, [venueId]);

  const loadTablesAndCounters = async () => {
    try {
      setLoading(true);
      const supabase = createClient();

      const { data: tablesData, error: tablesError } = await supabase
        .from("tables")
        .select("*")
        .eq("venue_id", venueId)
        .order("label", { ascending: true });

      if (tablesError) {
        toast({
          title: "Error",
          description: `Failed to load tables: ${tablesError.message || "Unknown error"}`,
          variant: "destructive",
        });
      }

      // Try to load counters - they might not exist or have different schema
      let countersData: CounterItem[] = [];
      try {
        const result = await supabase.from("counters").select("*").eq("venue_id", venueId);

        if (!result.error) {
          countersData = result.data || [];
        } else {
          // Intentionally empty
        }
      } catch {
        // Silently fail - counters are optional
      }

      setTables(tablesData || []);
      setCounters(countersData);
    } catch (_error) {
      toast({
        title: "Error",
        description: `Failed to load data: ${_error instanceof Error ? _error.message : "Unknown _error"}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateQRForName = (name: string, type: "table" | "counter" = "table") => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${baseUrl}/order?venue=${venueId}&${type}=${encodeURIComponent(name)}`;

    const newQR: GeneratedQR = {
      name,
      url,
      type,
    };

    setGeneratedQRs((prev) => {
      const exists = prev.find((qr) => qr.name === name && qr.type === type);
      if (exists) {
        // Silently ignore duplicates
        return prev;
      }
      return [...prev, newQR];
    });

    toast({
      title: "QR Code Generated",
      description: `Created QR code for ${name}`,
    });
  };

  const generateQRForAll = () => {
    const items = qrCodeType === "tables" ? tables : counters;

    items.forEach((item: TableItem | CounterItem) => {
      let name = "";
      if (qrCodeType === "tables") {
        name = String(
          item.label || (item as Record<string, unknown>).table_number || item.name || ""
        );
      } else {
        name = String(
          (item as Record<string, unknown>).counter_name || item.label || item.name || ""
        );
      }

      if (name && name !== "undefined" && name !== "null" && name.trim() !== "") {
        generateQRForName(name, qrCodeType === "tables" ? "table" : "counter");
      }
    });

    toast({
      title: "QR Codes Generated",
      description: `Generated QR codes for all ${qrCodeType}`,
    });
  };

  const removeQR = (name: string, type: "table" | "counter") => {
    setGeneratedQRs((prev) => prev.filter((qr) => !(qr.name === name && qr.type === type)));
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
      const QRCode = await import("qrcode");
      const dataUrl = await QRCode.toDataURL(qr.url, {
        width: 512,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });

      const link = document.createElement("a");
      link.download = `qr-${qr.name}-${qr.type}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
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
    refetch: loadTablesAndCounters,
    generateQRForName,
    generateQRForAll,
    removeQR,
    clearAllQRs,
    copyQRUrl,
    downloadQR,
  };
}
