import { NextRequest, NextResponse } from 'next/server';
import { getUserSafe } from '@/utils/getUserSafe';

// POST /api/debug-email - Debug email sending
export async function POST(request: NextRequest) {
  try {
    const user = await getUserSafe('POST /api/debug-email');
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { testEmail } = body;

    if (!testEmail) {
      return NextResponse.json({ error: 'testEmail is required' }, { status: 400 });
    }

    console.log('[DEBUG EMAIL] Testing email to:', testEmail);
    console.log('[DEBUG EMAIL] Current user:', user.email);
    console.log('[DEBUG EMAIL] RESEND_API_KEY present:', !!process.env.RESEND_API_KEY);

    // Test email sending
    try {
      const { sendInvitationEmail, generateInvitationLink } = await import('@/lib/email');
      
      const testToken = 'debug-' + Date.now();
      const invitationLink = generateInvitationLink(testToken);
      
      console.log('[DEBUG EMAIL] Generated invitation link:', invitationLink);
      
      const emailSent = await sendInvitationEmail({
        email: testEmail,
        venueName: 'Test Venue',
        role: 'staff',
        invitedBy: user.user_metadata?.full_name || user.email || 'Test User',
        invitationLink,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      });

      console.log('[DEBUG EMAIL] Email sent result:', emailSent);

      return NextResponse.json({ 
        success: true,
        message: 'Debug email test completed',
        emailSent,
        testEmail,
        invitationLink,
        resendApiKeyPresent: !!process.env.RESEND_API_KEY
      });

    } catch (emailError) {
      console.error('[DEBUG EMAIL] Email error:', emailError);
      return NextResponse.json({ 
        error: 'Email sending failed',
        details: emailError instanceof Error ? emailError.message : String(emailError),
        testEmail,
        resendApiKeyPresent: !!process.env.RESEND_API_KEY
      }, { status: 500 });
    }

  } catch (error) {
    console.error('[DEBUG EMAIL] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
