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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    // Validate file type
    const validTypes = ['.txt', '.md', '.json', '.pdf'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!validTypes.includes(fileExtension)) {
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
        // Send PDF directly to process-pdf endpoint
        const formData = new FormData();
        formData.append('file', file);
        formData.append('venue_id', venueId);
        
        const response = await fetch('/api/menu/process-pdf', {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`PDF processing failed: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        
        if (result.ok) {
          toast({
            title: 'Menu imported successfully',
            description: `${result.counts.inserted} items added, ${result.counts.skipped} skipped`
          });
          onSuccess?.();
        } else {
          throw new Error(`PDF processing failed: ${result.error}`);
        }
        
      } else {
        // For text files, temporarily disabled due to build issues
        throw new Error('Text file processing is temporarily unavailable. Please use PDF files or add menu items manually.');
      }
      
    } catch (error: any) {
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


      </CardContent>
    </Card>
  );
}
