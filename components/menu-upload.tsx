"use client";

import type React from "react";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  LinkIcon,
  Upload,
  FileText,
  Loader2,
  CheckCircle,
  X,
  AlertCircle,
} from "lucide-react";
import { supabase, hasSupabaseConfig, type MenuItem } from "@/lib/supabase";

// Removed old extract-menu script dependency - now using local OCR

interface MenuUploadProps {
  venueId: string;
  onMenuUpdate: (items: MenuItem[]) => void;
}

// Helper function to compress image files
const compressImage = (file: File, maxSizeKB: number = 800): Promise<File> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      resolve(file); // Don't compress non-images
      return;
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
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
        canvas.toBlob(
          (blob) => {
          if (!blob) {
              reject(new Error("Failed to compress image"));
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
          },
          file.type,
          quality,
        );
      };

      tryCompress(0.8); // Start with 80% quality
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
};

// Helper function to check and warn about file size
const checkFileSize = (file: File): { isValid: boolean; message: string } => {
  const fileSizeMB = file.size / (1024 * 1024);
  
  if (fileSizeMB > 10) {
    return { 
      isValid: false, 
      message: "File is too large (over 10MB). Please use a smaller file.",
    };
  }
  
  if (fileSizeMB > 1) {
    return { 
      isValid: true, 
      message: `File is ${fileSizeMB.toFixed(1)}MB. OCR.space has a 1MB limit for free tier. Consider upgrading to paid plan or using a smaller file.`,
    };
  }
  
  return { isValid: true, message: "" };
};

export function MenuUpload({ venueId, onMenuUpdate }: MenuUploadProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");
  const [extractedItems, setExtractedItems] = useState<MenuItem[]>([]);

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setExtractedItems([]);
    setError("");
    setStatusMessage("");

    const formData = new FormData();
    formData.append("menu", file);
    formData.append("venueId", venueId);

    try {
      const res = await fetch("/api/upload-menu", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      console.log("API response:", data);
      if (data.menuItems && Array.isArray(data.menuItems) && data.menuItems.length) {
        setExtractedItems(data.menuItems);
        setStatusMessage(`Successfully extracted ${data.menuItems.length} menu items!`);
        setError("");
        if (onMenuUpdate) onMenuUpdate(data.menuItems);
      } else if (data.error) {
        setError("Menu extraction error: " + data.error);
        setStatusMessage("");
        setExtractedItems([]);
      } else {
        setError("Unknown server response");
        setStatusMessage("");
        setExtractedItems([]);
      }
    } catch (err: any) {
      setError("Upload failed: " + err.message);
      setStatusMessage("");
      setExtractedItems([]);
    }
    setIsLoading(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Your Menu</CardTitle>
          <CardDescription>
            Import your menu by uploading a PDF file. Only PDF menus are supported for automatic extraction.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="menu-file">Upload Menu PDF</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                <Input
                  id="menu-file"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  disabled={isLoading}
                  className="hidden"
                />
                <label htmlFor="menu-file" className="cursor-pointer">
                  <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    PDF only, up to 10MB
                  </p>
                </label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading && <p>Processing menu…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!isLoading && !error && (
        <pre style={{maxHeight: 200, overflow: 'auto', background: '#eee', fontSize: 12}}>
          {JSON.stringify(extractedItems, null, 2)}
        </pre>
      )}
      {!isLoading && !error && extractedItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Extracted Menu Items ({extractedItems.length})
            </CardTitle>
            <CardDescription>
              Review the extracted menu items below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Price</th>
                    <th>Category</th>
                  </tr>
                </thead>
                <tbody>
                  {extractedItems.map((item, i) => (
                    <tr key={i}>
                      <td>{item.name || ''}</td>
                      <td>{item.description || ''}</td>
                      <td>{item.price ?? ''}</td>
                      <td>{item.category || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
      {!isLoading && !error && extractedItems.length === 0 && (
        <p>No menu items found.</p>
      )}
    </div>
  );
}
