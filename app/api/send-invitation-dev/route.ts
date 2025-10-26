import { NextRequest, NextResponse } from 'next/server';
import { getUserSafe } from '@/utils/getUserSafe';
import { logger } from '@/lib/logger';

// POST /api/send-invitation-dev - Send invitation email in development mode
export async function POST(_request: NextRequest) {
  try {
    const user = await getUserSafe();
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

    logger.debug('📧 DEVELOPMENT EMAIL SENDING:');
    logger.debug('To:', email);
    logger.debug('Subject: You\'re invited to join ' + venueName + ' on Servio');
    logger.debug('Role:', role);
    logger.debug('Invitation Link:', invitationLink);
    logger.debug('---');
    logger.debug('📋 INSTRUCTIONS FOR MANUAL EMAIL SENDING:');
    logger.debug('1. Copy the invitation link above');
    logger.debug('2. Send an email to:', email);
    logger.debug('3. Subject: You\'re invited to join ' + venueName + ' on Servio');
    logger.debug('4. Body: Click this link to accept your invitation: ' + invitationLink);
    logger.debug('---');

    // For development, we'll return success and log the details
    return NextResponse.json({ 
      success: true,
      message: 'Development email logged. Check server logs for details.',
      email,
      invitationLink,
      instructions: 'Check server logs for manual email sending instructions'
    });

  } catch (error) {
    logger.error('[DEV EMAIL] Unexpected error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
