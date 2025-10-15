// Email sending utilities for Servio
// This is a basic implementation that can be enhanced with proper email service integration

interface EmailTemplate {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface InvitationEmailData {
  email: string;
  venueName: string;
  role: string;
  invitedBy: string;
  invitationLink: string;
  expiresAt: string;
}

// Generate invitation email HTML
export function generateInvitationEmail(data: InvitationEmailData): EmailTemplate {
  const { email, venueName, role, invitedBy, invitationLink, expiresAt } = data;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>You're Invited to Join ${venueName}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: white; padding: 30px; border: 1px solid #e5e7eb; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; }
        .button { display: inline-block; background: #8B5CF6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
        .button:hover { background: #7C3AED; }
        .role-badge { display: inline-block; background: #FEF3C7; color: #92400E; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 600; }
        .details { background: #f8fafc; padding: 20px; border-radius: 6px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; margin: 8px 0; }
        .detail-label { font-weight: 600; color: #6b7280; }
        .detail-value { color: #111827; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 24px;">You're Invited to Join Servio!</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Join the team at ${venueName}</p>
        </div>
        
        <div class="content">
          <p>Hi there!</p>
          
          <p><strong>${invitedBy}</strong> has invited you to join the team at <strong>${venueName}</strong> as a <span class="role-badge">${role}</span>.</p>
          
          <div class="details">
            <div class="detail-row">
              <span class="detail-label">Venue:</span>
              <span class="detail-value">${venueName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Role:</span>
              <span class="detail-value">${role}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Invited by:</span>
              <span class="detail-value">${invitedBy}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Expires:</span>
              <span class="detail-value">${new Date(expiresAt).toLocaleDateString()}</span>
            </div>
          </div>
          
          <p>Click the button below to accept your invitation and create your account:</p>
          
          <div style="text-align: center;">
            <a href="${invitationLink}" class="button">Accept Invitation & Join Team</a>
          </div>
          
          <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
            If the button doesn't work, you can copy and paste this link into your browser:<br>
            <a href="${invitationLink}" style="color: #8B5CF6; word-break: break-all;">${invitationLink}</a>
          </p>
          
          <p style="font-size: 14px; color: #6b7280;">
            This invitation will expire on ${new Date(expiresAt).toLocaleDateString()}. If you have any questions, please contact ${invitedBy}.
          </p>
        </div>
        
        <div class="footer">
          <p style="margin: 0; font-size: 14px; color: #6b7280;">
            This invitation was sent by Servio - Restaurant Management Platform<br>
            If you didn't expect this invitation, you can safely ignore this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
You're Invited to Join ${venueName}!

Hi there!

${invitedBy} has invited you to join the team at ${venueName} as a ${role}.

Details:
- Venue: ${venueName}
- Role: ${role}
- Invited by: ${invitedBy}
- Expires: ${new Date(expiresAt).toLocaleDateString()}

To accept your invitation and create your account, visit:
${invitationLink}

This invitation will expire on ${new Date(expiresAt).toLocaleDateString()}. If you have any questions, please contact ${invitedBy}.

---
This invitation was sent by Servio - Restaurant Management Platform
If you didn't expect this invitation, you can safely ignore this email.
  `;

  return {
    to: email,
    subject: `You're invited to join ${venueName} on Servio`,
    html,
    text
  };
}

// Send email (placeholder implementation)
// In production, integrate with services like:
// - SendGrid
// - AWS SES
// - Resend
// - Supabase Edge Functions with email service
export async function sendEmail(template: EmailTemplate): Promise<boolean> {
  try {
    // For now, just log the email (in production, replace with actual email service)
    console.log('📧 EMAIL TO SEND:');
    console.log('To:', template.to);
    console.log('Subject:', template.subject);
    console.log('HTML Preview:', template.html.substring(0, 200) + '...');
    
    // TODO: Replace with actual email service integration
    // Example with SendGrid:
    // const sgMail = require('@sendgrid/mail');
    // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    // await sgMail.send(template);
    
    // Example with Resend:
    // const { Resend } = require('resend');
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // await resend.emails.send(template);
    
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

// Send invitation email
export async function sendInvitationEmail(data: InvitationEmailData): Promise<boolean> {
  const template = generateInvitationEmail(data);
  return await sendEmail(template);
}

// Generate invitation link
export function generateInvitationLink(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${baseUrl}/invitation/${token}`;
}
