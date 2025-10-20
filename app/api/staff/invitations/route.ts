import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { getUserSafe } from '@/utils/getUserSafe';

// GET /api/staff/invitations - List invitations for a venue
export async function GET(request: NextRequest) {
  try {
    const user = await getUserSafe('GET /api/staff/invitations');
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const venueId = searchParams.get('venue_id');

    if (!venueId) {
      return NextResponse.json({ error: 'venue_id is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Check if user has permission to view invitations for this venue
    const { data: userRole, error: roleError } = await supabase
      .from('user_venue_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('venue_id', venueId)
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
        .eq('venue_id', venueId)
        .single();
      
      if (venue && venue.owner_user_id === user.id) {
        hasPermission = true;
      }
    }

    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get invitations for the venue
    const { data: invitations, error } = await supabase
      .from('staff_invitations')
      .select(`
        *,
        venues!inner(venue_name),
        organizations(name)
      `)
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
    }

    return NextResponse.json({ invitations });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ 
      error: errorMessage 
    }, { status: 500 });
  }
}

// POST /api/staff/invitations - Create a new invitation
export async function POST(request: NextRequest) {
  try {
    const user = await getUserSafe('POST /api/staff/invitations');
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json({ 
        error: 'Invalid request body' 
      }, { status: 400 });
    }

    const { venue_id, email, role, permissions = {} } = body;

    if (!venue_id) {
      return NextResponse.json({ 
        error: 'venue_id is required' 
      }, { status: 400 });
    }

    if (!email) {
      return NextResponse.json({ 
        error: 'email is required' 
      }, { status: 400 });
    }

    if (!role) {
      return NextResponse.json({ 
        error: 'role is required' 
      }, { status: 400 });
    }

    // Prevent inviting yourself
    if (user.email?.toLowerCase() === email.toLowerCase()) {
      return NextResponse.json({ 
        error: 'You cannot invite yourself. You already have access to this venue.' 
      }, { status: 400 });
    }

    const supabase = await createClient();

    // Check if staff_invitations table exists
    try {
      await supabase.from('staff_invitations').select('id').limit(1);
    } catch (tableError: any) {
      if (tableError.code === 'PGRST116' || tableError.message?.includes('relation "staff_invitations" does not exist')) {
        // Table doesn't exist
        return NextResponse.json({ 
          error: 'Staff invitation system not set up. Please run the database migration first.' 
        }, { status: 503 });
      } else {
        return NextResponse.json({ 
          error: 'Database error. Please try again.' 
        }, { status: 500 });
      }
    }

    // Validate role
    const validRoles = ['owner', 'manager', 'staff', 'kitchen', 'server', 'cashier'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ 
        error: 'Invalid role. Must be one of: ' + validRoles.join(', ') 
      }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Check if user has permission to create invitations for this venue
    const { data: userRole, error: roleError } = await supabase
      .from('user_venue_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('venue_id', venue_id)
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
        .eq('venue_id', venue_id)
        .single();
      
      if (venue && venue.owner_user_id === user.id) {
        hasPermission = true;
      }
    }

    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Check if the email being invited already has access to this venue
    // First, check if there's a user with this email
    const { data: existingUserByEmail, error: emailCheckError } = await supabase
      .from('auth.users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (emailCheckError && emailCheckError.code !== 'PGRST116') {
      // Continue anyway, user might not exist yet
    }

    // If user exists, check if they already have access to this venue
    if (existingUserByEmail) {
      const { data: existingUserRole, error: roleCheckError } = await supabase
        .from('user_venue_roles')
        .select('user_id, role')
        .eq('venue_id', venue_id)
        .eq('user_id', existingUserByEmail.id)
        .single();

      if (roleCheckError && roleCheckError.code !== 'PGRST116') {
        return NextResponse.json({ error: 'Failed to check existing users' }, { status: 500 });
      }

      if (existingUserRole) {
        return NextResponse.json({ 
          error: 'This email address already has access to this venue' 
        }, { status: 409 });
      }
    }

    // Check if this is the owner's email address
    const { data: venueOwner, error: venueOwnerError } = await supabase
      .from('venues')
      .select('owner_user_id')
      .eq('venue_id', venue_id)
      .single();

    if (venueOwnerError) {
      return NextResponse.json({ error: 'Failed to check venue ownership' }, { status: 500 });
    }

    // Get the owner's email to compare
    if (venueOwner?.owner_user_id) {
      const { data: ownerUser, error: ownerUserError } = await supabase
        .from('auth.users')
        .select('email')
        .eq('id', venueOwner.owner_user_id)
        .single();

      if (ownerUserError) {
      } else if (ownerUser?.email?.toLowerCase() === email.toLowerCase()) {
        return NextResponse.json({ 
          error: 'This is the owner\'s email address. The owner already has full access to this venue.' 
        }, { status: 409 });
      }
    }

    // Get organization_id and venue name for the venue (we already have venue data from permission check)
    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('organization_id, venue_name')
      .eq('venue_id', venue_id)
      .single();

    if (venueError) {
      return NextResponse.json({ error: 'Venue not found' }, { status: 404 });
    }

    // Generate a secure token for the invitation
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    // Check if there's an existing pending invitation for this email/venue
    const { data: existingInvitation, error: checkError } = await supabase
      .from('staff_invitations')
      .select('id')
      .eq('venue_id', venue_id)
      .eq('email', email.toLowerCase())
      .eq('status', 'pending')
      .single();

    let invitation;

    if (existingInvitation && !checkError) {
      // Update existing invitation with new token and expiry
      const { data: updatedInvitation, error: updateError } = await supabase
        .from('staff_invitations')
        .update({
          token,
          expires_at: expiresAt,
          role,
          permissions,
          invited_by: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingInvitation.id)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json({ 
          error: 'Failed to update invitation',
          details: updateError.message 
        }, { status: 500 });
      }

      invitation = updatedInvitation;
    } else {
      // Create new invitation
      const { data: newInvitation, error: createError } = await supabase
        .from('staff_invitations')
        .insert({
          venue_id,
          organization_id: venue.organization_id,
          invited_by: user.id,
          email: email.toLowerCase(),
          role,
          permissions,
          token,
          expires_at: expiresAt
        })
        .select()
        .single();

      if (createError) {
        return NextResponse.json({ 
          error: 'Failed to create invitation',
          details: createError.message 
        }, { status: 500 });
      }

      invitation = newInvitation;
    }

    // Send email invitation
    let emailSent = false;
    const isUpdate = existingInvitation && !checkError;
    let emailMessage = isUpdate 
      ? 'Invitation refreshed successfully.' 
      : 'Invitation created successfully.';
    
    try {
      const { sendInvitationEmail, generateInvitationLink } = await import('@/lib/email');
      
      const invitationLink = generateInvitationLink(invitation.token);
      
      emailSent = await sendInvitationEmail({
        email: invitation.email,
        venueName: venue.venue_name || 'Your Venue',
        role: invitation.role,
        invitedBy: user.user_metadata?.full_name || user.email || 'Team Member',
        invitationLink,
        expiresAt: invitation.expires_at
      });

      if (emailSent) {
        emailMessage = isUpdate 
          ? 'Invitation refreshed and email sent successfully.' 
          : 'Invitation created and email sent successfully.';
      } else {
        emailMessage = isUpdate 
          ? 'Invitation refreshed successfully. Email service not configured.' 
          : 'Invitation created successfully. Email service not configured.';
      }
    } catch (emailError) {
      emailMessage = isUpdate 
        ? 'Invitation refreshed successfully. Email service error.' 
        : 'Invitation created successfully. Email service error.';
    }

    return NextResponse.json({ 
      invitation,
      message: emailMessage,
      emailSent,
      invitationLink: emailSent ? undefined : (await import('@/lib/email')).generateInvitationLink(invitation.token)
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ 
      error: errorMessage 
    }, { status: 500 });
  }
}

// DELETE /api/staff/invitations - Delete an invitation
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserSafe('DELETE /api/staff/invitations');
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json({ 
        error: 'Invalid request body' 
      }, { status: 400 });
    }

    const { id } = body;

    if (!id) {
      return NextResponse.json({ 
        error: 'Invitation ID is required' 
      }, { status: 400 });
    }

    const supabase = await createClient();

    // Get invitation details to check permissions
    const { data: invitation, error: fetchError } = await supabase
      .from('staff_invitations')
      .select('venue_id, status')
      .eq('id', id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Check if user has permission to delete invitations for this venue
    const { data: userRole, error: roleError } = await supabase
      .from('user_venue_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('venue_id', invitation.venue_id)
      .single();

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

    // Delete the invitation
    const { error: deleteError } = await supabase
      .from('staff_invitations')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json({ 
        error: 'Failed to remove invitation',
        details: deleteError.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Invitation removed successfully'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ 
      error: errorMessage 
    }, { status: 500 });
  }
}
