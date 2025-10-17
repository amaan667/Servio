import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import * as pdfjsLib from 'pdfjs-dist';
import { createCanvas } from 'canvas';

// Configure pdfjs-dist to work in Node.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/**
 * Convert PDF pages to images
 * This endpoint receives a PDF file and converts each page to an image
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const pdfFile = formData.get('pdf') as File;
    const venueId = formData.get('venueId') as string;
    
    if (!pdfFile || !venueId) {
      return NextResponse.json({ 
        ok: false, 
        error: 'PDF file and venue ID are required' 
      }, { status: 400 });
    }
    
    console.log('[PDF CONVERT] Starting conversion:', pdfFile.name, 'Size:', pdfFile.size);
    
    // Load the PDF
    const pdfBytes = await pdfFile.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;
    
    console.log('[PDF CONVERT] PDF loaded, pages:', pdf.numPages);
    
    const supabase = await createAdminClient();
    const imageUrls: string[] = [];
    
    // Convert each page to an image
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      
      // Set scale for high quality (2x for retina displays)
      const scale = 2.0;
      const viewport = page.getViewport({ scale });
      
      // Create canvas
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');
      
      // Render PDF page to canvas
      await page.render({
        canvasContext: context as any,
        viewport: viewport,
        canvas: canvas as any
      }).promise;
      
      // Convert canvas to buffer
      const imageBuffer = canvas.toBuffer('image/png');
      
      // Upload to Supabase Storage
      const fileName = `${venueId}/menu-page-${pageNum}-${Date.now()}.png`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('menus')
        .upload(fileName, imageBuffer, {
          contentType: 'image/png',
          upsert: false
        });
      
      if (uploadError) {
        console.error('[PDF CONVERT] Error uploading page', pageNum, ':', uploadError);
        continue;
      }
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('menus')
        .getPublicUrl(fileName);
      
      if (urlData?.publicUrl) {
        imageUrls.push(urlData.publicUrl);
        console.log('[PDF CONVERT] Page', pageNum, 'converted and uploaded');
      }
    }
    
    console.log('[PDF CONVERT] Conversion complete. Total images:', imageUrls.length);
    
    return NextResponse.json({
      ok: true,
      message: `Successfully converted ${imageUrls.length} pages`,
      imageUrls: imageUrls
    });
    
  } catch (error: any) {
    console.error('[PDF CONVERT] Error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Failed to convert PDF: ' + error.message 
    }, { status: 500 });
  }
}

