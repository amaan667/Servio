import { NextRequest, NextResponse } from 'next/server';
import { getUserSafe } from '@/utils/getUserSafe';
import { logger } from '@/lib/logger';

// POST /api/debug-email - Debug email sending
export async function POST(request: NextRequest) {
  try {
    const user = await getUserSafe();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { testEmail } = body;

    if (!testEmail) {
      return NextResponse.json({ error: 'testEmail is required' }, { status: 400 });
    }

    logger.debug('[DEBUG EMAIL] Testing email to:', { value: testEmail });
    logger.debug('[DEBUG EMAIL] Current user:', { email: user.email });
    logger.debug('[DEBUG EMAIL] RESEND_API_KEY present:', { present: !!process.env.RESEND_API_KEY });

    // Test email sending
    try {
      const { sendInvitationEmail, generateInvitationLink } = await import('@/lib/email');
      
      const testToken = 'debug-' + Date.now();
      const invitationLink = generateInvitationLink(testToken);
      
      logger.debug('[DEBUG EMAIL] Generated invitation link:', { value: invitationLink });
      
      const emailSent = await sendInvitationEmail({
        email: testEmail,
        venueName: 'Test Venue',
        role: 'staff',
        invitedBy: user.user_metadata?.full_name || user.email || 'Test User',
        invitationLink,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      });

      logger.debug('[DEBUG EMAIL] Email sent result:', { value: emailSent });

      return NextResponse.json({ 
        success: true,
        message: 'Debug email test completed',
        emailSent,
        testEmail,
        invitationLink,
        resendApiKeyPresent: !!process.env.RESEND_API_KEY
      });

    } catch (emailError) {
      logger.error('[DEBUG EMAIL] Email error:', { value: emailError });
      return NextResponse.json({ 
        error: 'Email sending failed',
        details: emailError instanceof Error ? emailError.message : String(emailError),
        testEmail,
        resendApiKeyPresent: !!process.env.RESEND_API_KEY
      }, { status: 500 });
    }

  } catch (error) {
    logger.error('[DEBUG EMAIL] Unexpected error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
