'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { FileText, Upload, Info } from 'lucide-react';
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
      if (fileExtension === '.pdf') {
        addDebugLog('Processing PDF file...');
        
        // Send PDF directly to process-pdf endpoint
        const formData = new FormData();
        formData.append('file', file);
        formData.append('venue_id', venueId);
        
        addDebugLog('Sending PDF to server for processing...');
        
        const response = await fetch('/api/menu/process-pdf', {
          method: 'POST',
          body: formData
        });

        addDebugLog(`PDF processing response status: ${response.status}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          addDebugLog(`PDF processing error: ${errorText}`);
          throw new Error(`PDF processing failed: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        addDebugLog(`PDF processing result: ${JSON.stringify(result)}`);
        
        if (result.ok) {
          addDebugLog(`Success: ${result.counts.inserted} inserted, ${result.counts.skipped} skipped`);
          toast({
            title: 'Menu imported successfully',
            description: `${result.counts.inserted} items added, ${result.counts.skipped} skipped`
          });
          onSuccess?.();
        } else {
          throw new Error(`PDF processing failed: ${result.error}`);
        }
        
      } else {
        // For text files, read and send directly
        addDebugLog('Processing text file...');
        const text = await file.text();
        
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
        <CardDescription>Upload and parse PDF menus using advanced OCR and AI processing.</CardDescription>
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
              <p>PDF processing uses Google Vision OCR for accurate text extraction from scanned documents and images.</p>
              <p>For best results, ensure your PDF has clear, readable text and good contrast.</p>
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
