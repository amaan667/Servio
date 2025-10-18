'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Plus, Minus, Loader2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure pdf.js for client-side
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface InteractivePDFMenuProps {
  venueId: string;
  onAddToCart: (item: any) => void;
  cart: Array<{ id: string; quantity: number }>;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
}

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  bbox_x?: number;
  bbox_y?: number;
  bbox_w?: number;
  bbox_h?: number;
  page_number: number;
  image_url?: string;
  category?: string;
  is_available: boolean;
}

interface PageData {
  page_number: number;
  width: number;
  height: number;
  image_url: string;
  items: MenuItem[];
}

export function InteractivePDFMenu({
  venueId,
  onAddToCart,
  cart,
  onUpdateQuantity
}: InteractivePDFMenuProps) {
  const [pages, setPages] = useState<PageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => {
    fetchMenuData();
  }, [venueId]);

  const fetchMenuData = async () => {
    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();

      // Fetch menu upload with PDF URL
      const { data: uploadData, error: uploadError } = await supabase
        .from('menu_uploads')
        .select('filename, storage_path, pdf_images, pdf_images_cc')
        .eq('venue_id', venueId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (uploadError || !uploadData) {
        setError('No PDF menu found. Please upload a menu first.');
        setLoading(false);
        return;
      }

      const pdfImages = uploadData.pdf_images || uploadData.pdf_images_cc || [];

      if (pdfImages.length === 0) {
        setError('No PDF images found. Please upload a PDF menu.');
        setLoading(false);
        return;
      }

      // Fetch existing menu items
      const { data: itemsData, error: itemsError } = await supabase
        .from('menu_items')
        .select('*')
        .eq('venue_id', venueId)
        .eq('is_available', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (itemsError) {
        throw new Error('Failed to fetch menu items');
      }

      if (!itemsData || itemsData.length === 0) {
        setError('No menu items found.');
        setLoading(false);
        return;
      }

      // Download PDF from storage using the correct path
      const storagePath = uploadData.storage_path || uploadData.filename;
      
      if (!storagePath) {
        setError('PDF file path not found.');
        setLoading(false);
        return;
      }

      const { data: pdfBlob, error: pdfError } = await supabase.storage
        .from('menus')
        .download(storagePath);

      if (pdfError || !pdfBlob) {
        setError('Failed to load PDF menu.');
        setLoading(false);
        return;
      }

      const pdfArrayBuffer = await pdfBlob.arrayBuffer();

      // Load PDF with pdf.js
      const pdf = await pdfjsLib.getDocument({ data: pdfArrayBuffer }).promise;
      const numPages = pdf.numPages;

      // Extract coordinates from each page
      const pagesData: PageData[] = [];

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.0 });
        const textContent = await page.getTextContent();

        // Extract text runs with coordinates
        const textRuns: any[] = [];
        for (const item of textContent.items) {
          if ('str' in item && 'transform' in item) {
            textRuns.push({
              str: item.str,
              x: item.transform[4],
              y: item.transform[5],
              width: item.width || 0,
              height: item.height || 0
            });
          }
        }

        // Match items to text runs
        const pageItems = matchItemsToTextRuns(itemsData, textRuns, pageNum, viewport);
        
        pagesData.push({
          page_number: pageNum,
          width: viewport.width,
          height: viewport.height,
          image_url: pdfImages[pageNum - 1],
          items: pageItems
        });
      }

      setPages(pagesData);

    } catch (err: any) {
      setError('Failed to load menu');
    } finally {
      setLoading(false);
    }
  };

  const renderPage = (page: PageData, index: number) => {
    const pageRef = pageRefs.current.get(page.page_number);
    const renderedWidth = pageRef?.clientWidth || 800;
    const renderedHeight = (renderedWidth / page.width) * page.height;

    // Calculate scale factors
    const scaleX = renderedWidth / page.width;
    const scaleY = renderedHeight / page.height;

    return (
      <div 
        key={page.page_number}
        ref={(el) => {
          if (el) {
            pageRefs.current.set(page.page_number, el);
          }
        }}
        className="relative mb-8"
      >
        {/* PDF Page Image */}
        <img 
          src={page.image_url} 
          alt={`Menu Page ${page.page_number}`}
          className="w-full h-auto rounded-lg shadow-lg border border-gray-200"
          style={{ maxWidth: '100%' }}
        />

        {/* Interactive Buttons Overlay */}
        {page.items.map((item) => {
          if (!item.bbox_x || !item.bbox_y || !item.bbox_w || !item.bbox_h) return null;

          const cartItem = cart.find(c => c.id === item.id);
          const quantity = cartItem?.quantity || 0;
          const isHovered = hoveredItem === item.id;

          // Calculate scaled coordinates
          const left = item.bbox_x * scaleX;
          const top = item.bbox_y * scaleY;
          const width = item.bbox_w * scaleX;
          const height = item.bbox_h * scaleY;

          // Position button at the right edge of the item
          const buttonLeft = left + width - 90;
          const buttonTop = top + (height / 2) - 18;

          return (
            <div
              key={item.id}
              className="absolute transition-all duration-200"
              style={{
                left: `${buttonLeft}px`,
                top: `${buttonTop}px`,
                zIndex: isHovered ? 30 : 10
              }}
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              {quantity === 0 ? (
                <Button
                  onClick={() => {
                    const menuItem = {
                      id: item.id,
                      name: item.name,
                      description: item.description,
                      price: item.price / 100,
                      category: item.category || 'UNCATEGORIZED',
                      is_available: item.is_available
                    };
                    onAddToCart(menuItem);
                  }}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg hover:shadow-xl transition-all font-semibold min-w-[90px]"
                  style={{
                    opacity: isHovered ? 1 : 0.9,
                    transform: isHovered ? 'scale(1.05)' : 'scale(1)'
                  }}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add
                </Button>
              ) : (
                <div 
                  className="bg-white rounded-md shadow-lg border-2 border-purple-600 p-1.5 flex items-center gap-1.5"
                  style={{
                    opacity: isHovered ? 1 : 0.95,
                    transform: isHovered ? 'scale(1.05)' : 'scale(1)'
                  }}
                >
                  <Button
                    onClick={() => onUpdateQuantity(item.id, quantity - 1)}
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0 border-purple-300 hover:border-purple-600 hover:bg-purple-50"
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="text-xs font-bold text-purple-700 min-w-[20px] text-center">
                    {quantity}
                  </span>
                  <Button
                    onClick={() => onUpdateQuantity(item.id, quantity + 1)}
                    size="sm"
                    className="h-7 w-7 p-0 bg-purple-600 hover:bg-purple-700"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600 mb-4" />
        <p className="text-gray-600">Loading interactive menu...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error}</p>
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">No menu pages found</p>
        <p className="text-sm text-gray-500">Upload and parse a PDF menu first</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {pages.map((page, index) => renderPage(page, index))}
    </div>
  );
}

// Helper function to match menu items to text runs in PDF
function matchItemsToTextRuns(
  items: any[],
  textRuns: any[],
  pageNumber: number,
  viewport: any
): MenuItem[] {
  const matchedItems: MenuItem[] = [];
  const priceRegex = /£?\s*(\d+(?:\.\d{1,2})?)/;

  // Group text runs into lines
  const lines: any[][] = [];
  let currentLine: any[] = [];
  let currentY = textRuns[0]?.y || 0;

  for (const run of textRuns) {
    if (Math.abs(run.y - currentY) > 5) {
      if (currentLine.length > 0) lines.push(currentLine);
      currentLine = [run];
      currentY = run.y;
    } else {
      currentLine.push(run);
    }
  }
  if (currentLine.length > 0) lines.push(currentLine);

  // Match each item to a line
  for (const item of items) {
    let bestMatch: any = null;
    let bestScore = 0;

    for (const line of lines) {
      const lineText = line.map(r => r.str).join(' ').trim();
      const priceMatch = lineText.match(priceRegex);
      
      if (!priceMatch) continue;

      const score = similarity(item.name, lineText);
      if (score > bestScore && score > 0.6) {
        bestScore = score;
        bestMatch = line;
      }
    }

    if (bestMatch) {
      const minX = Math.min(...bestMatch.map((r: any) => r.x));
      const maxX = Math.max(...bestMatch.map((r: any) => r.x + r.width));
      const minY = Math.min(...bestMatch.map((r: any) => r.y));
      const maxY = Math.max(...bestMatch.map((r: any) => r.y + r.height));

      matchedItems.push({
        ...item,
        bbox_x: minX,
        bbox_y: viewport.height - maxY,
        bbox_w: maxX - minX,
        bbox_h: maxY - minY,
        page_number: pageNumber
      });
    }
  }

  return matchedItems;
}

// Calculate string similarity
function similarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;
  
  // Simple Levenshtein distance
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

