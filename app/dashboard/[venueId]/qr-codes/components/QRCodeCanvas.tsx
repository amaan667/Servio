import { useState, useEffect } from "react";

interface QRCodeCanvasProps {
  url: string;
  size: number;
}

export function QRCodeCanvas({ url, size }: QRCodeCanvasProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const generateQR = async () => {
      try {
        const QRCode = await import("qrcode");
        const dataUrl = await QRCode.toDataURL(url, {
          width: size,
          margin: 2,
          color: { dark: "#000000", light: "#ffffff" },
        });
        setQrDataUrl(dataUrl);
      } catch (error) {
        console.error("[QR Code] Generation error:", error);
      } finally {
        setLoading(false);
      }
    };

    generateQR();
  }, [url, size]);

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <img
      src={qrDataUrl}
      alt="QR Code"
      className="border rounded-lg"
      style={{ width: size, height: size }}
    />
  );
}
