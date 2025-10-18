import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

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

    // Check if menu_hotspots table exists
    const { data: tableExists, error: tableError } = await supabase
      .from('menu_hotspots')
      .select('id')
      .limit(1);

    if (tableError) {
      return NextResponse.json({
        ok: false,
        error: 'menu_hotspots table does not exist',
        details: tableError.message,
        action: 'Run migration: docs/migrations/menu-hotspots-schema.sql'
      }, { status: 500 });
    }

    // Check for hotspots for this venue
    const { data: hotspots, error: hotspotsError } = await supabase
      .from('menu_hotspots')
      .select('*')
      .eq('venue_id', venueId)
      .eq('is_active', true);

    if (hotspotsError) {
      return NextResponse.json({
        ok: false,
        error: 'Failed to fetch hotspots',
        details: hotspotsError.message
      }, { status: 500 });
    }

    // Check for menu items
    const { data: menuItems, error: itemsError } = await supabase
      .from('menu_items')
      .select('id, name')
      .eq('venue_id', venueId)
      .eq('is_available', true);

    if (itemsError) {
      return NextResponse.json({
        ok: false,
        error: 'Failed to fetch menu items',
        details: itemsError.message
      }, { status: 500 });
    }

    // Check for menu uploads
    const { data: uploads, error: uploadsError } = await supabase
      .from('menu_uploads')
      .select('id, created_at, pdf_images')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (uploadsError) {
      return NextResponse.json({
        ok: false,
        error: 'Failed to fetch menu uploads',
        details: uploadsError.message
      }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      diagnostics: {
        table_exists: true,
        hotspots_count: hotspots?.length || 0,
        menu_items_count: menuItems?.length || 0,
        uploads_count: uploads?.length || 0,
        has_pdf_images: uploads?.[0]?.pdf_images?.length > 0 || false,
        latest_upload: uploads?.[0]?.created_at || null,
        hotspots: hotspots || [],
        action_needed: hotspots?.length === 0 ? 
          'Re-upload the menu to auto-create hotspots' : 
          'Hotspots are configured correctly'
      }
    });

  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

