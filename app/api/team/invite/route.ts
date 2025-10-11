import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireRole, PERMISSIONS } from '@/lib/requireRole';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { venueId, email, role } = body;

    // Validation
    if (!venueId || !email || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: venueId, email, role' },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ['owner', 'manager', 'staff', 'kitchen'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }

    // Check permissions: owners can invite anyone; managers can only invite staff/kitchen
    const inviterRole = await requireRole(supabase, venueId, PERMISSIONS.INVITE_TEAM);
    
    if (inviterRole === 'manager' && (role === 'owner' || role === 'manager')) {
      return NextResponse.json(
        { error: 'Managers can only invite staff and kitchen roles' },
        { status: 403 }
      );
    }

    // Create admin client for invitation
    const adminSupabase = await createClient({
      serviceRole: true
    });

    // Check if user already exists
    const { data: existingUsers } = await adminSupabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u: any) => u.email === email);

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      
      // Check if already a member of this venue
      const { data: existingMembership } = await adminSupabase
        .from('user_venue_roles')
        .select('id, role')
        .eq('venue_id', venueId)
        .eq('user_id', userId)
        .maybeSingle();

      if (existingMembership) {
        return NextResponse.json(
          { 
            error: `User is already a member of this venue with role: ${existingMembership.role}`,
            existingRole: existingMembership.role
          },
          { status: 409 }
        );
      }
    } else {
      // Invite new user via Supabase Auth
      const appOrigin = process.env.NEXT_PUBLIC_APP_URL || 'https://servio.app';
      const { data: inviteData, error: inviteError } = await adminSupabase.auth.admin.inviteUserByEmail(
        email,
        {
          redirectTo: `${appOrigin}/auth/callback`,
        }
      );

      if (inviteError || !inviteData.user) {
        console.error('[TEAM INVITE] Error inviting user:', inviteError);
        return NextResponse.json(
          { error: 'Failed to send invitation email' },
          { status: 500 }
        );
      }

      userId = inviteData.user.id;
    }

    // Add user to venue with specified role (RLS will enforce permissions)
    const { error: membershipError } = await adminSupabase
      .from('user_venue_roles')
      .insert({
        venue_id: venueId,
        user_id: userId,
        role: role,
      });

    if (membershipError) {
      console.error('[TEAM INVITE] Error creating membership:', membershipError);
      return NextResponse.json(
        { error: 'Failed to add user to venue' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: existingUser 
        ? `User added to venue with role: ${role}` 
        : `Invitation sent to ${email} with role: ${role}`,
      userId,
      role,
      wasInvited: !existingUser
    });

  } catch (error: any) {
    console.error('[TEAM INVITE] Error:', error);
    
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

