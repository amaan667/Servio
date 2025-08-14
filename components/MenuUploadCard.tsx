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
        // For PDF files, extract text content
        const arrayBuffer = await file.arrayBuffer();
        addDebugLog(`PDF arrayBuffer size: ${arrayBuffer.byteLength}`);
        
        try {
          const pdfjsLib = await import('pdfjs-dist');
          addDebugLog('pdfjs-dist imported successfully');
          
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          addDebugLog(`PDF loaded, pages: ${pdf.numPages}`);
          
          for (let i = 1; i <= Math.min(pdf.numPages, 6); i++) {
            addDebugLog(`Processing page ${i}...`);
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            text += pageText + '\n';
            addDebugLog(`Page ${i} text length: ${pageText.length}`);
          }
        } catch (pdfError) {
          addDebugLog(`PDF processing error: ${pdfError}`);
          throw pdfError;
        }
        
        addDebugLog(`Total extracted text length: ${text.length}`);
      } else {
        addDebugLog('Processing text file...');
        // For text files, read directly
        text = await file.text();
        addDebugLog(`Text file content length: ${text.length}`);
      }
      
      if (text.length < 200) {
        addDebugLog(`Text too short: ${text.length} < 200`);
        toast({
          title: 'Text too short',
          description: 'Please upload a file with at least 200 characters',
          variant: 'destructive'
        });
        return;
      }

      addDebugLog('Sending to process-text API...');
      addDebugLog(`Text preview: ${text.substring(0, 200)}...`);

      const response = await fetch('/api/menu/process-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venue_id: venueId,
          filename: file.name,
          text
        })
      });

      addDebugLog(`API response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        addDebugLog(`API error response: ${errorText}`);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      addDebugLog(`API response: ${JSON.stringify(result)}`);

      if (result.ok) {
        addDebugLog(`Success: ${result.counts.inserted} inserted, ${result.counts.skipped} skipped`);
        toast({
          title: 'Menu imported successfully',
          description: `${result.counts.inserted} items added, ${result.counts.skipped} skipped`
        });
        onSuccess?.();
      } else {
        addDebugLog(`API returned error: ${result.error}`);
        toast({
          title: 'Import failed',
          description: result.error || 'Failed to process menu',
          variant: 'destructive'
        });
      }
    } catch (error) {
      addDebugLog(`Upload error: ${error}`);
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: 'Failed to upload and process file',
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
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Menu
        </CardTitle>
        <CardDescription>
          Upload your menu as a PDF or OCR text file
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">Got a scanned/image PDF?</p>
              <p>
                If your menu is mostly images (common), first convert it with OCR and upload the text file. 
                This gives the most accurate results.
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="outline" size="sm" asChild>
                  <a href="https://ocr.space/" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3 mr-1" />
                    OCR.space
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href="https://drive.google.com/" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Google Drive OCR
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href="https://www.adobe.com/acrobat/online/ocr-pdf.html" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Adobe Online OCR
                  </a>
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Upload File</Badge>
            <span className="text-sm text-gray-600">PDF or text file (.txt, .md, .json)</span>
          </div>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <FileText className="h-8 w-8 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-600 mb-4">
              Upload PDF (max 10MB) or text file (max 1MB)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md,.json"
              onChange={handleFileUpload}
              className="hidden"
              disabled={isProcessing}
            />
            <Button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
            >
              {isProcessing ? 'Processing...' : 'Choose File'}
            </Button>
          </div>
        </div>

        {/* Debug Info */}
        {debugInfo && (
          <div className="mt-4 p-4 bg-gray-100 rounded-lg">
            <h4 className="font-medium mb-2">Debug Info:</h4>
            <pre className="text-xs text-gray-700 whitespace-pre-wrap max-h-40 overflow-y-auto">
              {debugInfo}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
