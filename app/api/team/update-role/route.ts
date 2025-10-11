import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireRole, PERMISSIONS, setAuditReason } from '@/lib/requireRole';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { venueId, userId, newRole, reason } = body;

    // Validation
    if (!venueId || !userId || !newRole) {
      return NextResponse.json(
        { error: 'Missing required fields: venueId, userId, newRole' },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ['owner', 'manager', 'staff', 'kitchen'];
    if (!validRoles.includes(newRole)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }

    // Only owners can change roles
    await requireRole(supabase, venueId, PERMISSIONS.MANAGE_ROLES);

    // Get current user ID to prevent self-demotion without warning
    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = user?.id;

    // Check if this is a self-demotion from owner
    if (currentUserId === userId) {
      const { data: currentRole } = await supabase
        .from('user_venue_roles')
        .select('role')
        .eq('venue_id', venueId)
        .eq('user_id', userId)
        .single();

      if (currentRole?.role === 'owner' && newRole !== 'owner') {
        // Count other owners
        const { data: otherOwners } = await supabase
          .from('user_venue_roles')
          .select('id')
          .eq('venue_id', venueId)
          .eq('role', 'owner')
          .neq('user_id', userId);

        if (!otherOwners || otherOwners.length === 0) {
          return NextResponse.json(
            { error: 'Cannot demote yourself. You are the last owner of this venue.' },
            { status: 400 }
          );
        }
      }
    }

    // Set audit reason if provided (will be picked up by trigger)
    if (reason) {
      try {
        await setAuditReason(supabase, reason);
      } catch (err) {
        console.warn('[TEAM UPDATE] Could not set audit reason:', err);
      }
    }

    // Update the role (RLS and triggers will enforce constraints)
    const { error: updateError } = await supabase
      .from('user_venue_roles')
      .update({ role: newRole })
      .eq('venue_id', venueId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('[TEAM UPDATE] Error updating role:', updateError);
      
      // Check for last owner protection
      if (updateError.message?.includes('last owner')) {
        return NextResponse.json(
          { error: 'Cannot demote the last owner of this venue' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to update role' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Role updated to ${newRole}`,
      newRole,
      selfUpdate: currentUserId === userId
    });

  } catch (error: any) {
    console.error('[TEAM UPDATE] Error:', error);
    
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

