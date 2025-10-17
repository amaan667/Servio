'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Plus, Minus } from 'lucide-react';

interface PDFMenuDisplayProps {
  venueId: string;
  menuItems: any[];
  categoryOrder: string[] | null;
  onAddToCart: (item: any) => void;
  cart: Array<{ id: string; quantity: number }>;
  onRemoveFromCart: (itemId: string) => void;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  isOrdering?: boolean; // If true, show ordering functionality
}

export function PDFMenuDisplay({
  venueId,
  menuItems,
  categoryOrder,
  onAddToCart,
  cart,
  onRemoveFromCart,
  onUpdateQuantity,
  isOrdering = false
}: PDFMenuDisplayProps) {
  const [pdfImages, setPdfImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPDFImages = async () => {
      try {
        const supabase = createClient();
        
        // Fetch the most recent PDF upload for this venue
        const { data: uploadData, error } = await supabase
          .from('menu_uploads')
          .select('pdf_images')
          .eq('venue_id', venueId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (uploadData && uploadData.pdf_images) {
          setPdfImages(uploadData.pdf_images);
        }
      } catch (error) {
        console.error('Error fetching PDF images:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPDFImages();
  }, [venueId]);

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading PDF menu...</div>;
  }

  if (pdfImages.length === 0) {
    // Fallback to text-based menu if no PDF images
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">No PDF menu images available</p>
        <p className="text-sm text-gray-500">Upload a PDF menu to see the visual menu</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pdfImages.map((imageUrl, index) => (
        <div key={index} className="relative">
          {/* PDF Page Image */}
          <img 
            src={imageUrl} 
            alt={`Menu Page ${index + 1}`}
            className="w-full h-auto rounded-lg shadow-lg border border-gray-200"
          />
          
          {/* Overlay ordering functionality if in ordering mode */}
          {isOrdering && (
            <div className="absolute inset-0 pointer-events-none">
              {/* This is where we'd add interactive ordering overlays */}
              {/* For now, we'll show a simple overlay with ordering info */}
              <div className="absolute bottom-4 right-4 pointer-events-auto">
                <div className="bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
                  <p className="text-xs text-gray-600">Page {index + 1}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

