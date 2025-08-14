'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { FileText, Upload, Info, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MenuUploadCardProps {
  venueId: string;
  onSuccess?: () => void;
}

export function MenuUploadCard({ venueId, onSuccess }: MenuUploadCardProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const addDebugLog = (message: string) => {
    console.log('[AUTH DEBUG]', message);
    setDebugInfo(prev => prev + '\n' + new Date().toISOString() + ': ' + message);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      addDebugLog('No file selected');
      return;
    }

    addDebugLog(`File selected: ${file.name} (${file.size} bytes)`);

    // Validate file type
    const validTypes = ['.txt', '.md', '.json', '.pdf'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    addDebugLog(`File extension: ${fileExtension}`);
    
    if (!validTypes.includes(fileExtension)) {
      addDebugLog(`Invalid file type: ${fileExtension}`);
      toast({
        title: 'Invalid file type',
        description: 'Please upload a .txt, .md, .json, or .pdf file',
        variant: 'destructive'
      });
      return;
    }

    // Validate file size (max 10MB for PDF, 1MB for text files)
    const maxSize = fileExtension === '.pdf' ? 10 * 1024 * 1024 : 1024 * 1024;
    if (file.size > maxSize) {
      addDebugLog(`File too large: ${file.size} > ${maxSize}`);
      toast({
        title: 'File too large',
        description: `Please upload a file smaller than ${fileExtension === '.pdf' ? '10MB' : '1MB'}`,
        variant: 'destructive'
      });
      return;
    }

    setIsProcessing(true);
    addDebugLog('Starting file processing...');

    try {
      let text = '';
      
      if (fileExtension === '.pdf') {
        addDebugLog('Processing PDF file...');
        
        // Step 1: Upload the file
        const uploadFormData = new FormData();
        uploadFormData.append('file', file);
        uploadFormData.append('venue_id', venueId);
        
        addDebugLog('Uploading PDF file...');
        
        const uploadResponse = await fetch('/api/menu/upload', {
          method: 'POST',
          body: uploadFormData
        });

        addDebugLog(`Upload response status: ${uploadResponse.status}`);
        
        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          addDebugLog(`Upload error: ${errorText}`);
          throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
        }

        const uploadResult = await uploadResponse.json();
        addDebugLog(`Upload result: ${JSON.stringify(uploadResult)}`);
        
        if (!uploadResult.ok) {
          throw new Error(`Upload failed: ${uploadResult.error}`);
        }

        // Step 2: Process the uploaded file
        addDebugLog('Processing uploaded PDF...');
        
        const processResponse = await fetch('/api/menu/process', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            upload_id: uploadResult.upload_id,
            venue_id: venueId
          })
        });

        addDebugLog(`Process response status: ${processResponse.status}`);
        
        if (!processResponse.ok) {
          const errorText = await processResponse.text();
          addDebugLog(`Process error: ${errorText}`);
          throw new Error(`Processing failed: ${processResponse.status} - ${errorText}`);
        }

        const result = await processResponse.json();
        addDebugLog(`Process result: ${JSON.stringify(result)}`);
        
        if (result.ok) {
          addDebugLog(`Success: ${result.counts.inserted} inserted, ${result.counts.skipped} skipped`);
          toast({
            title: 'Menu imported successfully',
            description: `${result.counts.inserted} items added, ${result.counts.skipped} skipped`
          });
          onSuccess?.();
        } else {
          throw new Error(`Processing failed: ${result.error}`);
        }
        
      } else {
        // For text files, read and send directly
        addDebugLog('Processing text file...');
        text = await file.text();
        
        addDebugLog(`Text content preview: ${text.substring(0, 200)}...`);
        
        const response = await fetch('/api/menu/process-text', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            venue_id: venueId,
            filename: file.name,
            text: text
          })
        });

        addDebugLog(`Text processing response status: ${response.status}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          addDebugLog(`Text processing error: ${errorText}`);
          throw new Error(`Text processing failed: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        addDebugLog(`Text processing result: ${JSON.stringify(result)}`);
        
        if (result.ok) {
          addDebugLog(`Success: ${result.counts.inserted} inserted, ${result.counts.skipped} skipped`);
          toast({
            title: 'Menu imported successfully',
            description: `${result.counts.inserted} items added, ${result.counts.skipped} skipped`
          });
          onSuccess?.();
        } else {
          throw new Error(`Text processing failed: ${result.error}`);
        }
      }
      
    } catch (error: any) {
      addDebugLog(`Upload error: ${error.message}`);
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Menu
        </CardTitle>
        <CardDescription>Upload, parse and preview a PDF menu. OCR is used only if needed.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
            >
              <FileText className="h-4 w-4 mr-2" />
              {isProcessing ? 'Processing...' : 'Choose File'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md,.json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
          
          <div className="text-sm text-gray-500">
            Supported formats: PDF (max 10MB), TXT, MD, JSON (max 1MB)
          </div>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p>For scanned/image-based PDFs, consider converting to text first using online OCR tools:</p>
              <div className="flex flex-wrap gap-2">
                <a
                  href="https://www.ilovepdf.com/pdf_to_word"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
                >
                  <ExternalLink className="h-3 w-3" />
                  iLovePDF
                </a>
                <a
                  href="https://smallpdf.com/pdf-to-word"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
                >
                  <ExternalLink className="h-3 w-3" />
                  SmallPDF
                </a>
                <a
                  href="https://www.adobe.com/acrobat/online/pdf-to-word.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
                >
                  <ExternalLink className="h-3 w-3" />
                  Adobe
                </a>
              </div>
            </div>
          </AlertDescription>
        </Alert>

        {debugInfo && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Debug Info:</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDebugInfo('')}
              >
                Clear
              </Button>
            </div>
            <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40">
              {debugInfo}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
