# Password Reset Setup Instructions

## Required Configuration in Supabase

The password reset feature requires whitelisting your redirect URL in Supabase.

### Steps:

1. **Go to Supabase Dashboard**
   - Visit: https://app.supabase.com
   - Select your project

2. **Whitelist Redirect URLs**
   - Navigate to: **Authentication** → **URL Configuration**
   - In the **"Redirect URLs"** section, add:
     ```
     https://servio-production.up.railway.app/reset-password
     http://localhost:3000/reset-password
     ```
   - Click **Save**

3. **Verify Email Provider** (should already be configured)
   - Navigate to: **Authentication** → **Providers**
   - Ensure **Email** is enabled

## Testing the Feature

### Test Flow:
1. Go to `/forgot-password`
2. Enter your email address
3. Click "Send Reset Link"
4. Check your email inbox
5. Click the reset link in the email
6. You should be redirected to `/reset-password` page
7. Enter your new password
8. Click "Reset Password"
9. Password should be updated successfully
10. Sign in with your new password

### If You Get "Invalid Link" Error:

The most common cause is that the redirect URL is not whitelisted in Supabase (see Step 2 above).

### How It Works:

1. User requests reset → Email sent with Supabase verification link
2. User clicks link → Goes to Supabase's `/auth/v1/verify` endpoint
3. Supabase validates token → Redirects to your `/reset-password` page with recovery session
4. Your page detects recovery session automatically (via `detectSessionInUrl: true`)
5. User enters new password → Password updated via `supabase.auth.updateUser()`
6. User signed out and redirected to sign-in page

The implementation relies on Supabase's built-in session detection to automatically process the reset tokens when the page loads.
