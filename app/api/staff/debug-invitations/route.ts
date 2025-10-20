// Debug endpoint to help troubleshoot staff invitation issues
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { getUserSafe } from '@/utils/getUserSafe';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserSafe('GET /api/staff/debug-invitations');
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const venueId = searchParams.get('venue_id');

    if (!venueId) {
      return NextResponse.json({ error: 'venue_id is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const debugInfo: Record<string, unknown> = {
      user: {
        id: user.id,
        email: user.email,
      },
      venue_id: venueId,
      checks: {}
    };

    // Check if staff_invitations table exists
    try {
      const { error: tableError } = await supabase
        .from('staff_invitations')
        .select('id')
        .limit(1);
      
      debugInfo.checks.staff_invitations_table = {
        exists: !tableError,
        error: tableError?.message || null
      };
    } catch (error: unknown) {
      debugInfo.checks.staff_invitations_table = {
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Check user venue roles
    try {
      const { data: userRoles, error: roleError } = await supabase
        .from('user_venue_roles')
        .select('*')
        .eq('user_id', user.id)
        .eq('venue_id', venueId);
      
      debugInfo.checks.user_venue_roles = {
        found: userRoles?.length || 0,
        roles: userRoles || [],
        error: roleError?.message || null
      };
    } catch (error: unknown) {
      debugInfo.checks.user_venue_roles = {
        found: 0,
        roles: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Check if venue exists
    try {
      const { data: venue, error: venueError } = await supabase
        .from('venues')
        .select('venue_id, venue_name, organization_id, owner_user_id')
        .eq('venue_id', venueId)
        .single();
      
      debugInfo.checks.venue = {
        exists: !!venue,
        venue: venue || null,
        error: venueError?.message || null
      };
    } catch (error: unknown) {
      debugInfo.checks.venue = {
        exists: false,
        venue: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Check if user is venue owner
    try {
      const { data: venue, error: venueError } = await supabase
        .from('venues')
        .select('owner_user_id')
        .eq('venue_id', venueId)
        .single();
      
      debugInfo.checks.is_owner = {
        is_owner: venue?.owner_user_id === user.id,
        owner_user_id: venue?.owner_user_id,
        error: venueError?.message || null
      };
    } catch (error: unknown) {
      debugInfo.checks.is_owner = {
        is_owner: false,
        owner_user_id: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Check existing invitations
    try {
      const { data: invitations, error: invitationError } = await supabase
        .from('staff_invitations')
        .select('*')
        .eq('venue_id', venueId);
      
      debugInfo.checks.existing_invitations = {
        count: invitations?.length || 0,
        invitations: invitations || [],
        error: invitationError?.message || null
      };
    } catch (error: unknown) {
      debugInfo.checks.existing_invitations = {
        count: 0,
        invitations: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    return NextResponse.json(debugInfo);
  } catch (error) {
    logger.error('[DEBUG API] Unexpected error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
