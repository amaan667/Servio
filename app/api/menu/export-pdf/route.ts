import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get('venueId');

    if (!venueId) {
      return NextResponse.json(
        { ok: false, error: 'venueId is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Get the most recent PDF upload for this venue
    const { data: uploadData, error } = await supabase
      .from('menu_uploads')
      .select('storage_path')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !uploadData) {
      return NextResponse.json(
        { ok: false, error: 'No PDF found for this venue' },
        { status: 404 }
      );
    }

    // Download the PDF from storage
    const { data: pdfData, error: downloadError } = await supabase.storage
      .from('menus')
      .download(uploadData.storage_path);

    if (downloadError || !pdfData) {
      return NextResponse.json(
        { ok: false, error: 'Failed to download PDF' },
        { status: 500 }
      );
    }

    // Convert to buffer
    const arrayBuffer = await pdfData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Return PDF as download
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="menu.pdf"`,
        'Content-Length': buffer.length.toString(),
      },
    });

  } catch (error: any) {
    logger.error('[EXPORT PDF] Error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to export PDF' },
      { status: 500 }
    );
  }
}

