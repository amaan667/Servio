import { NextRequest, NextResponse } from 'next/server';
import { getUserSafe } from '@/utils/getUserSafe';

// POST /api/send-invitation-dev - Send invitation email in development mode
export async function POST(request: NextRequest) {
  try {
    const user = await getUserSafe('POST /api/send-invitation-dev');
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { email, venueName, role, invitationLink } = body;

    if (!email || !venueName || !role || !invitationLink) {
      return NextResponse.json({ 
        error: 'email, venueName, role, and invitationLink are required' 
      }, { status: 400 });
    }

    console.log('📧 DEVELOPMENT EMAIL SENDING:');
    console.log('To:', email);
    console.log('Subject: You\'re invited to join ' + venueName + ' on Servio');
    console.log('Role:', role);
    console.log('Invitation Link:', invitationLink);
    console.log('---');
    console.log('📋 INSTRUCTIONS FOR MANUAL EMAIL SENDING:');
    console.log('1. Copy the invitation link above');
    console.log('2. Send an email to:', email);
    console.log('3. Subject: You\'re invited to join ' + venueName + ' on Servio');
    console.log('4. Body: Click this link to accept your invitation: ' + invitationLink);
    console.log('---');

    // For development, we'll return success and log the details
    return NextResponse.json({ 
      success: true,
      message: 'Development email logged. Check server logs for details.',
      email,
      invitationLink,
      instructions: 'Check server logs for manual email sending instructions'
    });

  } catch (error) {
    console.error('[DEV EMAIL] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
