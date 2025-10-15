import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserSafe } from '@/utils/getUserSafe';

// POST /api/staff/invitations/[id]/cancel - Cancel an invitation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserSafe('POST /api/staff/invitations/[id]/cancel');
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Invitation ID is required' }, { status: 400 });
    }

    const supabase = await createClient();

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

    if (roleError || !userRole || !['owner', 'manager'].includes(userRole.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Check if invitation can be cancelled
    if (invitation.status !== 'pending') {
      return NextResponse.json({ 
        error: 'Only pending invitations can be cancelled' 
      }, { status: 400 });
    }

    // Cancel the invitation
    const { error: cancelError } = await supabase
      .from('staff_invitations')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (cancelError) {
      console.error('[INVITATION API] Error cancelling invitation:', cancelError);
      return NextResponse.json({ error: 'Failed to cancel invitation' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Invitation cancelled successfully'
    });
  } catch (error) {
    console.error('[INVITATION API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
