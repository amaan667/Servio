import { errorToContext } from '@/lib/utils/error-to-context';

import { createAdminClient } from '@/lib/supabase';
import fs from 'fs/promises';
import path from 'path';
import { fromPath } from 'pdf2pic';
import { logger } from '@/lib/logger';

/**
 * Convert PDF pages to images and upload to Supabase Storage
 * Railway-friendly implementation using Nixpacks with GraphicsMagick/Ghostscript
 * 
 * @param pdfBytes - The PDF file as an ArrayBuffer
 * @param venueId - The venue ID to associate the images with
 * @returns Array of public URLs for the converted images
 */
export async function convertPDFToImages(pdfBytes: ArrayBuffer, venueId: string): Promise<string[]> {
  logger.debug('[PDF_TO_IMAGES] Starting PDF to images conversion', { venueId });
  
  // Create a temporary directory for PDF processing
  const workDir = '/tmp/pdf2img';
  const inPath = path.join(workDir, 'input.pdf');
  const outDir = path.join(workDir, 'out');
  
  try {
    // Clean up and create directories
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    await fs.mkdir(outDir, { recursive: true });
    
    // Write PDF to temp file
    await fs.writeFile(inPath, Buffer.from(pdfBytes));
    logger.debug('[PDF_TO_IMAGES] PDF written to temp file', { path: inPath });
    
    // Configure pdf2pic (uses GraphicsMagick/Ghostscript from Nixpacks)
    const converter = fromPath(inPath, {
      density: 200,           // High quality
      savePath: outDir,
      format: 'png',
      saveFilename: 'page',
      width: 1200,
      height: 1600
    });
    
    logger.debug('[PDF_TO_IMAGES] Converting PDF to images...');
    
    // Convert all pages (pdf2pic will create page_1.png, page_2.png, etc.)
    await converter.bulk(-1, { responseType: 'image' });
    
    // Read all generated PNG files
    const files = await fs.readdir(outDir);
    const pngFiles = files.filter(f => f.endsWith('.png')).sort();
    
    logger.debug('[PDF_TO_IMAGES] Converted pages', { count: pngFiles.length });
    
    // Upload each image to Supabase Storage
    const supabase = await createAdminClient();
    const imageUrls: string[] = [];
    
    for (let i = 0; i < pngFiles.length; i++) {
      const fileName = pngFiles[i];
      const filePath = path.join(outDir, fileName);
      
      try {
        // Read the image file
        const imageBuffer = await fs.readFile(filePath);
        
        // Upload to Supabase Storage
        const storageFileName = `${venueId}/menu-page-${i + 1}-${Date.now()}.png`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('menus')
          .upload(storageFileName, imageBuffer, {
            contentType: 'image/png',
            upsert: false
          });
        
        if (uploadError) {
          logger.error('[PDF_TO_IMAGES] Error uploading page', { page: i + 1, error: uploadError });
          continue;
        }
        
        logger.debug('[PDF_TO_IMAGES] Page uploaded to storage', { page: i + 1, path: uploadData.path });
        
        // Get public URL
        const { data: urlData } = supabase.storage
          .from('menus')
          .getPublicUrl(storageFileName);
        
        if (urlData?.publicUrl) {
          imageUrls.push(urlData.publicUrl);
          logger.debug('[PDF_TO_IMAGES] Page converted successfully', { page: i + 1, url: urlData.publicUrl });
        } else {
          logger.error('[PDF_TO_IMAGES] Failed to get public URL', { page: i + 1 });
        }
        
      } catch (pageError) {
        logger.error('[PDF_TO_IMAGES] Error processing page', { page: i + 1, error: pageError });
      }
    }
    
    logger.debug('[PDF_TO_IMAGES] Conversion complete', { totalImages: imageUrls.length });
    return imageUrls;
    
  } catch (error: unknown) {
    logger.error('[PDF_TO_IMAGES] Error converting PDF to images:', errorToContext(error));
    logger.error('[PDF_TO_IMAGES] Error stack:', error.stack);
    // Return empty array instead of throwing - let the calling code handle it
    return [];
  } finally {
    // Clean up temp files
    try {
      await fs.rm(workDir, { recursive: true, force: true });
      logger.debug('[PDF_TO_IMAGES] Cleaned up temp directory');
    } catch (cleanupError) {
      logger.error('[PDF_TO_IMAGES] Error cleaning up temp files:', cleanupError);
    }
  }
}
