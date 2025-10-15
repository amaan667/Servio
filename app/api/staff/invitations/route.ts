import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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
      console.error('[INVITATION API] Error fetching invitations:', error);
      return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
    }

    return NextResponse.json({ invitations });
  } catch (error) {
    console.error('[INVITATION API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/staff/invitations - Create a new invitation
export async function POST(request: NextRequest) {
  try {
    const user = await getUserSafe('POST /api/staff/invitations');
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { venue_id, email, role, permissions = {} } = body;

    if (!venue_id || !email || !role) {
      return NextResponse.json({ 
        error: 'venue_id, email, and role are required' 
      }, { status: 400 });
    }

    const supabase = await createClient();

    // Check if staff_invitations table exists
    try {
      await supabase.from('staff_invitations').select('id').limit(1);
    } catch (tableError: any) {
      if (tableError.code === 'PGRST116' || tableError.message?.includes('relation "staff_invitations" does not exist')) {
        // Table doesn't exist
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

    // Check if there's already a pending invitation for this email/venue
    const { data: existingInvitation, error: checkError } = await supabase
      .from('staff_invitations')
      .select('id, status')
      .eq('venue_id', venue_id)
      .eq('email', email.toLowerCase())
      .eq('status', 'pending')
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('[INVITATION API] Error checking existing invitation:', checkError);
      return NextResponse.json({ error: 'Failed to check existing invitations' }, { status: 500 });
    }

    if (existingInvitation) {
      return NextResponse.json({ 
        error: 'A pending invitation already exists for this email address' 
      }, { status: 409 });
    }

    // Check if user already has access to this venue
    const { data: existingUser, error: userCheckError } = await supabase
      .from('user_venue_roles')
      .select('user_id')
      .eq('venue_id', venue_id)
      .eq('user_id', user.id)
      .single();

    if (userCheckError && userCheckError.code !== 'PGRST116') {
      console.error('[INVITATION API] Error checking existing user:', userCheckError);
      return NextResponse.json({ error: 'Failed to check existing users' }, { status: 500 });
    }

    if (existingUser) {
      return NextResponse.json({ 
        error: 'This user already has access to this venue' 
      }, { status: 409 });
    }

    // Get organization_id and venue name for the venue (we already have venue data from permission check)
    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('organization_id, venue_name')
      .eq('venue_id', venue_id)
      .single();

    if (venueError) {
      console.error('[INVITATION API] Error fetching venue:', venueError);
      return NextResponse.json({ error: 'Venue not found' }, { status: 404 });
    }

    // Generate a secure token for the invitation
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');

    // Create the invitation
    const { data: invitation, error: createError } = await supabase
      .from('staff_invitations')
      .insert({
        venue_id,
        organization_id: venue.organization_id,
        invited_by: user.id,
        email: email.toLowerCase(),
        role,
        permissions,
        token,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      })
      .select()
      .single();

    if (createError) {
      console.error('[INVITATION API] Error creating invitation:', createError);
      return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
    }

    // Send email invitation
    let emailSent = false;
    let emailMessage = 'Invitation created successfully.';
    
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
        emailMessage = 'Invitation created successfully. Email has been sent.';
      } else {
        emailMessage = 'Invitation created successfully. Email service not configured - check server logs for invitation link.';
        console.warn('[INVITATION API] Email sending failed, but invitation was created');
        console.log('[INVITATION API] Invitation link:', invitationLink);
      }
    } catch (emailError) {
      console.error('[INVITATION API] Email sending error:', emailError);
      emailMessage = 'Invitation created successfully. Email service error - check server logs for invitation link.';
    }

    return NextResponse.json({ 
      invitation,
      message: emailMessage,
      emailSent,
      invitationLink: emailSent ? undefined : (await import('@/lib/email')).generateInvitationLink(invitation.token)
    });
  } catch (error) {
    console.error('[INVITATION API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
