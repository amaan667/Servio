import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { venueId } = await req.json();

    if (!venueId) {
      return NextResponse.json(
        { ok: false, error: 'venueId is required' },
        { status: 400 }
      );
    }

    // Verify user has access to the venue
    const supabase = createClient();
    
    // Check if user is owner
    const { data: venue } = await supabase
      .from('venues')
      .select('venue_id, owner_user_id')
      .eq('venue_id', venueId)
      .eq('owner_user_id', session.user.id)
      .maybeSingle();

    // Check if user has staff role
    const { data: userRole } = await supabase
      .from('user_venue_roles')
      .select('role')
      .eq('venue_id', venueId)
      .eq('user_id', session.user.id)
      .maybeSingle();

    const isOwner = !!venue;
    const isManagerOrOwner = isOwner || userRole?.role === 'manager' || userRole?.role === 'owner';

    if (!isOwner && !isManagerOrOwner) {
      return NextResponse.json(
        { ok: false, error: 'Venue not found or access denied' },
        { status: 403 }
      );
    }

    // Trigger hotspot detection by calling the detect-hotspots endpoint
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/menu/detect-hotspots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ venueId }),
    });

    const result = await response.json();

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: response.status }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Successfully detected ${result.hotspots} hotspots`,
      hotspots: result.hotspots,
      detected: result.detected
    });

  } catch (error: any) {
    console.error('[HOTSPOT TRIGGER] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to trigger hotspot detection' },
      { status: 500 }
    );
  }
}

