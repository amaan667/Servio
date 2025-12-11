import { useState, useEffect } from "react";

interface QRCodeCanvasProps {
  url: string;
  size: number;
}

export function QRCodeCanvas({ url, size }: QRCodeCanvasProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

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
      } catch (_error) {
        // Error handled silently
      }
    };

    generateQR();
  }, [url, size]);

  // Show placeholder immediately - no loading spinner
  if (!qrDataUrl) {
    return (
      <div
        className="flex items-center justify-center bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg"
        style={{ width: size, height: size }}
      >
        <div className="text-gray-500 text-sm">QR Code</div>
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
