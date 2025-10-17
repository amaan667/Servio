import { createAdminClient } from '@/lib/supabase/server';

/**
 * Convert PDF pages to images and upload to Supabase Storage
 * This is a reusable function that can be called from any route
 * 
 * @param pdfBytes - The PDF file as an ArrayBuffer
 * @param venueId - The venue ID to associate the images with
 * @returns Array of public URLs for the converted images
 */
export async function convertPDFToImages(pdfBytes: ArrayBuffer, venueId: string): Promise<string[]> {
  console.log('[PDF_TO_IMAGES] Starting PDF to images conversion for venue:', venueId);
  
  try {
    // Dynamic imports to avoid build issues
    const pdfjsLib = await import('pdfjs-dist');
    const { createCanvas } = await import('canvas');
    
    // Configure pdfjs-dist
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
    
    // Load PDF
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;
    
    console.log('[PDF_TO_IMAGES] PDF loaded successfully. Total pages:', pdf.numPages);
    
    const supabase = await createAdminClient();
    const imageUrls: string[] = [];
    
    // Convert each page to image (max 10 pages)
    for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 10); pageNum++) {
      console.log('[PDF_TO_IMAGES] Converting page', pageNum, 'to image...');
      
      const page = await pdf.getPage(pageNum);
      const scale = 2.0; // High quality for preview
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
      console.log('[PDF_TO_IMAGES] Page', pageNum, 'rendered. Buffer size:', imageBuffer.length);
      
      // Upload to Supabase Storage
      const fileName = `${venueId}/menu-page-${pageNum}-${Date.now()}.png`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('menus')
        .upload(fileName, imageBuffer, {
          contentType: 'image/png',
          upsert: false
        });
      
      if (uploadError) {
        console.error('[PDF_TO_IMAGES] Error uploading page', pageNum, ':', uploadError);
        continue;
      }
      
      console.log('[PDF_TO_IMAGES] Page', pageNum, 'uploaded to storage:', uploadData.path);
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('menus')
        .getPublicUrl(fileName);
      
      if (urlData?.publicUrl) {
        imageUrls.push(urlData.publicUrl);
        console.log('[PDF_TO_IMAGES] Page', pageNum, 'converted successfully. URL:', urlData.publicUrl);
      } else {
        console.error('[PDF_TO_IMAGES] Failed to get public URL for page', pageNum);
        console.error('[PDF_TO_IMAGES] urlData:', urlData);
      }
      
      // Verify the URL is accessible
      try {
        const response = await fetch(urlData.publicUrl, { method: 'HEAD' });
        if (response.ok) {
          console.log('[PDF_TO_IMAGES] URL is accessible:', urlData.publicUrl);
        } else {
          console.warn('[PDF_TO_IMAGES] URL returned status:', response.status, urlData.publicUrl);
        }
      } catch (fetchError) {
        console.error('[PDF_TO_IMAGES] Failed to verify URL accessibility:', fetchError);
      }
    }
    
    console.log('[PDF_TO_IMAGES] Conversion complete. Total images:', imageUrls.length);
    return imageUrls;
    
  } catch (error: any) {
    console.error('[PDF_TO_IMAGES] Error converting PDF to images:', error);
    console.error('[PDF_TO_IMAGES] Error stack:', error.stack);
    // Return empty array instead of throwing - let the calling code handle it
    return [];
  }
}
