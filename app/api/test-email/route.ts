// Test endpoint to verify email sending is working
import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    logger.debug('🧪 Testing email sending to:', email);

    const testTemplate = {
      to: email,
      subject: 'Test Email from Servio',
      html: `
        <h1>Test Email</h1>
        <p>This is a test email to verify that the email system is working.</p>
        <p>If you receive this, the email system is configured correctly!</p>
        <p>Sent at: ${new Date().toISOString()}</p>
      `,
      text: `
        Test Email
        
        This is a test email to verify that the email system is working.
        If you receive this, the email system is configured correctly!
        
        Sent at: ${new Date().toISOString()}
      `
    };

    const emailSent = await sendEmail(testTemplate);

    return NextResponse.json({
      success: emailSent,
      message: emailSent ? 'Test email sent successfully!' : 'Test email failed to send',
      email: email,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ Test email error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ 
      error: 'Failed to send test email',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
