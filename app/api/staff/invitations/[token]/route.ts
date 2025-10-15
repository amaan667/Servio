import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/staff/invitations/[token] - Get invitation details by token
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Get invitation details using the database function
    const { data, error } = await supabase
      .rpc('get_invitation_by_token', { p_token: token });

    if (error) {
      console.error('[INVITATION API] Error fetching invitation:', error);
      return NextResponse.json({ error: 'Failed to fetch invitation' }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Invitation not found or expired' }, { status: 404 });
    }

    const invitation = data[0];

    // Check if invitation is expired
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 410 });
    }

    // Check if invitation is already accepted
    if (invitation.status !== 'pending') {
      return NextResponse.json({ error: 'Invitation is no longer valid' }, { status: 410 });
    }

    return NextResponse.json({ invitation });
  } catch (error) {
    console.error('[INVITATION API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/staff/invitations/[token] - Accept invitation and create account
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json();
    const { password, full_name } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    if (!password || !full_name) {
      return NextResponse.json({ 
        error: 'password and full_name are required' 
      }, { status: 400 });
    }

    const supabase = await createClient();

    // Get invitation details
    const { data: invitationData, error: fetchError } = await supabase
      .rpc('get_invitation_by_token', { p_token: token });

    if (fetchError) {
      console.error('[INVITATION API] Error fetching invitation:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch invitation' }, { status: 500 });
    }

    if (!invitationData || invitationData.length === 0) {
      return NextResponse.json({ error: 'Invitation not found or expired' }, { status: 404 });
    }

    const invitation = invitationData[0];

    // Check if invitation is expired
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 410 });
    }

    // Check if invitation is already accepted
    if (invitation.status !== 'pending') {
      return NextResponse.json({ error: 'Invitation is no longer valid' }, { status: 410 });
    }

    // Try to create new user account
    // If user already exists, we'll get an error and handle it
    let userId: string;
    
    const { data: newUser, error: signUpError } = await supabase.auth.admin.createUser({
      email: invitation.email,
      password,
      user_metadata: {
        full_name,
        invited_by: invitation.invited_by_name
      },
      email_confirm: true // Auto-confirm since they're invited
    });

    if (signUpError) {
      // Check if the error is because user already exists
      if (signUpError.message?.includes('already registered') || signUpError.message?.includes('already exists')) {
        // User already exists, we need to find their ID
        // For now, we'll return an error asking them to sign in first
        return NextResponse.json({ 
          error: 'An account with this email already exists. Please sign in to your existing account and contact the person who invited you to resend the invitation.' 
        }, { status: 409 });
      } else {
        console.error('[INVITATION API] Error creating user:', signUpError);
        return NextResponse.json({ 
          error: 'Failed to create account: ' + signUpError.message 
        }, { status: 500 });
      }
    }

    userId = newUser.user.id;

    // Accept the invitation using the database function
    const { data: acceptResult, error: acceptError } = await supabase
      .rpc('accept_invitation', { 
        p_token: token, 
        p_user_id: userId 
      });

    if (acceptError) {
      console.error('[INVITATION API] Error accepting invitation:', acceptError);
      return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
    }

    if (!acceptResult) {
      return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
    }

    // Get the updated invitation details
    const { data: updatedInvitation, error: updateError } = await supabase
      .from('staff_invitations')
      .select(`
        *,
        venues!inner(venue_name),
        organizations(name)
      `)
      .eq('token', token)
      .single();

    if (updateError) {
      console.error('[INVITATION API] Error fetching updated invitation:', updateError);
    }

    return NextResponse.json({ 
      success: true,
      message: 'Invitation accepted successfully',
      invitation: updatedInvitation
    });
  } catch (error) {
    console.error('[INVITATION API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
