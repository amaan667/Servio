import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserSafe } from '@/utils/getUserSafe';

// POST /api/staff/invitations/cancel - Cancel an invitation
export async function POST(request: NextRequest) {
  try {
    const user = await getUserSafe('POST /api/staff/invitations/cancel');
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id } = body;

    console.log('[INVITATION API] Cancel request received:', { id, user: user.id });

    if (!id) {
      return NextResponse.json({ error: 'Invitation ID is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Check if staff_invitations table exists
    try {
      await supabase.from('staff_invitations').select('id').limit(1);
    } catch (tableError: any) {
      if (tableError.code === 'PGRST116' || tableError.message?.includes('relation "staff_invitations" does not exist')) {
        console.log('[INVITATION API] staff_invitations table does not exist');
        return NextResponse.json({ 
          error: 'Staff invitation system not set up. Please run the database migration first.' 
        }, { status: 503 });
      } else {
        console.error('[INVITATION API] Unexpected table error:', tableError);
        return NextResponse.json({ 
          error: 'Database error. Please try again.' 
        }, { status: 500 });
      }
    }

    // Get invitation details to check permissions
    const { data: invitation, error: fetchError } = await supabase
      .from('staff_invitations')
      .select('venue_id, status')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('[INVITATION API] Error fetching invitation:', fetchError);
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Check if user has permission to cancel invitations for this venue
    const { data: userRole, error: roleError } = await supabase
      .from('user_venue_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('venue_id', invitation.venue_id)
      .single();

    // If no role found, check if user is the venue owner
    let hasPermission = false;
    if (userRole && ['owner', 'manager'].includes(userRole.role)) {
      hasPermission = true;
    } else {
      // Check if user is the venue owner
      const { data: venue, error: venueError } = await supabase
        .from('venues')
        .select('owner_user_id')
        .eq('venue_id', invitation.venue_id)
        .single();
      
      if (venue && venue.owner_user_id === user.id) {
        hasPermission = true;
      }
    }

    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Check if invitation can be cancelled
    if (invitation.status !== 'pending') {
      return NextResponse.json({ 
        error: 'Only pending invitations can be cancelled' 
      }, { status: 400 });
    }

    // Delete the invitation completely (instead of just marking as cancelled)
    // This allows the same email to be invited again
    const { error: deleteError } = await supabase
      .from('staff_invitations')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('[INVITATION API] Error deleting invitation:', deleteError);
      console.error('[INVITATION API] Delete error details:', {
        code: deleteError.code,
        message: deleteError.message,
        details: deleteError.details,
        hint: deleteError.hint
      });
      return NextResponse.json({ 
        error: 'Failed to cancel invitation',
        details: deleteError.message 
      }, { status: 500 });
    }

    console.log('[INVITATION API] Invitation cancelled and removed successfully:', id);

    return NextResponse.json({ 
      success: true,
      message: 'Invitation cancelled successfully'
    });
  } catch (error) {
    console.error('[INVITATION API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
