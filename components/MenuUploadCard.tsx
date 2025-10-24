'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { FileText, Upload, Info, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabaseBrowser as createClient } from '@/lib/supabase';

interface MenuUploadCardProps {
  venueId: string;
  onSuccess?: () => void;
}

export function MenuUploadCard({ venueId, onSuccess }: MenuUploadCardProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReplacing, setIsReplacing] = useState(true); // Default to replace mode
  const [isClearing, setIsClearing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [hasExistingUpload, setHasExistingUpload] = useState(false);
  const [menuUrl, setMenuUrl] = useState(''); // Add URL input for hybrid import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const supabase = createClient();
  
  // Check if venue has existing menu items (not uploads)
  useEffect(() => {
    const checkExistingItems = async () => {
      try {
        const { data, error } = await supabase
          .from('menu_items')
          .select('id')
          .eq('venue_id', venueId)
          .limit(1)
          .single();
        
        if (data && !error) {
          setHasExistingUpload(true);
        }
      } catch {
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
      const { extractStyleFromPDF } = await import('@/lib/menu-style-extractor');
      
      // Extract style from text
      const style = extractStyleFromPDF(extractedText);
      
      // Get venue name
      const { data: venue } = await supabase
        .from('venues')
        .select('venue_name')
        .eq('venue_id', venueId)
        .single();
      
      // Upsert style settings
      const { error } = await supabase
        .from('menu_design_settings')
        .upsert({
          venue_id: venueId,
          venue_name: venue?.venue_name || undefined,
          primary_color: style.detected_primary_color || style.primary_color,
          secondary_color: style.detected_secondary_color || style.secondary_color,
          font_family: style.font_family,
          font_size: style.font_size,
          show_descriptions: style.show_descriptions,
          show_prices: style.show_prices,
          auto_theme_enabled: true
        }, {
          onConflict: 'venue_id'
        });
      
      if (!error) {
        toast({
          title: 'Menu style extracted',
          description: 'Your menu design has been automatically configured from the PDF'
        });
      }
    } catch {
      // Error silently handled
    }
  };

  const processFile = async (file: File) => {
    if (!file) {
      return;
    }

    // Validate file type (now accepts common image formats)
    const validTypes = ['.txt', '.md', '.json', '.pdf', '.png', '.jpg', '.jpeg', '.webp', '.heic'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!validTypes.includes(fileExtension)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a .txt, .md, .json, or .pdf file',
        variant: 'destructive'
      });
      return;
    }

    // Validate file size (max 10MB for PDF/images, 1MB for text files)
    const maxSize = (fileExtension === '.pdf' || ['.png', '.jpg', '.jpeg', '.webp', '.heic'].includes(fileExtension))
      ? 10 * 1024 * 1024
      : 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: 'File too large',
        description: `Please upload a file smaller than ${fileExtension === '.pdf' ? '10MB' : '1MB'}`,
        variant: 'destructive'
      });
      return;
    }

    setIsProcessing(true);

    try {
      
      if (fileExtension === '.pdf') {
        if (isReplacing) {
          // Use new catalog replace endpoint
          const formData = new FormData();
          formData.append('file', file);
          formData.append('venue_id', venueId);
          
          // Add menu URL if provided (for hybrid import)
          if (menuUrl && menuUrl.trim()) {
            formData.append('menu_url', menuUrl.trim());
          }

          const response = await fetch('/api/catalog/replace', {
            method: 'POST',
            body: formData
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Catalog replacement failed: ${response.status} - ${errorText}`);
          }

          const result = await response.json();
          
          if (result.ok) {
            toast({
              title: 'Catalog replaced successfully',
              description: `${result.result.items_created} items, ${result.result.categories_created} categories created`
            });
            
            // Save extracted style to database if available
            if (result.result.extracted_text) {
              await saveExtractedStyle(result.result.extracted_text);
            }
            
            onSuccess?.();
          } else {
            throw new Error(`Catalog replacement failed: ${result.error}`);
          }
      }
      
    } else {
      // Unified processing for all file types (PDFs, images, text)
      // Step 1: Upload file to storage
      const formData = new FormData();
      formData.append('file', file);
      formData.append('venue_id', venueId);

      const uploadResponse = await fetch('/api/menu/upload', { 
        method: 'POST', 
        body: formData 
      });
      
      const uploadResult = await uploadResponse.json();
      
      if (!uploadResponse.ok || !uploadResult?.ok) {
        throw new Error(uploadResult?.error || 'Upload failed');
      }

      // Step 2: Process with GPT-4o Vision (auto-creates hotspots)
      const processResponse = await fetch('/api/menu/process', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ uploadId: uploadResult.upload_id })
      });
      
      const processResult = await processResponse.json();
      
      if (!processResponse.ok || !processResult?.ok) {
        throw new Error(processResult?.error || 'Processing failed');
      }
      
      const itemCount = (processResult.items || []).length;
      const hotspotCount = processResult.hotspots_created || 0;
      
      toast({ 
        title: 'Menu imported successfully', 
        description: `${itemCount} items extracted${hotspotCount > 0 ? `, ${hotspotCount} hotspots created` : ''}` 
      });
      
      onSuccess?.();
    }
      
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
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
    if (!menuUrl || !menuUrl.trim()) {
      toast({
        title: 'No URL provided',
        description: 'Please enter a menu URL first',
        variant: 'destructive'
      });
      return;
    }

    setIsProcessing(true);
    console.log('[MENU UPLOAD] Re-processing with URL:', menuUrl);

    try {
      // Get existing PDF images from database
      const { data: uploadData } = await supabase
        .from('menu_uploads')
        .select('pdf_images, pdf_images_cc, id')
        .eq('venue_id', venueId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!uploadData || (!uploadData.pdf_images && !uploadData.pdf_images_cc)) {
        throw new Error('No existing PDF found. Please upload a PDF first.');
      }

      const pdfImages = uploadData.pdf_images || uploadData.pdf_images_cc;
      console.log('[MENU UPLOAD] Found existing PDF images:', pdfImages.length, 'pages');

      // Process with existing images and new URL
      const response = await fetch('/api/catalog/reprocess-with-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venue_id: venueId,
          menu_url: menuUrl.trim(),
          pdf_images: pdfImages,
          replace_mode: isReplacing
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Processing failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      if (result.ok) {
        toast({
          title: 'Menu processed successfully',
          description: `Combined PDF and URL: ${result.result.items_created} items`
        });
        
        await new Promise(resolve => setTimeout(resolve, 500));
        onSuccess?.();
      }
    } catch (error) {
      console.error('[MENU UPLOAD] Error:', error);
      toast({
        title: 'Processing failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
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


  const handleClearCatalog = async () => {
    if (!confirm('Are you sure you want to clear the entire catalog? This action cannot be undone.')) {
      return;
    }

    setIsClearing(true);

    try {

      const response = await fetch('/api/catalog/clear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ venueId })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Clear catalog failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      if (result.ok) {
        toast({
          title: 'Catalog cleared successfully',
          description: `Removed ${result.deletedCount} items from catalog`
        });
        onSuccess?.();
      } else {
        throw new Error(`Clear catalog failed: ${result.error}`);
      }
    } catch (error) {
      toast({
        title: 'Clear catalog failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Menu
        </CardTitle>
                    <CardDescription className="text-gray-900">Add your menu URL (if available), then upload your PDF. Both sources will be combined using AI for perfect menu extraction.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Menu URL for Enhanced Matching */}
        <div className="space-y-2">
          <Label htmlFor="menu-url-upload">
            Menu Website URL
          </Label>
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
              💡 Upload PDF first, then add URL to enhance with web data
            </p>
            {hasExistingUpload && menuUrl && menuUrl.trim() && (
              <Button
                onClick={handleProcessWithUrl}
                disabled={isProcessing}
                size="sm"
                variant="outline"
              >
                {isProcessing ? 'Processing...' : 'Process'}
              </Button>
            )}
          </div>
        </div>

        {/* Replace vs Append Toggle - Only show if there's an existing upload */}
        {hasExistingUpload && (
          <div className="flex items-center space-x-2">
            <Switch
              id="replace-mode"
              checked={isReplacing}
              onCheckedChange={setIsReplacing}
              disabled={isProcessing}
            />
            <Label htmlFor="replace-mode" className="text-sm font-medium text-gray-900">
              {isReplacing ? 'Replace Catalog' : 'Append to Catalog'}
            </Label>
          </div>
        )}

        <div className="space-y-2">
          <Label>Upload PDF Menu</Label>
          {/* Drag and Drop Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isDragOver 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <FileText className="h-8 w-8 mx-auto mb-2 text-gray-900" />
            <p className="text-sm text-gray-900 mb-2">
              Drag and drop your menu PDF here, or
            </p>
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
              {isProcessing ? 'Processing...' : 'Choose PDF'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md,.json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              onClick={handleClearCatalog}
              disabled={isClearing || isProcessing}
              size="sm"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isClearing ? 'Clearing...' : 'Clear Menu'}
            </Button>
          </div>
          
          <div className="text-sm text-gray-900">
            Supported formats: PDF (max 10MB), TXT, MD, JSON (max 1MB)
          </div>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-gray-900">
            <div className="space-y-2">
              <p>PDF processing uses GPT-4o Vision AI for intelligent menu extraction and position detection.</p>
              <p>For best results, ensure your PDF has clear, readable text and good contrast.</p>
            </div>
          </AlertDescription>
        </Alert>

      </CardContent>
    </Card>
  );
}
