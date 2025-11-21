"use client";

import { Eye, Image, Layout, List } from "lucide-react";
import { PreviewMode } from "../types";

interface PreviewControlsProps {
  previewMode: PreviewMode;
  setPreviewMode: (mode: PreviewMode) => void;
}

export function PreviewControls({ previewMode, setPreviewMode }: PreviewControlsProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center space-x-2">
        <Eye className="h-5 w-5 text-gray-700" />
        <span className="font-semibold text-gray-900">Menu Preview</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPreviewMode("pdf")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
            previewMode === "pdf"
              ? "bg-servio-purple text-white"
              : "bg-servio-purple text-white hover:bg-white hover:text-servio-purple hover:border-2 hover:border-servio-purple"
          }`}
        >
          <Image className="h-4 w-4" />
          PDF
        </button>
        <button
          onClick={() => setPreviewMode("styled")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
            previewMode === "styled"
              ? "bg-servio-purple text-white"
              : "bg-servio-purple text-white hover:bg-white hover:text-servio-purple hover:border-2 hover:border-servio-purple"
          }`}
        >
          <Layout className="h-4 w-4" />
          Styled
        </button>
        <button
          onClick={() => setPreviewMode("simple")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
            previewMode === "simple"
              ? "bg-servio-purple text-white"
              : "bg-servio-purple text-white hover:bg-white hover:text-servio-purple hover:border-2 hover:border-servio-purple"
          }`}
        >
          <List className="h-4 w-4" />
          Simple
        </button>
      </div>
    </div>
  );
}
