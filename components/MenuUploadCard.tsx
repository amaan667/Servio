"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { FileText, Upload, Info, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { normalizeVenueId } from "@/lib/utils/venueId";

interface MenuUploadCardProps {
  venueId: string;
  onSuccess?: () => void;
  menuItemCount?: number; // Pass current menu item count to determine if toggle should show
}

const VALID_EXT = [".txt", ".md", ".json", ".pdf", ".png", ".jpg", ".jpeg", ".webp", ".heic"];
const VISUAL_EXT = [".pdf", ".png", ".jpg", ".jpeg", ".webp", ".heic"];

function getFileExtension(name: string) {
  return name.toLowerCase().substring(name.lastIndexOf("."));
}

function validateStagedFile(file: File): string | null {
  const ext = getFileExtension(file.name);
  if (!VALID_EXT.includes(ext)) {
    return "Please upload a .pdf, .png, .jpg, .jpeg, .webp, .heic, .txt, .md, or .json file";
  }
  const maxSize = VISUAL_EXT.includes(ext) ? 10 * 1024 * 1024 : 1024 * 1024;
  if (file.size > maxSize) {
    return `Please upload a file smaller than ${VISUAL_EXT.includes(ext) ? "10MB" : "1MB"}`;
  }
  return null;
}

const PROGRESS_CAP = 95;
const PROGRESS_INTERVAL_MS = 2000;
const PROGRESS_INCREMENT = 5;

export function MenuUploadCard({ venueId, onSuccess, menuItemCount = 0 }: MenuUploadCardProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isReplacing, setIsReplacing] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  const [menuUrl, setMenuUrl] = useState("");
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [recentUploads, setRecentUploads] = useState<{ id: string; filename: string | null; created_at: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    if (!isProcessing) return;
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((p) => (p >= PROGRESS_CAP ? p : p + PROGRESS_INCREMENT));
    }, PROGRESS_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isProcessing]);

  useEffect(() => {
    const loadRecent = async () => {
      const normalizedVenueId = normalizeVenueId(venueId) ?? venueId;
      const { data } = await supabase
        .from("menu_uploads")
        .select("id, filename, created_at")
        .eq("venue_id", normalizedVenueId)
        .order("created_at", { ascending: false })
        .limit(3);
      setRecentUploads((data ?? []).map((r) => ({ id: r.id, filename: r.filename ?? null, created_at: r.created_at })));
    };
    loadRecent();
  }, [venueId, isProcessing]);

  // Save extracted style to database
  const saveExtractedStyle = async (extractedText: string) => {
    try {
      // Import the style extractor
      const { extractStyleFromPDF } = await import("@/lib/menu-style-extractor");

      // Extract style from text
      const style = extractStyleFromPDF(extractedText);

      // Get venue name - normalize venueId first
      const normalizedVenueId = normalizeVenueId(venueId) ?? venueId;

      const { data: venue, error: venueError } = await supabase
        .from("venues")
        .select("venue_name")
        .eq("venue_id", normalizedVenueId)
        .maybeSingle();

      // Venue error handled by error state

      // Upsert style settings
      const { error } = await supabase.from("menu_design_settings").upsert(
        {
          venue_id: venueId,
          venue_name: venue?.venue_name || undefined,
          primary_color: style.detected_primary_color || style.primary_color,
          secondary_color: style.detected_secondary_color || style.secondary_color,
          font_family: style.font_family,
          font_size: style.font_size,
          show_descriptions: style.show_descriptions,
          show_prices: style.show_prices,
          auto_theme_enabled: true,
        },
        {
          onConflict: "venue_id",
        }
      );

      if (!error) {
        toast({
          title: "Menu style extracted",
          description: "Your menu design has been automatically configured from the PDF",
        });
      }
    } catch {
      // Error silently handled
    }
  };

  const hasUrl = menuUrl.trim().length > 0;
  const hasStaged = !!stagedFile;
  const canProcess = hasUrl || hasStaged;

  const runProcessMenu = async () => {
    if (!canProcess) {
      toast({
        title: "Add a source",
        description: "Enter a menu URL and/or upload a file, then click Process menu.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const apiUrl = new URL("/api/catalog/replace", window.location.origin);
      apiUrl.searchParams.set("venueId", venueId);

      const isVisualFile =
        stagedFile && VISUAL_EXT.includes(getFileExtension(stagedFile.name));

      if (isVisualFile || (!stagedFile && hasUrl)) {
        const formData = new FormData();
        formData.append("venue_id", venueId);
        formData.append("replace_mode", String(isReplacing));
        if (hasUrl) formData.append("menu_url", menuUrl.trim());
        if (stagedFile) formData.append("file", stagedFile);

        const modeLabel = stagedFile && hasUrl ? "Hybrid (PDF + URL)" : stagedFile ? "PDF/Image" : "URL";
        toast({
          title: "Processing...",
          description:
            modeLabel === "Hybrid (PDF + URL)"
              ? "Combining file with website data"
              : `Extracting menu (${modeLabel})`,
        });

        const response = await fetch(apiUrl.toString(), {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        if (!response.ok) {
          const errorText = await response.text();
          if (response.status === 401) {
            throw new Error(
              "Authentication failed. Please refresh the page and try again."
            );
          }
          if (response.status === 403) {
            throw new Error(
              "Access denied. You don't have permission to upload menus for this venue."
            );
          }
          if (response.status === 429) {
            throw new Error("Too many requests. Please wait a moment and try again.");
          }
          throw new Error(errorText || `Upload failed: ${response.status}`);
        }

        const result = await response.json();
        if (!result.ok) {
          throw new Error(result.error || "Catalog replacement failed");
        }

        const modeLabels: Record<string, string> = {
          hybrid: "🎯 Hybrid (PDF + URL)",
          "pdf-only": "📄 PDF/Image only",
          "url-only": "🌐 URL only",
        };
        const mode = result.mode || "unknown";
        toast({
          title: isReplacing ? "Menu replaced successfully" : "Menu items combined",
          description: `${modeLabels[mode] || mode} • ${result.items ?? 0} items`,
        });

        if (result.result?.extracted_text) {
          await saveExtractedStyle(result.result.extracted_text);
        }

        if (typeof window !== "undefined") {
          sessionStorage.removeItem(`dashboard_stats_${venueId}`);
          sessionStorage.removeItem(`dashboard_counts_${venueId}`);
          window.dispatchEvent(
            new CustomEvent("menuChanged", {
              detail: { venueId, action: "uploaded", itemCount: result.items ?? 0 },
            })
          );
        }

        setStagedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        onSuccess?.();
        return;
      }

      if (stagedFile) {
        const formData = new FormData();
        formData.append("file", stagedFile);
        formData.append("venue_id", venueId);

        const uploadResponse = await fetch("/api/menu/upload", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        const uploadResult = await uploadResponse.json();

        if (!uploadResponse.ok || !uploadResult?.ok) {
          throw new Error(uploadResult?.error || "Upload failed");
        }

        const processResponse = await fetch("/api/menu/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadId: uploadResult.upload_id }),
          credentials: "include",
        });
        const processResult = await processResponse.json();

        if (!processResponse.ok || !processResult?.ok) {
          throw new Error(processResult?.error || "Processing failed");
        }

        const itemCount = (processResult.items || []).length;
        const hotspotCount = processResult.hotspots_created || 0;
        toast({
          title: "Menu imported successfully",
          description: `${itemCount} items${hotspotCount > 0 ? `, ${hotspotCount} hotspots` : ""}`,
        });
        setStagedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        onSuccess?.();
      }
    } catch (_error) {
      toast({
        title: "Processing failed",
        description: _error instanceof Error ? _error.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setProgress(100);
      setIsProcessing(false);
    }
  };

  const handleStageFile = (file: File | null) => {
    if (!file) {
      setStagedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const err = validateStagedFile(file);
    if (err) {
      toast({ title: "Invalid file", description: err, variant: "destructive" });
      return;
    }
    setStagedFile(file);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleStageFile(file);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    const f = event.dataTransfer.files?.[0];
    if (f) handleStageFile(f);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Menu
        </CardTitle>
        <CardDescription className="text-gray-900">
          Add a menu URL and/or a file (PDF, images, text). Then click Process menu. URL + file
          runs hybrid extraction for better results.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="menu-url-upload">Menu website URL (optional)</Label>
          <Input
            id="menu-url-upload"
            type="url"
            placeholder="https://your-restaurant.com/menu"
            value={menuUrl}
            onChange={(e) => setMenuUrl(e.target.value)}
            disabled={isProcessing}
          />
        </div>

        {/* Replace vs Append Toggle - Only shows if there are existing menu items */}
        {menuItemCount > 0 && (
          <div className="flex items-center space-x-2 p-3 bg-muted rounded-md">
            <Switch
              id="replace-mode"
              checked={isReplacing}
              onCheckedChange={setIsReplacing}
              disabled={isProcessing}
            />
            <Label htmlFor="replace-mode" className="text-sm font-medium cursor-pointer">
              {isReplacing ? "🔄 Replace entire menu" : "➕ Append to existing menu"}
            </Label>
            <p className="text-xs text-muted-foreground ml-auto">
              {isReplacing ? "Deletes old items, uses new menu" : "Keeps old items, adds new ones"}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label>Menu file (optional)</Label>
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isDragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <FileText className="h-8 w-8 mx-auto mb-2 text-gray-900" />
            <p className="text-sm text-gray-900 mb-2">
              Drag and drop or choose a file. Nothing runs until you click Process menu.
            </p>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
            >
              <FileText className="h-4 w-4 mr-2" />
              {stagedFile ? "Change file" : "Choose file"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.txt,.md,.json"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
          {stagedFile && (
            <div className="flex items-center justify-between rounded-md border bg-muted/50 px-3 py-2 text-sm">
              <span className="truncate text-gray-900">{stagedFile.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleStageFile(null)}
                disabled={isProcessing}
                className="shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            PDF, images (.png, .jpg, .webp, .heic), or text (.txt, .md, .json)
          </p>
        </div>

        {isProcessing && <Progress value={progress} className="h-2" />}
        <Button
          onClick={runProcessMenu}
          disabled={!canProcess || isProcessing}
          className="w-full"
        >
          {isProcessing ? "Processing…" : "Process menu"}
        </Button>

        {recentUploads.length > 0 && (
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">Recent uploads</Label>
            <ul className="text-xs text-muted-foreground space-y-1">
              {recentUploads.map((u) => (
                <li key={u.id}>
                  {u.filename ? (
                    <span className="truncate block" title={u.filename}>
                      {u.filename.split("/").pop() ?? u.filename}
                    </span>
                  ) : null}
                  <span className="text-muted-foreground/80">
                    {" "}
                    {new Date(u.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-gray-900">
            <p>
              Add a URL and/or a file in any order, then click Process menu. PDF + URL runs
              hybrid extraction (structure from PDF, images and descriptions from the site).
            </p>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
