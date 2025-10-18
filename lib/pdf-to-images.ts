import { createAdminClient } from '@/lib/supabase/server';
import fs from 'fs';
import path from 'path';
import { fromBuffer } from 'pdf2pic';

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
  
  // Create a temporary file for the PDF
  const tempDir = '/tmp';
  const tempPdfPath = path.join(tempDir, `menu-${venueId}-${Date.now()}.pdf`);
  
  try {
    // Write PDF to temp file
    fs.mkdirSync(tempDir, { recursive: true });
    fs.writeFileSync(tempPdfPath, Buffer.from(pdfBytes));
    console.log('[PDF_TO_IMAGES] PDF written to temp file:', tempPdfPath);
    
    // Configure pdf2pic
    const convert = fromBuffer(
      Buffer.from(pdfBytes),
      {
        density: 200,           // High quality
        saveFilename: 'page',
        savePath: tempDir,
        format: 'png',
        width: 1200,
        height: 1600
      }
    );
    
    // Convert all pages (max 10 pages)
    const maxPages = 10;
    const imageUrls: string[] = [];
    const supabase = await createAdminClient();
    
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      try {
        console.log('[PDF_TO_IMAGES] Converting page', pageNum, 'to image...');
        
        const result = await convert(pageNum, { responseType: 'buffer' });
        
        if (!result || !result.buffer) {
          console.log('[PDF_TO_IMAGES] No more pages. Total pages:', pageNum - 1);
          break;
        }
        
        console.log('[PDF_TO_IMAGES] Page', pageNum, 'rendered. Buffer size:', result.buffer.length);
        
        // Upload to Supabase Storage
        const fileName = `${venueId}/menu-page-${pageNum}-${Date.now()}.png`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('menus')
          .upload(fileName, result.buffer, {
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
        }
        
      } catch (pageError: any) {
        // If we get an error on the first page, the PDF might be invalid
        if (pageNum === 1) {
          throw pageError;
        }
        // Otherwise, we've reached the end of the PDF
        console.log('[PDF_TO_IMAGES] Reached end of PDF at page', pageNum);
        break;
      }
    }
    
    console.log('[PDF_TO_IMAGES] Conversion complete. Total images:', imageUrls.length);
    return imageUrls;
    
  } catch (error: any) {
    console.error('[PDF_TO_IMAGES] Error converting PDF to images:', error);
    console.error('[PDF_TO_IMAGES] Error stack:', error.stack);
    // Return empty array instead of throwing - let the calling code handle it
    return [];
  } finally {
    // Clean up temp files
    try {
      if (fs.existsSync(tempPdfPath)) {
        fs.unlinkSync(tempPdfPath);
        console.log('[PDF_TO_IMAGES] Cleaned up temp PDF file');
      }
    } catch (cleanupError) {
      console.error('[PDF_TO_IMAGES] Error cleaning up temp files:', cleanupError);
    }
  }
}
