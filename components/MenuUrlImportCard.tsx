'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Link2, Download, Check, X, RefreshCw, Eye, Upload, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';

interface MenuUrlImportCardProps {
  venueId: string;
  onSuccess?: () => void;
}

interface ScrapedItem {
  name: string;
  description: string;
  price: number;
  category: string;
  image_url?: string;
}

interface ScrapedMenuData {
  items: ScrapedItem[];
  venueName: string;
  categories: string[];
  imageCount: number;
}

export function MenuUrlImportCard({ venueId, onSuccess }: MenuUrlImportCardProps) {
  const [menuUrl, setMenuUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [scrapedData, setScrapedData] = useState<ScrapedMenuData | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  const handleScrape = async () => {
    if (!menuUrl.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a menu URL',
        variant: 'destructive',
      });
      return;
    }

    // Basic URL validation
    try {
      new URL(menuUrl);
    } catch {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid URL (e.g., https://example.com/menu)',
        variant: 'destructive',
      });
      return;
    }

    setIsImporting(true);

    try {
      const response = await fetch('/api/menu/import-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: menuUrl, venueId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import menu');
      }

      if (data.success && data.menuData) {
        setScrapedData(data.menuData);
        // Select all items by default
        setSelectedItems(new Set(data.menuData.items.map((_: unknown, idx: number) => idx)));
        setShowPreview(true);
        
        toast({
          title: 'Menu scraped successfully!',
          description: `Found ${data.menuData.items.length} items across ${data.menuData.categories.length} categories`,
        });
      }
    } catch (error) {
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Failed to scrape menu from URL',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!scrapedData) return;

    setIsImporting(true);

    try {
      const itemsToImport = scrapedData.items.filter((_, idx) => selectedItems.has(idx));

      const response = await fetch('/api/menu/confirm-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venueId,
          items: itemsToImport,
          categories: scrapedData.categories,
          venueName: scrapedData.venueName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import menu items');
      }

      toast({
        title: 'Success!',
        description: `Imported ${itemsToImport.length} menu items`,
      });

      setShowPreview(false);
      setScrapedData(null);
      setMenuUrl('');
      setSelectedItems(new Set());

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Failed to import menu items',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const toggleItemSelection = (index: number) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    setSelectedItems(newSelection);
  };

  const toggleAllItems = () => {
    if (scrapedData) {
      if (selectedItems.size === scrapedData.items.length) {
        setSelectedItems(new Set());
      } else {
        setSelectedItems(new Set(scrapedData.items.map((_, idx) => idx)));
      }
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Link2 className="h-5 w-5" />
            <span>Import from Menu URL</span>
            <Badge variant="secondary" className="ml-2">Premium</Badge>
          </CardTitle>
          <CardDescription>
            Automatically import your menu from an existing website
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Enter your menu website URL (e.g., https://nurcafe.co.uk/menu) and we'll automatically 
              extract items, prices, descriptions, and images.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="menu-url">Menu Website URL</Label>
            <div className="flex gap-2">
              <Input
                id="menu-url"
                type="url"
                placeholder="https://yourrestaurant.com/menu"
                value={menuUrl}
                onChange={(e) => setMenuUrl(e.target.value)}
                disabled={isImporting}
              />
              <Button
                onClick={handleScrape}
                disabled={isImporting || !menuUrl.trim()}
                className="whitespace-nowrap"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Import Menu
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="text-sm text-muted-foreground space-y-1">
            <p className="font-medium">Supported formats:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Restaurant websites with menu pages</li>
              <li>Online ordering sites</li>
              <li>Menu PDF links</li>
              <li>Structured menu data</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Review Menu Import
            </DialogTitle>
            <DialogDescription>
              Review the scraped menu items before importing. Uncheck any items you don't want to import.
            </DialogDescription>
          </DialogHeader>

          {scrapedData && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Venue Name</p>
                  <p className="font-semibold">{scrapedData.venueName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Items Found</p>
                  <p className="font-semibold">{scrapedData.items.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Categories</p>
                  <p className="font-semibold">{scrapedData.categories.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Images</p>
                  <p className="font-semibold">{scrapedData.imageCount}</p>
                </div>
              </div>

              {/* Select All */}
              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <Checkbox
                  id="select-all"
                  checked={selectedItems.size === scrapedData.items.length}
                  onCheckedChange={toggleAllItems}
                />
                <Label htmlFor="select-all" className="font-medium cursor-pointer">
                  Select All ({selectedItems.size} of {scrapedData.items.length} selected)
                </Label>
              </div>

              {/* Items Table */}
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead className="w-16">Image</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scrapedData.items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Checkbox
                            checked={selectedItems.has(index)}
                            onCheckedChange={() => toggleItemSelection(index)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.name}</p>
                            {item.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.category}</Badge>
                        </TableCell>
                        <TableCell className="font-semibold">
                          £{item.price.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {item.image_url ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <X className="h-4 w-4 text-gray-400" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPreview(false);
                setScrapedData(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmImport}
              disabled={selectedItems.size === 0 || isImporting}
            >
              {isImporting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import {selectedItems.size} Items
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

