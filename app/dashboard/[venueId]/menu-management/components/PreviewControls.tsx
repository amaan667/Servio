"use client";

import { Button } from "@/components/ui/button";
import { Eye, Image, Layout, List, Download, Share } from "lucide-react";
import { PreviewMode } from "../types";

interface PreviewControlsProps {
  previewMode: PreviewMode;
  setPreviewMode: (mode: PreviewMode) => void;
  venueId: string;
  onShare: () => void;
}

export function PreviewControls({
  previewMode,
  setPreviewMode,
  venueId,
  onShare,
}: PreviewControlsProps) {
  const handleExportPDF = () => {
    const link = document.createElement("a");
    link.href = `/api/menu/export-pdf?venueId=${venueId}`;
    link.download = "menu.pdf";
    link.click();
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center space-x-2">
        <Eye className="h-5 w-5 text-gray-700" />
        <span className="font-semibold text-gray-900">Menu Preview</span>
      </div>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
        <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setPreviewMode("pdf")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              previewMode === "pdf"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Image className="h-4 w-4 inline mr-1" />
            PDF
          </button>
          <button
            onClick={() => setPreviewMode("styled")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              previewMode === "styled"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Layout className="h-4 w-4 inline mr-1" />
            Styled
          </button>
          <button
            onClick={() => setPreviewMode("simple")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              previewMode === "simple"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <List className="h-4 w-4 inline mr-1" />
            Simple
          </button>
        </div>
        <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={handleExportPDF}>
          <Download className="h-4 w-4 mr-2" />
          Export PDF
        </Button>
        <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={onShare}>
          <Share className="h-4 w-4 mr-2" />
          Share Link
        </Button>
      </div>
    </div>
  );
}
