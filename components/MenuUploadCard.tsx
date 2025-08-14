'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { FileText, Upload, Info, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MenuUploadCardProps {
  venueId: string;
  onSuccess?: () => void;
}

export function MenuUploadCard({ venueId, onSuccess }: MenuUploadCardProps) {
  const [activeTab, setActiveTab] = useState('pdf');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleTextFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.txt') && !file.name.endsWith('.md') && !file.name.endsWith('.json')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a .txt, .md, or .json file',
        variant: 'destructive'
      });
      return;
    }

    // Validate file size (max 1MB)
    if (file.size > 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload a file smaller than 1MB',
        variant: 'destructive'
      });
      return;
    }

    setIsProcessing(true);

    try {
      const text = await file.text();
      
      if (text.length < 200) {
        toast({
          title: 'Text too short',
          description: 'Please upload a file with at least 200 characters',
          variant: 'destructive'
        });
        return;
      }

      const response = await fetch('/api/menu/process-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venue_id: venueId,
          filename: file.name,
          text
        })
      });

      const result = await response.json();

      if (result.ok) {
        toast({
          title: 'Menu imported successfully',
          description: `${result.counts.inserted} items added, ${result.counts.skipped} skipped`
        });
        onSuccess?.();
      } else {
        toast({
          title: 'Import failed',
          description: result.error || 'Failed to process menu',
          variant: 'destructive'
        });
      }
    } catch (error) {
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
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pdf">PDF</TabsTrigger>
            <TabsTrigger value="text">Text (OCR result)</TabsTrigger>
          </TabsList>

          <TabsContent value="pdf" className="space-y-4">
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

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <FileText className="h-8 w-8 mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-600 mb-4">
                PDF upload coming soon...
              </p>
              <Button disabled variant="outline">
                Upload PDF
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="text" className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Recommended</Badge>
                <span className="text-sm text-gray-600">Upload OCR text for best results</span>
              </div>
              
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <FileText className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-600 mb-4">
                  Upload .txt, .md, or .json file (max 1MB)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.json"
                  onChange={handleTextFileUpload}
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

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-1">What counts as good OCR?</p>
                  <ul className="text-sm space-y-1">
                    <li>• Keep prices next to items</li>
                    <li>• Avoid extra headers/footers</li>
                    <li>• Clean up any obvious OCR errors</li>
                    <li>• Include item descriptions if available</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
