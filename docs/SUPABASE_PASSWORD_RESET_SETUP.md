# Supabase Password Reset Configuration

This document explains how to properly configure Supabase for password reset functionality.

## Problem

Users clicking password reset links from email see "Invalid or expired reset link" error, even when the link is fresh.

## Root Cause

The password reset redirect URL is not whitelisted in Supabase's URL configuration. When Supabase processes the reset token and tries to redirect to `/reset-password`, it fails if the URL isn't whitelisted.

## Solution: Configure Supabase Dashboard

### 1. Whitelist Redirect URLs

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Navigate to: **Authentication** → **URL Configuration**
4. Add these URLs to the **Redirect URLs** list:
   - Production: `https://servio-production.up.railway.app/reset-password`
   - Development: `http://localhost:3000/reset-password`
   - Any other domains you use: `https://yourdomain.com/reset-password`

**Important**: The URL must match EXACTLY - including protocol (https/http), domain, and path.

### 2. Verify Email Provider

1. Navigate to: **Authentication** → **Providers**
2. Ensure **Email** provider is **enabled**
3. Check that "Confirm email" is configured as desired

### 3. Configure Email Template (Optional but Recommended)

1. Navigate to: **Authentication** → **Email Templates**
2. Select **Reset Password** template
3. Verify the template contains the correct reset link:
   ```
   <a href="{{ .ConfirmationURL }}">Reset Password</a>
   ```
4. Customize the email design/copy as needed

### 4. Check Site URL

1. Navigate to: **Authentication** → **URL Configuration**
2. Set **Site URL** to your production URL:
   - Production: `https://servio-production.up.railway.app`

## How Password Reset Flow Works

1. **User requests reset**: Clicks "Forgot Password" → enters email
2. **API sends email**: `/api/auth/forgot-password` calls `supabase.auth.resetPasswordForEmail()`
3. **Supabase sends email**: Contains link to `https://SUPABASE_URL/auth/v1/verify?token=...&type=recovery&redirect_to=YOUR_APP/reset-password`
4. **User clicks link**: Browser goes to Supabase verify endpoint
5. **Supabase validates token**: Checks if token is valid and not expired
6. **Supabase redirects**: If valid, redirects to `/reset-password` with tokens in URL:
   - Hash fragments: `#access_token=...&type=recovery&refresh_token=...`
   - OR PKCE code: `?code=...`
7. **Reset page processes tokens**: `/reset-password` page extracts tokens and creates recovery session
8. **User sets new password**: Form submits, password is updated via `supabase.auth.updateUser()`

## Common Issues and Solutions

### Issue: "Invalid or expired reset link"

**Possible Causes:**
1. ❌ Redirect URL not whitelisted in Supabase
   - **Solution**: Add your `/reset-password` URL to Supabase → Authentication → URL Configuration → Redirect URLs

2. ❌ Link is actually expired (default: 1 hour)
   - **Solution**: Request a new reset link
   - **Note**: You can adjust token expiration in Supabase settings

3. ❌ Link already used (one-time use)
   - **Solution**: Request a new reset link
   - **Note**: Each reset link can only be used once for security

4. ❌ Opening link in different browser/device
   - **Solution**: Open the link in the same browser/device where you requested the reset

5. ❌ Email client mangling the URL
   - **Solution**: Try copying the full URL and pasting it into your browser

### Issue: Link works but page shows error

**Possible Causes:**
1. ❌ Client-side routing stripping URL fragments
   - **Solution**: Already handled in `/reset-password` page with proper token extraction

2. ❌ Browser blocking third-party cookies
   - **Solution**: Allow cookies for your site

3. ❌ PKCE verifier missing (OAuth flow)
   - **Note**: This only affects OAuth, not password reset

## Testing Password Reset

### Test in Development

1. Start development server: `npm run dev`
2. Ensure `http://localhost:3000/reset-password` is whitelisted in Supabase
3. Go to `/forgot-password`
4. Enter your email
5. Check your email inbox
6. Click the reset link
7. Should redirect to `http://localhost:3000/reset-password` with valid session
8. Set new password

### Test in Production

1. Ensure `https://servio-production.up.railway.app/reset-password` is whitelisted
2. Go to `https://servio-production.up.railway.app/forgot-password`
3. Follow same steps as development

## Environment Variables

Ensure these are set correctly:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=https://servio-production.up.railway.app
```

## Debugging

The reset password page has extensive logging. Check browser console for:

```
[RESET PASSWORD PAGE] Page loaded: {...}
[RESET PASSWORD] Starting session check: {...}
[RESET PASSWORD] Hash tokens detected...
[RESET PASSWORD] ✅ Session established...
```

If you see errors, the logs will indicate:
- Whether tokens were found in URL
- Whether token validation succeeded
- Specific error messages from Supabase

## Token Expiration Settings

Default Supabase settings:
- **Password reset token**: 1 hour (3600 seconds)
- **Email confirmation token**: 24 hours

To change:
1. Go to Supabase Dashboard
2. Navigate to: **Authentication** → **Policies**
3. Adjust token lifetime settings

## Security Notes

- ✅ Reset links expire after 1 hour
- ✅ Each link can only be used once
- ✅ Tokens are validated server-side by Supabase
- ✅ Old password is invalidated after reset
- ✅ User is signed out after password change (requires re-login)

## Support

If issues persist:
1. Check Supabase logs: Dashboard → Logs → Auth
2. Check browser console for detailed error logs
3. Verify all redirect URLs are whitelisted
4. Ensure email provider is properly configured
5. Test with a different email address
