"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Download, Printer, Trash2, QrCode, Grid3x3, FileJson } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useQRCodeManagement } from "./hooks/useQRCodeManagement";
import { QRCodeCanvas } from "./components/QRCodeCanvas";

export default function QRCodeClient({
  venueId,
  venueName,
}: {
  venueId: string;
  venueName: string;
}) {
  const searchParams = useSearchParams();
  const [qrType, setQrType] = useState<"table" | "counter">("table");
  const [singleName, setSingleName] = useState("");
  const [bulkCount, setBulkCount] = useState("10");
  const [bulkPrefix, setBulkPrefix] = useState("");
  const [showBulkDialog, setShowBulkDialog] = useState(false);

  const qrManagement = useQRCodeManagement(venueId);

  // Handle URL parameter for pre-selected table
  useEffect(() => {
    const tableParam = searchParams.get("table");
    if (tableParam) {
      const tableName = decodeURIComponent(tableParam);
      setSingleName(tableName);
      setQrType("table");
      // Auto-generate QR code for the pre-selected table
      setTimeout(() => {
        qrManagement.generateQRForName(tableName, "table");
      }, 100);
    }
  }, [searchParams]);

  // Generate single QR code
  const handleGenerateSingle = () => {
    if (!singleName.trim()) return;
    qrManagement.generateQRForName(singleName.trim(), qrType);
    setSingleName("");
  };

  // Generate multiple QR codes
  const handleGenerateBulk = () => {
    const count = parseInt(bulkCount) || 0;
    if (count < 1 || count > 100) {
      alert("Please enter a number between 1 and 100");
      return;
    }

    const prefix = bulkPrefix.trim() || (qrType === "table" ? "Table" : "Counter");

    for (let i = 1; i <= count; i++) {
      qrManagement.generateQRForName(`${prefix} ${i}`, qrType);
    }

    setShowBulkDialog(false);
    setBulkCount("10");
    setBulkPrefix("");
  };

  // Copy all URLs as JSON
  const copyAllAsJSON = () => {
    const urls = qrManagement.generatedQRs.map((qr) => ({
      name: qr.name,
      type: qr.type,
      url: qr.url,
    }));
    navigator.clipboard.writeText(JSON.stringify(urls, null, 2));
    alert("All URLs copied as JSON!");
  };

  // Download all as PDF (4 per page)
  const downloadAllAsPDF = async () => {
    try {
      const { default: jsPDF } = await import("jspdf");
      const QRCode = await import("qrcode");

      const qrCodes = qrManagement.generatedQRs;
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 10;
      const qrSize = 70; // Size of each QR code in mm
      const spacing = 5;
      const cardsPerRow = 2;
      const cardsPerPage = 4;
      const cardWidth = (pageWidth - 2 * margin - spacing) / cardsPerRow;

      let qrIndex = 0;

      for (let pageIndex = 0; qrIndex < qrCodes.length; pageIndex++) {
        if (pageIndex > 0) {
          pdf.addPage();
        }

        let currentY = margin;

        // Add page title
        pdf.setFontSize(16);
        pdf.setFont("helvetica", "bold");
        pdf.text(`${venueName} - QR Codes`, pageWidth / 2, currentY, { align: "center" });
        currentY += 8;

        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        pdf.text(`Page ${pageIndex + 1}`, pageWidth / 2, currentY, { align: "center" });
        currentY += 10;

        // Generate QR codes for this page
        const pageQRs = qrCodes.slice(qrIndex, qrIndex + cardsPerPage);

        for (let i = 0; i < pageQRs.length; i++) {
          const qr = pageQRs[i];
          const row = Math.floor(i / cardsPerRow);
          const col = i % cardsPerRow;

          const x = margin + col * (cardWidth + spacing);
          const y = currentY + row * (qrSize + 35 + spacing);

          // Generate QR code image
          const dataUrl = await QRCode.toDataURL(qr.url, {
            width: 300,
            margin: 2,
            color: { dark: "#000000", light: "#ffffff" },
          });

          // Add QR code image
          pdf.addImage(dataUrl, "PNG", x, y, qrSize, qrSize);

          // Add QR code name
          pdf.setFontSize(12);
          pdf.setFont("helvetica", "bold");
          const textY = y + qrSize + 5;
          pdf.text(qr.name, x + qrSize / 2, textY, { align: "center", maxWidth: qrSize });

          // Add venue name
          pdf.setFontSize(8);
          pdf.setFont("helvetica", "normal");
          pdf.text(venueName, x + qrSize / 2, textY + 5, { align: "center", maxWidth: qrSize });
        }

        qrIndex += pageQRs.length;
      }

      // Download the PDF
      pdf.save(`qr-codes-${venueName}-${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Please try again.");
    }
  };

  // Print all (opens print dialog)
  const printAll = async () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const qrCodes = qrManagement.generatedQRs;
    const pages: string[] = [];

    // Group QR codes into pages of 4
    for (let i = 0; i < qrCodes.length; i += 4) {
      const pageQRs = qrCodes.slice(i, i + 4);
      const qrCards = await Promise.all(
        pageQRs.map(async (qr) => {
          const QRCode = await import("qrcode");
          const dataUrl = await QRCode.toDataURL(qr.url, {
            width: 300,
            margin: 2,
          });

          return `
            <div style="width: 48%; display: inline-block; padding: 15px; text-align: center; vertical-align: top; margin: 1%;">
              <h3 style="margin-bottom: 10px; font-size: 16px; font-weight: bold;">${qr.name}</h3>
              <img src="${dataUrl}" alt="${qr.name}" style="width: 100%; max-width: 250px; border: 2px solid #000;" />
              <p style="margin-top: 8px; font-size: 12px; color: #666;">${venueName}</p>
            </div>
          `;
        })
      );

      pages.push(`
        <div style="page-break-after: always; padding: 20px;">
          <h2 style="text-align: center; margin-bottom: 20px;">${venueName} - QR Codes (Page ${Math.floor(i / 4) + 1})</h2>
          <div style="display: flex; flex-wrap: wrap; justify-content: center;">
            ${qrCards.join("")}
          </div>
        </div>
      `);
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Codes - ${venueName}</title>
          <style>
            @page { size: A4; margin: 0.5cm; }
            body { margin: 0; font-family: Arial, sans-serif; }
            @media print {
              .page-break { page-break-after: always; }
            }
          </style>
        </head>
        <body>
          ${pages.join("")}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();

    // Trigger print dialog
    setTimeout(() => printWindow.print(), 250);
  };

  return (
    <div className="space-y-6 pb-32 md:pb-8">
      {/* Generator Card */}
      <Card className="shadow-lg rounded-xl border-gray-200">
        <CardHeader>
          <CardTitle>Generate QR Codes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* QR Code Type */}
          <div>
            <Label>QR Code Type</Label>
            <Select value={qrType} onValueChange={(v) => setQrType(v as "table" | "counter")}>
              <SelectTrigger className="rounded-lg mt-1 bg-purple-600 !text-white border-purple-600 hover:bg-purple-700 [&>span]:!text-white [&_svg]:!text-white [&>*]:!text-white">
                <SelectValue className="!text-white [&>*]:!text-white" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="table">Tables</SelectItem>
                <SelectItem value="counter">Counters</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Single QR Code Generation */}
          <div>
            <Label>Enter {qrType === "table" ? "Table" : "Counter"} Name</Label>
            <div className="flex gap-2 mt-1">
              <Input
                placeholder={`e.g., ${qrType === "table" ? "Table 1" : "Counter 1"}`}
                value={singleName}
                onChange={(e) => setSingleName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGenerateSingle()}
                className="rounded-lg"
              />
              <Button onClick={handleGenerateSingle} disabled={!singleName.trim()}>
                <QrCode className="h-4 w-4 mr-2" />
                Generate
              </Button>
            </div>
          </div>

          {/* Bulk Generation */}
          <div className="pt-2 border-t">
            <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Grid3x3 className="h-4 w-4 mr-2" />
                  Generate Multiple
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Generate Multiple QR Codes</DialogTitle>
                  <DialogDescription>
                    Generate QR codes for multiple {qrType === "table" ? "tables" : "counters"} at
                    once
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <Label>Number of QR Codes</Label>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={bulkCount}
                      onChange={(e) => setBulkCount(e.target.value)}
                      placeholder="e.g., 10"
                      className="rounded-lg mt-1"
                    />
                  </div>
                  <div>
                    <Label>Prefix (optional)</Label>
                    <Input
                      placeholder={qrType === "table" ? "Table" : "Counter"}
                      value={bulkPrefix}
                      onChange={(e) => setBulkPrefix(e.target.value)}
                      className="rounded-lg mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Will generate: {bulkPrefix || (qrType === "table" ? "Table" : "Counter")} 1,{" "}
                      {bulkPrefix || (qrType === "table" ? "Table" : "Counter")} 2, ...
                    </p>
                  </div>
                  <Button onClick={handleGenerateBulk} className="w-full">
                    Generate {bulkCount} QR Codes
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Generated QR Codes */}
      {qrManagement.generatedQRs.length > 0 && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-xl font-semibold text-gray-900">
              Generated QR Codes ({qrManagement.generatedQRs.length})
            </h2>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={copyAllAsJSON}>
                <FileJson className="h-4 w-4 mr-2" />
                Copy {qrManagement.generatedQRs.length > 1 ? "All " : ""}URLs (JSON)
              </Button>
              <Button variant="outline" size="sm" onClick={downloadAllAsPDF}>
                <Download className="h-4 w-4 mr-2" />
                {qrManagement.generatedQRs.length === 1 ? "Download" : "Download All"} (PDF)
              </Button>
              <Button variant="outline" size="sm" onClick={printAll}>
                <Printer className="h-4 w-4 mr-2" />
                {qrManagement.generatedQRs.length === 1 ? "Print" : "Print All"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={qrManagement.clearAllQRs}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear{qrManagement.generatedQRs.length > 1 ? " All" : ""}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {qrManagement.generatedQRs.map((qr, index) => (
              <Card key={`${qr.name}-${qr.type}-${index}`} className="shadow-lg rounded-xl">
                <CardHeader>
                  <CardTitle className="text-lg">{qr.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* QR Code Canvas */}
                  <div className="flex justify-center bg-white p-4 rounded-lg border-2 border-gray-200">
                    <QRCodeCanvas url={qr.url} size={300} />
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => qrManagement.copyQRUrl(qr.url)}
                      className="w-full"
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy URL
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => qrManagement.downloadQR(qr)}
                      className="w-full"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => qrManagement.removeQR(qr.name, qr.type)}
                      className="w-full text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Empty State */}
      {qrManagement.generatedQRs.length === 0 && (
        <Card className="shadow-lg rounded-xl border-gray-200">
          <CardContent className="p-12 text-center">
            <div className="text-gray-400 mb-4">
              <QrCode className="h-16 w-16 mx-auto" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No QR Codes Generated</h3>
            <p className="text-gray-600">
              Enter a {qrType === "table" ? "table" : "counter"} name above and click Generate to
              create a QR code
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
