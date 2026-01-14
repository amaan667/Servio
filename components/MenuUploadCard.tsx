"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FileText, Upload, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabaseBrowser as createClient } from "@/lib/supabase";

interface MenuUploadCardProps {
  venueId: string;
  onSuccess?: () => void;
  menuItemCount?: number; // Pass current menu item count to determine if toggle should show
}

export function MenuUploadCard({ venueId, onSuccess, menuItemCount = 0 }: MenuUploadCardProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReplacing, setIsReplacing] = useState(true); // Default to replace mode
  const [isDragOver, setIsDragOver] = useState(false);
  const [hasExistingUpload, setHasExistingUpload] = useState(false);
  const [menuUrl, setMenuUrl] = useState(""); // Add URL input for hybrid import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const supabase = createClient();

  // Check if venue has existing menu items (not uploads)
  useEffect(() => {
    const checkExistingItems = async () => {
      try {
        // Normalize venueId format
        const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;

        // Use a simple query to check if any items exist - avoid limit(1) with count to prevent 406 errors
        // Just get the count without fetching data
        const { count, error } = await supabase
          .from("menu_items")
          .select("*", { count: "exact", head: true }) // head: true means we only get count, not data
          .eq("venue_id", normalizedVenueId);

        // Use count to determine if items exist (more reliable than data.length)
        if (count && count > 0 && !error) {
          setHasExistingUpload(true);
        } else {
          setHasExistingUpload(false);
        }
      } catch (err) {
        // No existing items
        setHasExistingUpload(false);
      }
    };

    checkExistingItems();
  }, [venueId, supabase]);

  // Save extracted style to database
  const saveExtractedStyle = async (extractedText: string) => {
    try {
      // Import the style extractor
      const { extractStyleFromPDF } = await import("@/lib/menu-style-extractor");

      // Extract style from text
      const style = extractStyleFromPDF(extractedText);

      // Get venue name - normalize venueId first
      const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;

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

  const processFile = async (file: File) => {
    // CRITICAL LOG: PDF upload started

    if (!file) {
      return;
    }

    // Validate file type (now accepts common image formats)
    const validTypes = [".txt", ".md", ".json", ".pdf", ".png", ".jpg", ".jpeg", ".webp", ".heic"];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf("."));

    if (!validTypes.includes(fileExtension)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a .txt, .md, .json, or .pdf file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 10MB for PDF/images, 1MB for text files)
    const maxSize =
      fileExtension === ".pdf" ||
      [".png", ".jpg", ".jpeg", ".webp", ".heic"].includes(fileExtension)
        ? 10 * 1024 * 1024
        : 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: `Please upload a file smaller than ${fileExtension === ".pdf" ? "10MB" : "1MB"}`,
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      if (fileExtension === ".pdf") {
        // Use catalog replace endpoint
        const formData = new FormData();
        formData.append("file", file);
        formData.append("venue_id", venueId);
        formData.append("replace_mode", String(isReplacing)); // Send replace/append mode

        // Also add venueId as query param to avoid body reading issues
        const url = new URL("/api/catalog/replace", window.location.origin);
        url.searchParams.set("venueId", venueId);

        // Add menu URL if provided (for hybrid import)
        const hasUrl = menuUrl && menuUrl.trim();
        if (hasUrl) {
          formData.append("menu_url", menuUrl.trim());

          toast({
            title: "Hybrid extraction starting...",
            description: "Combining PDF structure with website images and data",
          });
        } else {
          // No URL provided - just do PDF extraction
          toast({
            title: "PDF extraction starting...",
            description: "Processing PDF menu. Add URL later for hybrid enhancement.",
          });
        }

        const response = await fetch(url.toString(), {
          method: "POST",
          body: formData,
          credentials: "include", // Ensure cookies are sent
        });

        if (!response.ok) {
          const errorText = await response.text();

          // Provide helpful error messages for common issues
          if (response.status === 401) {
            throw new Error("Authentication failed. Please refresh the page and try again. If the issue persists, try logging out and back in.");
          } else if (response.status === 403) {
            throw new Error("Access denied. You don't have permission to upload menus for this venue.");
          } else if (response.status === 429) {
            throw new Error("Too many requests. Please wait a moment and try again.");
          }

          throw new Error(`Upload failed: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        // CRITICAL LOG: PDF upload API response

        if (result.ok) {
          const mode = result.mode || "unknown";
          const modeLabels: Record<string, string> = {
            hybrid: "🎯 Hybrid (PDF + URL)",
            "pdf-only": "📄 PDF Only",
            "url-only": "🌐 URL Only",
          };

          // CRITICAL LOG: PDF upload success

          toast({
            title: isReplacing ? "Menu replaced successfully" : "Menu items combined successfully",
            description: `${modeLabels[mode] || mode} • ${result.items || 0} items${result.mode === "hybrid" ? " • Images from URL added" : ""}${!isReplacing ? " • Enhanced with better data" : ""}`,
          });

          // Save extracted style to database if available
          if (result.result?.extracted_text) {
            await saveExtractedStyle(result.result.extracted_text);
          }

          // Clear dashboard cache to force fresh count after upload
          if (typeof window !== "undefined" && venueId) {
            sessionStorage.removeItem(`dashboard_stats_${venueId}`);
            sessionStorage.removeItem(`dashboard_counts_${venueId}`);

            // Dispatch custom event to trigger dashboard refresh
            window.dispatchEvent(
              new CustomEvent("menuChanged", {
                detail: { venueId, action: "uploaded", itemCount: result.items || 0 },
              })
            );
          }

          onSuccess?.();
        } else {
          throw new Error(`Catalog replacement failed: ${result.error}`);
        }
      } else {
        // Unified processing for all file types (PDFs, images, text)
        // Step 1: Upload file to storage
        const formData = new FormData();
        formData.append("file", file);
        formData.append("venue_id", venueId);

        const uploadResponse = await fetch("/api/menu/upload", {
          method: "POST",
          body: formData,
          credentials: "include", // Ensure cookies are sent
        });

        const uploadResult = await uploadResponse.json();

        if (!uploadResponse.ok || !uploadResult?.ok) {
          throw new Error(uploadResult?.error || "Upload failed");
        }

        // Step 2: Process with GPT-4o Vision (auto-creates hotspots)
        const processResponse = await fetch("/api/menu/process", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ uploadId: uploadResult.upload_id }),
          credentials: "include", // Ensure cookies are sent
        });

        const processResult = await processResponse.json();

        if (!processResponse.ok || !processResult?.ok) {
          throw new Error(processResult?.error || "Processing failed");
        }

        const itemCount = (processResult.items || []).length;
        const hotspotCount = processResult.hotspots_created || 0;

        toast({
          title: "Menu imported successfully",
          description: `${itemCount} items extracted${hotspotCount > 0 ? `, ${hotspotCount} hotspots created` : ""}`,
        });

        onSuccess?.();
      }
    } catch (_error) {
      toast({
        title: "Upload failed",
        description: _error instanceof Error ? _error.message : "Upload failed",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const handleProcessWithUrl = async () => {
    // CRITICAL LOG: Hybrid merge with URL started

    if (!menuUrl || !menuUrl.trim()) {
      toast({
        title: "No URL provided",
        description: "Please enter a menu URL first",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Normalize venueId format
      const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;

      // Check if PDF menu exists (check menu_uploads, not menu_items)
      const { data: uploadData, error: uploadError } = await supabase
        .from("menu_uploads")
        .select("id, pdf_images")
        .eq("venue_id", normalizedVenueId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!uploadData || !uploadData.pdf_images || uploadData.pdf_images.length === 0) {
        throw new Error("No existing PDF menu found. Please upload a PDF first.");
      }

      // Call hybrid merge API

      const response = await fetch("/api/menu/hybrid-merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueId: normalizedVenueId,
          menuUrl: menuUrl.trim(),
        }),
        credentials: "include", // Ensure cookies are sent
      });

      if (!response.ok) {
        const errorText = await response.text();

        // Provide helpful error messages for common issues
        if (response.status === 401) {
          throw new Error("Authentication failed. Please refresh the page and try again. If the issue persists, try logging out and back in.");
        } else if (response.status === 403) {
          throw new Error("Access denied. You don't have permission to enhance menus for this venue.");
        } else if (response.status === 429) {
          throw new Error("Too many requests. Please wait a moment and try again.");
        }

        // Try to parse as JSON for better error messages
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || `Processing failed: ${response.status}`);
        } catch {
          throw new Error(`Processing failed: ${response.status} - ${errorText}`);
        }
      }

      const result = await response.json();

      if (result.ok) {
        // CRITICAL LOG: Hybrid merge success

        toast({
          title: "🎉 Menu Enhanced Successfully!",
          description: `${result.items || 0} items created using hybrid extraction (PDF + URL)`,
          duration: 7000,
        });

        // Clear dashboard cache and dispatch event
        if (typeof window !== "undefined") {
          sessionStorage.removeItem(`dashboard_stats_${venueId}`);
          sessionStorage.removeItem(`dashboard_counts_${venueId}`);
          window.dispatchEvent(
            new CustomEvent("menuChanged", {
              detail: { venueId, action: "hybrid-merged", itemCount: result.items || 0 },
            })
          );
        }

        // Refresh menu items
        await new Promise((resolve) => setTimeout(resolve, 500));
        onSuccess?.();
      }
    } catch (_error) {
      toast({
        title: "Hybrid Merge Failed",
        description: _error instanceof Error ? _error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);

    const files = event.dataTransfer.files;
    if (files.length > 0) {
      await processFile(files[0]);
    }
  };

  const handleUrlOnlyImport = async () => {
    if (!menuUrl || !menuUrl.trim()) {
      toast({
        title: "URL required",
        description: "Please enter a menu URL",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Call catalog/replace with URL only (no file)
      const formData = new FormData();
      formData.append("venue_id", venueId);
      formData.append("menu_url", menuUrl.trim());
      formData.append("replace_mode", String(isReplacing));

      const response = await fetch("/api/catalog/replace", {
        method: "POST",
        body: formData,
        credentials: "include", // Ensure cookies are sent
      });

      if (!response.ok) {
        const errorText = await response.text();

        // Provide helpful error messages for common issues
        if (response.status === 401) {
          throw new Error("Authentication failed. Please refresh the page and try again. If the issue persists, try logging out and back in.");
        } else if (response.status === 403) {
          throw new Error("Access denied. You don't have permission to import menus for this venue.");
        } else if (response.status === 429) {
          throw new Error("Too many requests. Please wait a moment and try again.");
        }

        // Try to parse as JSON for better error messages
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || "URL import failed");
        } catch {
          throw new Error(`Import failed: ${response.status} - ${errorText}`);
        }
      }

      const result = await response.json();

      if (result.ok) {
        toast({
          title: "URL import successful",
          description: `Extracted ${result.items || 0} items from ${menuUrl}`,
        });
        setMenuUrl(""); // Clear URL after successful import
        onSuccess?.();
      } else {
        throw new Error(result.error || "URL import failed");
      }
    } catch (error) {

      toast({
        title: "URL import failed",
        description: error instanceof Error ? error.message : "Failed to import from URL",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Menu
        </CardTitle>
        <CardDescription className="text-gray-900">
          Add your menu URL (if available), then upload your PDF. Both sources will be combined
          using AI for perfect menu extraction.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Menu URL for Enhanced Matching */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="menu-url-upload">Menu Website URL (Optional)</Label>
            {menuUrl && menuUrl.trim() && (
              <Badge className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
                🎯 Hybrid Mode Ready
              </Badge>
            )}
          </div>
          <Input
            id="menu-url-upload"
            type="url"
            placeholder="https://yourmenu.co.uk/menu"
            value={menuUrl}
            onChange={(e) => setMenuUrl(e.target.value)}
            disabled={isProcessing}
          />
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground flex-1">
              {menuUrl && menuUrl.trim()
                ? hasExistingUpload
                  ? "🎯 Click 'Enhance with URL' to combine PDF with website data"
                  : "🌐 Click 'Import from URL' to extract menu from website"
                : "💡 Add URL for hybrid extraction (combines PDF + website data)"}
            </p>
            {menuUrl && menuUrl.trim() && (
              <Button
                onClick={hasExistingUpload ? handleProcessWithUrl : handleUrlOnlyImport}
                disabled={isProcessing}
                size="sm"
                className={hasExistingUpload ? "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700" : ""}
                variant={hasExistingUpload ? "default" : "outline"}
              >
                {isProcessing
                  ? "Processing..."
                  : hasExistingUpload
                    ? "🎯 Enhance with URL (Hybrid)"
                    : "🌐 Import from URL"
                }
              </Button>
            )}
          </div>
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
          <Label>Upload PDF Menu</Label>
          {/* Drag and Drop Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isDragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <FileText className="h-8 w-8 mx-auto mb-2 text-gray-900" />
            <p className="text-sm text-gray-900 mb-2">Drag and drop your menu PDF here, or</p>
            {menuUrl && (
              <p className="text-xs text-muted-foreground mb-2">
                Will combine with URL data for best results
              </p>
            )}
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
            >
              <FileText className="h-4 w-4 mr-2" />
              {isProcessing ? "Processing..." : "Choose PDF"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md,.json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          <div className="text-sm text-gray-900">
            Supported formats: PDF (max 10MB), TXT, MD, JSON (max 1MB)
          </div>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-gray-900">
            <p>For best results, ensure your PDF has clear, readable text and good contrast.</p>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
