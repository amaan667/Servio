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
  FileCheck,
  FileX,
  Database,
  Settings,
} from "lucide-react";
import { supabase, hasSupabaseConfig, type MenuItem } from "@/lib/supabase";

interface MenuUploadProps {
  venueId: string;
  onMenuUpdate: (items: MenuItem[]) => void;
}

// === MENU UPLOAD FLOW ===
// Stage 1: File Selection & Validation
interface FileValidationResult {
  isValid: boolean;
  message: string;
  file?: File;
}

function validateFile(file: File): FileValidationResult {
  // Check file type
  if (!file.type.includes('pdf')) {
    return {
      isValid: false,
      message: "Please select a PDF file. Only PDF menus are supported."
    };
  }

  // Check file size (10MB limit)
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
      file,
      message: `File is ${fileSizeMB.toFixed(1)}MB. Large files may take longer to process.`
    };
  }

  return {
    isValid: true,
    file,
    message: "File validated successfully."
  };
}

// Stage 2: File Upload & Processing
interface UploadProgress {
  stage: 'uploading' | 'processing' | 'extracting' | 'cleaning' | 'complete' | 'error';
  message: string;
  progress: number;
}

// Stage 3: Menu Items Extraction & Validation
interface ExtractionResult {
  success: boolean;
  menuItems: MenuItem[];
  error?: string;
  warnings?: string[];
  ocrText?: string;
  chunkErrors?: any[];
}

// Stage 4: Database Integration (Future Enhancement)
interface DatabaseResult {
  success: boolean;
  savedCount: number;
  error?: string;
}

export function MenuUpload({ venueId, onMenuUpdate }: MenuUploadProps) {
  // State management following order flow structure
  const [currentStage, setCurrentStage] = useState<'idle' | 'uploading' | 'processing' | 'extracting' | 'cleaning' | 'saving' | 'complete' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    stage: 'uploading',
    message: '',
    progress: 0
  });
  const [extractedItems, setExtractedItems] = useState<MenuItem[]>([]);
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [databaseResult, setDatabaseResult] = useState<DatabaseResult | null>(null);
  const [error, setError] = useState<string>('');
  const [warnings, setWarnings] = useState<string[]>([]);

  // Stage 1: File Selection & Validation
  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCurrentStage('uploading');
    setError('');
    setWarnings([]);
    setExtractedItems([]);
    setExtractionResult(null);
    setDatabaseResult(null);

    const validation = validateFile(file);
    if (!validation.isValid) {
      setError(validation.message);
      setCurrentStage('error');
      return;
    }

    if (validation.message !== "File validated successfully.") {
      setWarnings([validation.message]);
    }

    // Proceed to upload
    handleFileUpload(file);
  };

  // Stage 2: File Upload & Processing
  const handleFileUpload = async (file: File) => {
    setUploadProgress({
      stage: 'uploading',
      message: 'Uploading PDF file...',
      progress: 10
    });

    const formData = new FormData();
    formData.append("menu", file);
    formData.append("venueId", venueId);

    try {
      setUploadProgress({
        stage: 'processing',
        message: 'Processing PDF with OCR...',
        progress: 30
      });

      const res = await fetch("/api/upload-menu", {
        method: "POST",
        body: formData,
      });

      setUploadProgress({
        stage: 'extracting',
        message: 'Extracting menu items...',
        progress: 60
      });

      const data = await res.json();
      console.log("API response:", data);

      if (data.menuItems && Array.isArray(data.menuItems) && data.menuItems.length > 0) {
        // Stage 3: Menu Items Extraction & Validation
        const result: ExtractionResult = {
          success: true,
          menuItems: data.menuItems,
          ocrText: data.ocrText,
          chunkErrors: data.chunkErrors,
          warnings: data.chunkErrors && data.chunkErrors.length > 0 
            ? [`${data.chunkErrors.length} chunks had processing errors`] 
            : []
        };

        setExtractionResult(result);
        setExtractedItems(data.menuItems);
        
        setUploadProgress({
          stage: 'cleaning',
          message: 'Cleaning and validating menu items...',
          progress: 80
        });

        // Stage 4: Database Integration (Future Enhancement)
        setCurrentStage('saving');
        setUploadProgress({
          stage: 'complete',
          message: 'Menu extraction complete!',
          progress: 100
        });

        const dbResult: DatabaseResult = {
          success: true,
          savedCount: data.menuItems.length
        };
        setDatabaseResult(dbResult);

        setCurrentStage('complete');
        
        if (onMenuUpdate) {
          onMenuUpdate(data.menuItems);
        }

      } else if (data.error) {
        throw new Error(data.error);
      } else {
        throw new Error('Unknown server response');
      }

    } catch (err: any) {
      setError("Upload failed: " + err.message);
      setCurrentStage('error');
      setUploadProgress({
        stage: 'error',
        message: 'Upload failed',
        progress: 0
      });
    }
  };

  // Filter out items with missing or obviously bad price/category
  const filteredItems = extractedItems.filter(
    item =>
      item.name &&
      item.price !== null &&
      item.price !== undefined &&
      (typeof item.price !== 'string' || item.price !== '') &&
      !["n/a", "na", "none", "-", "unknown"].includes(
        String(item.price).toLowerCase()
      )
  );
  const filteredOutCount = extractedItems.length - filteredItems.length;

  // Reset function
  const resetUpload = () => {
    setCurrentStage('idle');
    setUploadProgress({
      stage: 'uploading',
      message: '',
      progress: 0
    });
    setExtractedItems([]);
    setExtractionResult(null);
    setDatabaseResult(null);
    setError('');
    setWarnings([]);
  };

  return (
    <div className="space-y-6">
      {/* Stage 1: File Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Your Menu
          </CardTitle>
          <CardDescription>
            Import your menu by uploading a PDF file. Only PDF menus are supported for automatic extraction.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="menu-file">Upload Menu PDF</Label>
              <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                currentStage === 'idle' 
                  ? 'border-gray-300 hover:border-gray-400' 
                  : 'border-blue-300 bg-blue-50'
              }`}>
                <Input
                  id="menu-file"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelection}
                  disabled={currentStage !== 'idle'}
                  className="hidden"
                />
                <label htmlFor="menu-file" className={`cursor-pointer ${currentStage !== 'idle' ? 'pointer-events-none' : ''}`}>
                  {currentStage === 'idle' ? (
                    <>
                      <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        PDF only, up to 10MB
                      </p>
                    </>
                  ) : (
                    <>
                      <Loader2 className="h-8 w-8 mx-auto text-blue-500 mb-2 animate-spin" />
                      <p className="text-sm text-blue-600 font-medium">
                        {uploadProgress.message}
                      </p>
                      <Progress value={uploadProgress.progress} className="mt-2" />
                    </>
                  )}
                </label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Warnings Display */}
      {warnings.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {warnings.map((warning, index) => (
              <div key={index}>{warning}</div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {/* Stage 3: Extraction Results */}
      {extractionResult && extractionResult.success && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-green-500" />
              Extraction Results
            </CardTitle>
            <CardDescription>
              Menu items extracted successfully. Review and save to database.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="font-bold text-green-600">{filteredItems.length}</div>
                  <div className="text-gray-600">Valid Items</div>
                </div>
                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                  <div className="font-bold text-yellow-600">{filteredOutCount}</div>
                  <div className="text-gray-600">Filtered Out</div>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="font-bold text-blue-600">{extractionResult.chunkErrors?.length || 0}</div>
                  <div className="text-gray-600">Chunk Errors</div>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <div className="font-bold text-purple-600">{extractionResult.menuItems.length}</div>
                  <div className="text-gray-600">Total Extracted</div>
                </div>
              </div>

              {/* Filtered Items Table */}
              {filteredItems.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredItems.map((item, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-sm">{item.name || ''}</td>
                          <td className="px-3 py-2 text-sm">{item.description || ''}</td>
                          <td className="px-3 py-2 text-sm font-medium">£{item.price ?? ''}</td>
                          <td className="px-3 py-2 text-sm">{item.category || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Debug Information */}
              {process.env.NODE_ENV === 'development' && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-gray-600">Debug Information</summary>
                  <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-40">
                    {JSON.stringify(extractionResult, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stage 4: Database Integration Status */}
      {databaseResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-500" />
              Database Integration
            </CardTitle>
            <CardDescription>
              Menu items ready for database storage.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>{databaseResult.savedCount} items ready to save</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stage 5: Complete State */}
      {currentStage === 'complete' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              Upload Complete!
            </CardTitle>
            <CardDescription>
              Your menu has been successfully processed and is ready for use.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={resetUpload} variant="outline">
              Upload Another Menu
            </Button>
          </CardContent>
        </Card>
      )}

      {/* No Results State */}
      {currentStage === 'complete' && filteredItems.length === 0 && (
        <Alert>
          <FileX className="h-4 w-4" />
          <AlertDescription>
            No valid menu items were found in the uploaded file. Please try a different menu or check the file format.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
