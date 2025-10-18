import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { convertPDFToImages } from '@/lib/pdf-to-images';

/**
 * Test PDF to images conversion
 * This endpoint manually triggers the conversion for debugging
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

    // Get the most recent PDF upload
    const { data: uploadData, error: fetchError } = await supabase
      .from('menu_uploads')
      .select('id, filename, storage_path')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !uploadData) {
      return NextResponse.json({ 
        ok: false, 
        error: 'No menu upload found' 
      }, { status: 404 });
    }

    console.log('[TEST CONVERT] Found upload:', uploadData.id);

    // Download the PDF
    const storagePath = uploadData.storage_path || uploadData.filename;
    const { data: pdfFile, error: downloadError } = await supabase.storage
      .from('menus')
      .download(storagePath);

    if (downloadError || !pdfFile) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Failed to download PDF: ' + downloadError?.message 
      }, { status: 500 });
    }

    console.log('[TEST CONVERT] PDF downloaded successfully');

    // Convert PDF to images
    console.log('[TEST CONVERT] Starting conversion...');
    const pdfBytes = await pdfFile.arrayBuffer();
    const pdfImages = await convertPDFToImages(pdfBytes, venueId);

    console.log('[TEST CONVERT] Conversion complete. Images:', pdfImages.length);

    if (pdfImages.length === 0) {
      return NextResponse.json({ 
        ok: false, 
        error: 'PDF conversion returned 0 images. Check Railway logs for errors.' 
      }, { status: 500 });
    }

    // Update the database
    const { error: updateError } = await supabase
      .from('menu_uploads')
      .update({ pdf_images: pdfImages })
      .eq('id', uploadData.id);

    if (updateError) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Failed to update database: ' + updateError.message 
      }, { status: 500 });
    }

    console.log('[TEST CONVERT] Database updated successfully');

    return NextResponse.json({
      ok: true,
      message: 'PDF converted successfully',
      imageCount: pdfImages.length,
      images: pdfImages,
      uploadId: uploadData.id
    });

  } catch (error: any) {
    console.error('[TEST CONVERT] Error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: error.message || 'Conversion failed',
      stack: error.stack
    }, { status: 500 });
  }
}

