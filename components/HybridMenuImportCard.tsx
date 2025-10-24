'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Link2, FileText, Wand2, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface HybridMenuImportCardProps {
  venueId: string;
  onSuccess?: () => void;
}

export function HybridMenuImportCard({ venueId, onSuccess }: HybridMenuImportCardProps) {
  const [menuUrl, setMenuUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [result, setResult] = useState<{
    matched: number;
    unmatched: number;
    matchRate: string;
  } | null>(null);
  const { toast } = useToast();

  const handleHybridImport = async () => {
    if (!menuUrl.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a menu URL',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setCurrentStep('Validating URL...');

    try {
      // Step 1: Validate URL
      new URL(menuUrl);
      setProgress(10);

      // Step 2: Check for existing PDF
      setCurrentStep('Checking for PDF menu...');
      const supabase = await import('@/lib/supabase').then(m => m.supabaseBrowser());
      
      const { data: uploadData } = await supabase
        .from('menu_uploads')
        .select('pdf_images, pdf_images_cc')
        .eq('venue_id', venueId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const pdfImages = uploadData?.pdf_images || uploadData?.pdf_images_cc;

      if (!pdfImages || pdfImages.length === 0) {
        toast({
          title: 'PDF Required',
          description: 'Please upload a PDF menu first, then use hybrid import to add perfect hotspots',
          variant: 'destructive',
        });
        setIsProcessing(false);
        return;
      }

      setProgress(20);

      // Step 3: Scrape menu from URL
      setCurrentStep(`Scraping menu from ${new URL(menuUrl).hostname}...`);
      setProgress(30);

      // Step 4: Analyze PDF with Vision AI
      setCurrentStep('Analyzing PDF with AI to find item positions...');
      setProgress(50);

      const hybridResponse = await fetch('/api/menu/hybrid-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: menuUrl,
          venueId,
          pdfImages,
        }),
      });

      if (!hybridResponse.ok) {
        const error = await hybridResponse.json();
        throw new Error(error.error || 'Hybrid import failed');
      }

      const data = await hybridResponse.json();
      setProgress(80);

      // Step 5: Import matched items with positions
      setCurrentStep('Importing items and creating hotspots...');
      
      const importResponse = await fetch('/api/menu/import-with-hotspots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venueId,
          matchedItems: data.matchedItems,
          unmatchedItems: data.unmatchedItems,
        }),
      });

      if (!importResponse.ok) {
        throw new Error('Failed to import items');
      }

      setProgress(100);
      setCurrentStep('Complete!');

      setResult({
        matched: data.matchedItems.length,
        unmatched: data.unmatchedItems.length,
        matchRate: data.matchRate,
      });

      toast({
        title: 'Hybrid Import Successful! 🎉',
        description: `Imported ${data.matchedItems.length} items with perfect hotspot positions`,
      });

      if (onSuccess) {
        onSuccess();
      }

    } catch (error) {
      console.error('Hybrid import error:', error);
      toast({
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Failed to process hybrid import',
        variant: 'destructive',
      });
      setCurrentStep('Failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Wand2 className="h-5 w-5 text-purple-600" />
          <span>AI-Powered Hybrid Import</span>
          <Badge variant="secondary" className="ml-2 bg-purple-600 text-white">Premium</Badge>
        </CardTitle>
        <CardDescription>
          Combine your menu URL + PDF for perfect hotspot positioning using AI
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-purple-200 bg-purple-50">
          <Wand2 className="h-4 w-4 text-purple-600" />
          <AlertDescription className="text-sm">
            <strong>How it works:</strong>
            <ol className="mt-2 space-y-1 list-decimal list-inside">
              <li>Scrape your menu URL for item data (names, prices, descriptions)</li>
              <li>Analyze your PDF with GPT-4 Vision to find item positions</li>
              <li>Intelligently match items to positions</li>
              <li>Create perfectly placed add-to-cart buttons</li>
            </ol>
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="hybrid-url">Menu Website URL</Label>
          <div className="flex gap-2">
            <Input
              id="hybrid-url"
              type="url"
              placeholder="https://nurcafe.co.uk/menu"
              value={menuUrl}
              onChange={(e) => setMenuUrl(e.target.value)}
              disabled={isProcessing}
            />
            <Button
              onClick={handleHybridImport}
              disabled={isProcessing || !menuUrl.trim()}
              className="whitespace-nowrap bg-purple-600 hover:bg-purple-700"
            >
              {isProcessing ? (
                <>
                  <Wand2 className="h-4 w-4 mr-2 animate-pulse" />
                  Processing...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Smart Import
                </>
              )}
            </Button>
          </div>
        </div>

        {isProcessing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{currentStep}</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {result && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription>
              <div className="space-y-1">
                <p className="font-medium text-green-900">Import Complete!</p>
                <ul className="text-sm text-green-800 space-y-1">
                  <li>✅ Matched: {result.matched} items with perfect positions</li>
                  <li>⚠️ Unmatched: {result.unmatched} items (will use auto-placement)</li>
                  <li>📊 Success Rate: {result.matchRate}</li>
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-purple-900 mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Requirements:
          </h4>
          <ul className="text-sm text-purple-800 space-y-1">
            <li>• PDF menu must be uploaded first</li>
            <li>• Menu URL must be publicly accessible</li>
            <li>• GPT-4 Vision API key configured</li>
            <li>• Works best with clear, well-structured menus</li>
          </ul>
        </div>

        <div className="text-xs text-muted-foreground">
          <p className="font-medium mb-1">What you get:</p>
          <ul className="space-y-1">
            <li>✓ Beautiful PDF visual menu</li>
            <li>✓ Perfect add-to-cart button positions</li>
            <li>✓ All item data from your website</li>
            <li>✓ Images preserved from URL</li>
            <li>✓ Both PDF and List views available</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

