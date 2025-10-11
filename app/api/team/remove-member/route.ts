import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireRole, getUserRole } from '@/lib/requireRole';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { venueId, userId } = body;

    // Validation
    if (!venueId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: venueId, userId' },
        { status: 400 }
      );
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get remover's role
    const removerRole = await getUserRole(supabase, venueId);
    if (!removerRole) {
      return NextResponse.json(
        { error: 'You are not a member of this venue' },
        { status: 403 }
      );
    }

    // Get target user's role
    const { data: targetMember } = await supabase
      .from('user_venue_roles')
      .select('role')
      .eq('venue_id', venueId)
      .eq('user_id', userId)
      .single();

    if (!targetMember) {
      return NextResponse.json(
        { error: 'User is not a member of this venue' },
        { status: 404 }
      );
    }

    // Permission checks:
    // - Owners can remove anyone (except last owner - handled by trigger)
    // - Managers can remove staff/kitchen only
    if (removerRole === 'owner') {
      // Owners can remove anyone, but trigger will prevent removing last owner
    } else if (removerRole === 'manager') {
      if (targetMember.role !== 'staff' && targetMember.role !== 'kitchen') {
        return NextResponse.json(
          { error: 'Managers can only remove staff and kitchen members' },
          { status: 403 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Only owners and managers can remove team members' },
        { status: 403 }
      );
    }

    // Prevent self-removal if last owner
    if (user.id === userId && targetMember.role === 'owner') {
      const { data: otherOwners } = await supabase
        .from('user_venue_roles')
        .select('id')
        .eq('venue_id', venueId)
        .eq('role', 'owner')
        .neq('user_id', userId);

      if (!otherOwners || otherOwners.length === 0) {
        return NextResponse.json(
          { error: 'Cannot remove yourself. You are the last owner of this venue.' },
          { status: 400 }
        );
      }
    }

    // Remove the member (RLS and triggers will enforce constraints)
    const { error: deleteError } = await supabase
      .from('user_venue_roles')
      .delete()
      .eq('venue_id', venueId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('[TEAM REMOVE] Error removing member:', deleteError);
      
      // Check for last owner protection
      if (deleteError.message?.includes('last owner')) {
        return NextResponse.json(
          { error: 'Cannot remove the last owner of this venue' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to remove team member' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Team member removed successfully',
      removedUserId: userId,
      selfRemoval: user.id === userId
    });

  } catch (error: any) {
    console.error('[TEAM REMOVE] Error:', error);
    
    if (error.status === 403) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

