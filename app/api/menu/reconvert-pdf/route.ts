import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { convertPDFToImages } from '@/lib/pdf-to-images';

/**
 * Manually reconvert PDF to images for a venue
 * This is useful if the pdf_images column is empty or needs to be refreshed
 */
export async function POST(req: NextRequest) {
  try {
    const { venueId } = await req.json();
    
    if (!venueId) {
      return NextResponse.json({ 
        ok: false, 
        error: 'venueId is required' 
      }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Get the most recent menu upload for this venue
    const { data: uploadData, error: fetchError } = await supabase
      .from('menu_uploads')
      .select('id, filename, storage_path, venue_id')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !uploadData) {
      return NextResponse.json({ 
        ok: false, 
        error: 'No menu upload found for this venue' 
      }, { status: 404 });
    }

    console.log('[RECONVERT PDF] Found upload:', uploadData.id);

    // Download the PDF from storage
    const storagePath = uploadData.storage_path || uploadData.filename;
    const { data: pdfFile, error: downloadError } = await supabase.storage
      .from('menus')
      .download(storagePath);

    if (downloadError || !pdfFile) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Failed to download PDF from storage' 
      }, { status: 500 });
    }

    console.log('[RECONVERT PDF] PDF downloaded successfully');

    // Convert PDF to images
    const pdfBytes = await pdfFile.arrayBuffer();
    const pdfImages = await convertPDFToImages(pdfBytes, venueId);

    console.log('[RECONVERT PDF] PDF converted to images:', pdfImages.length);

    // Update the menu_uploads record with the new images
    const { error: updateError } = await supabase
      .from('menu_uploads')
      .update({ pdf_images: pdfImages })
      .eq('id', uploadData.id);

    if (updateError) {
      console.error('[RECONVERT PDF] Failed to update menu_uploads:', updateError);
      return NextResponse.json({ 
        ok: false, 
        error: 'Failed to update menu_uploads with images' 
      }, { status: 500 });
    }

    console.log('[RECONVERT PDF] Successfully updated menu_uploads with images');

    return NextResponse.json({
      ok: true,
      message: 'PDF successfully reconverted to images',
      imageCount: pdfImages.length,
      images: pdfImages
    });

  } catch (error: any) {
    console.error('[RECONVERT PDF] Error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: error.message || 'Failed to reconvert PDF' 
    }, { status: 500 });
  }
}

