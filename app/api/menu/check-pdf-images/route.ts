import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

/**
 * Check PDF images status for a venue
 * Useful for debugging why PDF images aren't showing
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get('venueId');
    
    if (!venueId) {
      return NextResponse.json({ 
        ok: false, 
        error: 'venueId is required' 
      }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Get all menu uploads for this venue
    const { data: uploads, error: fetchError } = await supabase
      .from('menu_uploads')
      .select('id, filename, storage_path, pdf_images, created_at')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (fetchError) {
      return NextResponse.json({ 
        ok: false, 
        error: fetchError.message 
      }, { status: 500 });
    }

    const results = uploads?.map(upload => ({
      id: upload.id,
      filename: upload.filename,
      storage_path: upload.storage_path,
      has_pdf_images: !!upload.pdf_images,
      pdf_images_count: upload.pdf_images ? upload.pdf_images.length : 0,
      pdf_images: upload.pdf_images,
      created_at: upload.created_at
    })) || [];

    return NextResponse.json({
      ok: true,
      venueId,
      uploads: results,
      total_uploads: results.length,
      latest_upload: results[0] || null
    });

  } catch (error: unknown) {
    logger.error('[CHECK PDF IMAGES] Error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ 
      ok: false, 
      error: error instanceof Error ? error.message : 'Failed to check PDF images' 
    }, { status: 500 });
  }
}

