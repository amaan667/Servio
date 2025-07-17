"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { LinkIcon, Upload, FileText, Loader2, CheckCircle, X, AlertCircle } from "lucide-react"
import { supabase, hasSupabaseConfig, type MenuItem } from "@/lib/supabase"

// Use dynamic import for extractMenu only in Node.js environments
let extractMenu: any = null;
let ExtractedMenuItem: any = null;
if (typeof window === "undefined") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("../../../scripts/extract-menu");
    extractMenu = mod.extractMenu;
    ExtractedMenuItem = mod.ExtractedMenuItem;
  } catch (e) {
    // Not available in client build
  }
}

interface MenuUploadProps {
  venueId: string
  onMenuUpdate: (items: MenuItem[]) => void
}

// Helper function to compress image files
const compressImage = (file: File, maxSizeKB: number = 800): Promise<File> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      resolve(file); // Don't compress non-images
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Calculate new dimensions to reduce file size
      let { width, height } = img;
      const maxDimension = 1200; // Max width/height
      
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = (height * maxDimension) / width;
          width = maxDimension;
        } else {
          width = (width * maxDimension) / height;
          height = maxDimension;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);

      // Try different quality levels to get under the size limit
      const tryCompress = (quality: number) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Failed to compress image'));
            return;
          }

          const sizeKB = blob.size / 1024;
          if (sizeKB <= maxSizeKB || quality <= 0.1) {
            // Create a new file with the compressed blob
            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: file.lastModified,
            });
            resolve(compressedFile);
          } else {
            // Try with lower quality
            tryCompress(quality - 0.1);
          }
        }, file.type, quality);
      };

      tryCompress(0.8); // Start with 80% quality
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};

// Helper function to check and warn about file size
const checkFileSize = (file: File): { isValid: boolean; message: string } => {
  const fileSizeMB = file.size / (1024 * 1024);
  
  if (fileSizeMB > 10) {
    return { 
      isValid: false, 
      message: "File is too large (over 10MB). Please use a smaller file." 
    };
  }
  
  if (fileSizeMB > 1) {
    return { 
      isValid: true, 
      message: `File is ${fileSizeMB.toFixed(1)}MB. OCR.space has a 1MB limit for free tier. Consider upgrading to paid plan or using a smaller file.` 
    };
  }
  
  return { isValid: true, message: "" };
};

export function MenuUpload({ venueId, onMenuUpdate }: MenuUploadProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error">("idle")
  const [uploadProgress, setUploadProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState("")
  const [menuUrl, setMenuUrl] = useState("")
  const [menuText, setMenuText] = useState("")
  const [extractedItems, setExtractedItems] = useState<MenuItem[]>([])

  const simulateProgress = (duration: number) => {
    setUploadProgress(0)
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 95) {
          clearInterval(interval)
          return 95
        }
        return prev + Math.random() * 15
      })
    }, duration / 20)
    return interval
  }

  const parseMenuFromText = (text: string): MenuItem[] => {
    const lines = text.split("\n").filter((line) => line.trim())
    const items: MenuItem[] = []
    let currentCategory = "Main Menu"

    for (const line of lines) {
      const trimmedLine = line.trim()

      // Check if line is a category (usually in caps or has specific keywords)
      if (trimmedLine.match(/^[A-Z\s&]+$/) && trimmedLine.length > 3 && trimmedLine.length < 30) {
        currentCategory = trimmedLine
        continue
      }

      // Try to extract item with price
      const priceMatch = trimmedLine.match(/(.+?)[\s.-]+£?(\d+\.?\d*)\s*$/)
      if (priceMatch) {
        const [, name, priceStr] = priceMatch
        const cleanName = name.replace(/^\d+\.?\s*/, "").trim()
        const price = Number.parseFloat(priceStr)

        if (cleanName && price > 0) {
          items.push({
            id: `extracted-${Date.now()}-${Math.random()}`,
            venue_id: venueId,
            name: cleanName,
            description: "",
            price: price,
            category: currentCategory,
            available: true,
            created_at: new Date().toISOString(),
          })
        }
      }
    }

    return items
  }

  const extractMenuFromWebsite = async (url: string): Promise<MenuItem[]> => {
    const res = await fetch("/api/upload-menu-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const result = await res.json();
    if (!res.ok || result.error) {
      throw new Error(result.error || "Failed to extract menu from website.");
    }
    return (result.items || []).map((item: any) => ({
      ...item,
      id: `web-${Date.now()}-${Math.random()}`,
      venue_id: venueId,
      available: true,
      created_at: new Date().toISOString(),
    }));
  };

  const extractMenuFromPDF = async (file: File): Promise<MenuItem[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result?.toString().split(",")[1];
        const res = await fetch("/api/upload-menu-file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64, mimetype: file.type }),
        });
        const result = await res.json();
        if (!res.ok || result.error) {
          setUploadStatus("error");
          setStatusMessage(result.error || "Failed to process file.");
          setIsLoading(false);
          reject(new Error(result.error || "Failed to process file."));
          return;
        }
        setExtractedItems(result.items);
        setUploadStatus("success");
        setStatusMessage(`Successfully extracted ${result.items.length} menu items!`);
        setIsLoading(false);
        resolve((result.items || []).map((item: any) => ({
          ...item,
          id: `extracted-${Date.now()}-${Math.random()}`,
          venue_id: venueId,
          available: true,
          created_at: new Date().toISOString(),
        })));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleUrlUpload = async () => {
    if (!menuUrl.trim()) return

    setIsLoading(true)
    setUploadStatus("idle")
    setStatusMessage("Analyzing website content...")

    const progressInterval = simulateProgress(3000)

    try {
      const items = await extractMenuFromWebsite(menuUrl.trim())
      setUploadProgress(100)
      setExtractedItems(items)
      setUploadStatus("success")
      setStatusMessage(`Successfully extracted ${items.length} menu items from website!`)
    } catch (error) {
      setUploadStatus("error")
      setStatusMessage("Failed to extract menu from website. Please try a different URL or upload manually.")
    } finally {
      clearInterval(progressInterval)
      setIsLoading(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size first
    const sizeCheck = checkFileSize(file);
    if (!sizeCheck.isValid) {
      setUploadStatus("error");
      setStatusMessage(sizeCheck.message);
      return;
    }

    // Warn about large files but allow them to proceed
    if (sizeCheck.message) {
      setStatusMessage(sizeCheck.message);
    }

    setIsLoading(true);
    setUploadStatus("idle");
    setStatusMessage("Processing your menu file...");

    try {
      // Check file size and compress if needed
      const fileSizeKB = file.size / 1024;
      let processedFile = file;
      if (fileSizeKB > 800 && file.type.startsWith('image/')) {
        setStatusMessage("File is large, compressing for better processing...");
        processedFile = await compressImage(file, 800);
      }

      // Prepare FormData for upload
      const formData = new FormData();
      formData.append("menu", processedFile);
      formData.append("venueId", venueId);

      const res = await fetch("/api/upload-menu", {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      if (!res.ok || result.error) {
        setUploadStatus("error");
        setStatusMessage(result.error || "Failed to process file.");
        setIsLoading(false);
        return;
      }
      setExtractedItems(result.items || []);
      setUploadStatus("success");
      setStatusMessage(`Successfully extracted ${result.items?.length || 0} menu items!`);
      setIsLoading(false);
      // Optionally trigger a menu refresh in parent
      if (onMenuUpdate) onMenuUpdate(result.items || []);
    } catch (error) {
      setUploadStatus("error");
      setStatusMessage("Failed to process file. Please try a smaller file or different format.");
      setIsLoading(false);
    }
  };

  const handleTextUpload = async () => {
    if (!menuText.trim()) return

    setIsLoading(true)
    setUploadStatus("idle")
    setStatusMessage("Processing menu text...")

    const progressInterval = simulateProgress(2000)

    try {
      const items = parseMenuFromText(menuText)
      setUploadProgress(100)
      setExtractedItems(items)
      setUploadStatus("success")
      setStatusMessage(`Successfully extracted ${items.length} menu items from text!`)
    } catch (error) {
      setUploadStatus("error")
      setStatusMessage("Failed to process text. Please check the format and try again.")
    } finally {
      clearInterval(progressInterval)
      setIsLoading(false)
    }
  }

  const saveExtractedItems = async () => {
    if (extractedItems.length === 0) return

    try {
      // Save to backend API for server-side insert (bypasses RLS)
      const res = await fetch("/api/extract-menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: extractedItems, venue_id: venueId }),
      })
      const result = await res.json()
      if (!res.ok || result.error) {
        setUploadStatus("error")
        setStatusMessage(result.error || "Failed to save menu items. Please try again.")
        return
      }
      // Also save to localStorage as backup
      const storageKey = `servio-menu-${venueId}`
      const existingMenu = JSON.parse(localStorage.getItem(storageKey) || "[]")
      const updatedMenu = [...existingMenu, ...extractedItems]
      localStorage.setItem(storageKey, JSON.stringify(updatedMenu))

      onMenuUpdate(extractedItems)
      setExtractedItems([])
      setUploadStatus("idle")
      setStatusMessage("")
    } catch (error) {
      console.error("Error saving menu items:", error)
      setUploadStatus("error")
      setStatusMessage("Failed to save menu items. Please try again.")
    }
  }

  const removeExtractedItem = (itemId: string) => {
    setExtractedItems((items) => items.filter((item) => item.id !== itemId))
  }

  const updateExtractedItem = (itemId: string, updates: Partial<MenuItem>) => {
    setExtractedItems((items) => items.map((item) => (item.id === itemId ? { ...item, ...updates } : item)))
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Your Menu</CardTitle>
          <CardDescription>
            Import your menu from various sources. We'll automatically extract and organize your items.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="url" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="url">Website URL</TabsTrigger>
              <TabsTrigger value="file">PDF/Image Upload</TabsTrigger>
              <TabsTrigger value="text">Text Input</TabsTrigger>
            </TabsList>

            <TabsContent value="url" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="menu-url">Menu Website URL</Label>
                <div className="flex space-x-2">
                  <Input
                    id="menu-url"
                    placeholder="https://your-restaurant.com/menu"
                    value={menuUrl}
                    onChange={(e) => setMenuUrl(e.target.value)}
                    disabled={isLoading}
                  />
                  <Button onClick={handleUrlUpload} disabled={isLoading || !menuUrl.trim()}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
                    Extract
                  </Button>
                </div>
                <p className="text-sm text-gray-500">
                  Paste a link to your online menu and we'll automatically extract the items.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="file" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="menu-file">Upload Menu File</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                  <Input
                    id="menu-file"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileUpload}
                    disabled={isLoading}
                    className="hidden"
                  />
                  <label htmlFor="menu-file" className="cursor-pointer">
                    <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">Click to upload or drag and drop</p>
                    <p className="text-xs text-gray-500 mt-1">PDF, JPG, PNG up to 1MB (free OCR limit)</p>
                    <p className="text-xs text-orange-600 mt-1">Large files? Try the Text Input tab instead</p>
                  </label>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    <strong>File Size Limits:</strong>
                  </p>
                  <ul className="text-xs text-blue-700 mt-1 space-y-1">
                    <li>• Free OCR: 1MB max (PDF, images)</li>
                    <li>• Large files: Use Text Input tab</li>
                    <li>• Images: Auto-compressed if needed</li>
                    <li>• PDFs: Consider upgrading OCR plan</li>
                  </ul>
                </div>
                <p className="text-sm text-gray-500">
                  Upload a PDF menu or image. We'll use OCR to extract items automatically.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="text" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="menu-text">Menu Text</Label>
                <Textarea
                  id="menu-text"
                  placeholder={`Paste your menu text here, for example:

STARTERS
Soup of the Day - £4.95
Garlic Bread - £3.50

MAIN COURSES  
Fish & Chips - £12.95
Chicken Curry - £11.50`}
                  value={menuText}
                  onChange={(e) => setMenuText(e.target.value)}
                  rows={8}
                  disabled={isLoading}
                />
                <Button onClick={handleTextUpload} disabled={isLoading || !menuText.trim()}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  Process Text
                </Button>
                <p className="text-sm text-gray-500">
                  Copy and paste your menu text. Include prices (£X.XX) for automatic extraction.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {isLoading && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-gray-600">{statusMessage}</span>
              </div>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          )}

          {uploadStatus === "success" && (
            <Alert className="mt-4 border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">{statusMessage}</AlertDescription>
            </Alert>
          )}

          {uploadStatus === "error" && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{statusMessage}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {extractedItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Review Extracted Items ({extractedItems.length})</CardTitle>
            <CardDescription>Review and edit the extracted menu items before adding them to your menu.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {extractedItems.map((item) => (
                <div key={item.id} className="border rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs text-gray-500">Item Name</Label>
                      <Input
                        value={item.name}
                        onChange={(e) => updateExtractedItem(item.id, { name: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Category</Label>
                      <Input
                        value={item.category}
                        onChange={(e) => updateExtractedItem(item.id, { category: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Price (£)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.price}
                        onChange={(e) =>
                          updateExtractedItem(item.id, { price: Number.parseFloat(e.target.value) || 0 })
                        }
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Description</Label>
                    <Input
                      value={item.description || ""}
                      onChange={(e) => updateExtractedItem(item.id, { description: e.target.value })}
                      placeholder="Add a description..."
                      className="mt-1"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeExtractedItem(item.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center mt-6 pt-4 border-t">
              <p className="text-sm text-gray-600">{extractedItems.length} items ready to be added to your menu</p>
              <div className="space-x-2">
                <Button variant="outline" onClick={() => setExtractedItems([])}>
                  Cancel
                </Button>
                <Button onClick={saveExtractedItems} className="bg-servio-purple hover:bg-servio-purple-dark">
                  Add {extractedItems.length} Items to Menu
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
