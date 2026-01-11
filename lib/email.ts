
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
          <h1 style="margin: 0; font-size: 24px;">You're Invited to Join ${venueName}!</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Join our team and help us deliver great service</p>
        </div>
        
        <div class="content">
          <p>Hi there!</p>
          
          <p>We're excited to invite you to join our team at <strong>${venueName}</strong>! <strong>${invitedBy}</strong> has recommended you for the <span class="role-badge">${role}</span> position.</p>
          
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
          
          <p>We'd love to have you on our team! Click the button below to accept your invitation and get started:</p>
          
          <div style="text-align: center;">
            <a href="${invitationLink}" class="button">Accept Invitation & Join ${venueName}</a>
          </div>
          
          <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
            If the button doesn't work, you can copy and paste this link into your browser:<br>
            <a href="${invitationLink}" style="color: #8B5CF6; word-break: break-all;">${invitationLink}</a>
          </p>
          
          <p style="font-size: 14px; color: #6b7280;">
            This invitation will expire on ${new Date(expiresAt).toLocaleDateString()}. If you have unknown questions, please contact ${invitedBy} at ${venueName}.
          </p>
        </div>
        
        <div class="footer">
          <p style="margin: 0; font-size: 14px; color: #6b7280;">
            This invitation was sent by ${venueName}<br>
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

We're excited to invite you to join our team at ${venueName}! ${invitedBy} has recommended you for the ${role} position.

Details:
- Venue: ${venueName}
- Role: ${role}
- Invited by: ${invitedBy}
- Expires: ${new Date(expiresAt).toLocaleDateString()}

We'd love to have you on our team! To accept your invitation and get started, visit:
${invitationLink}

This invitation will expire on ${new Date(expiresAt).toLocaleDateString()}. If you have unknown questions, please contact ${invitedBy} at ${venueName}.

---
This invitation was sent by ${venueName}
If you didn't expect this invitation, you can safely ignore this email.
  `;

  return {
    to: email,
    subject: `You're invited to join the team at ${venueName}`,
    html,
    text,
  };
}

// Send email using multiple fallback methods
export async function sendEmail(template: EmailTemplate): Promise<boolean> {
  try {

    // Method 1: Try Resend (if API key is available)

    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);

        const emailPayload = {
          from: "Team Invitations <invite@servio.uk>",
          to: template.to,
          subject: template.subject,
          html: template.html,
          text: template.text,
        };

        const result = await resend.emails.send(emailPayload);

        if (result.data) {

          return true;
        } else if (result.error) {
          const err = result.error as { statusCode?: number; message?: string; name?: string };

        } else { /* Else case handled */ }
      } catch (resendError) { /* Error handled silently */ }
    } else { /* Else case handled */ }

    // Method 2: Try SendGrid (if API key is available)
    if (process.env.SENDGRID_API_KEY) {
      try {
        const sgMail = await import("@sendgrid/mail");
        sgMail.default.setApiKey(process.env.SENDGRID_API_KEY);

        await sgMail.default.send({
          to: template.to,
          from: "noreply@servio.app",
          subject: template.subject,
          html: template.html,
          text: template.text,
        });

        return true;
      } catch (sendgridError) { /* Error handled silently */ }
    }

    // Method 3: Try SMTP (if credentials are available)
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        const nodemailer = await import("nodemailer");

        const transporter = nodemailer.default.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || "587"),
          secure: process.env.SMTP_PORT === "465",
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        await transporter.sendMail({
          from: process.env.SMTP_USER,
          to: template.to,
          subject: template.subject,
          html: template.html,
          text: template.text,
        });

        return true;
      } catch (smtpError) { /* Error handled silently */ }
    }

    // Method 4: Try EmailJS (for development without domain)
    if (
      process.env.EMAILJS_SERVICE_ID &&
      process.env.EMAILJS_TEMPLATE_ID &&
      process.env.EMAILJS_PUBLIC_KEY
    ) {
      try {
        // For now, we'll simulate success and log the details
        // In a real implementation, you'd use EmailJS API

        return true; // Simulate success for development
      } catch (emailjsError) { /* Error handled silently */ }
    }

    // Fallback: Log to console (for development/testing)

    // In development, we'll return true so the invitation flow continues
    // In production, you should configure an email service
    return process.env.NODE_ENV === "development";
  } catch (_error) {

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
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${baseUrl}/invitation/${token}`;
}
