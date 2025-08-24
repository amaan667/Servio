# Environment Setup Guide

## Critical Issue: Missing Environment Variables

The authentication errors you're experiencing are caused by missing environment variables. Here's how to fix them:

## Required Environment Variables

Create a `.env.local` file in your project root with these variables:

```env
# Supabase Configuration (REQUIRED)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# App URLs (REQUIRED for OAuth callbacks)
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
NEXT_PUBLIC_SITE_URL=https://your-production-domain.com

# For local development, use:
# NEXT_PUBLIC_APP_URL=http://localhost:3000
# NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## How to Get Your Supabase Credentials

1. **Go to your Supabase Dashboard**: https://app.supabase.com
2. **Select your project**
3. **Go to Settings → API**
4. **Copy the following values**:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Setting Up OAuth (Google, etc.)

1. **In Supabase Dashboard → Authentication → URL Configuration**:
   - **Site URL**: `https://your-domain.com`
   - **Redirect URLs**: Add these URLs:
     - `https://your-domain.com/api/auth/callback`
     - `https://your-domain.com/auth/callback`
     - For local development: `http://localhost:3000/api/auth/callback`

2. **Configure OAuth providers** in Authentication → Providers

## Error Resolution

### Current Errors and Their Fixes:

#### 1. "Invalid Refresh Token: Refresh Token Not Found"
- **Cause**: Supabase client not properly initialized due to missing environment variables
- **Fix**: Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

#### 2. "exchangeCodeForSession failed: invalid request: both auth code and code verifier should be non-empty"
- **Cause**: OAuth callback fails because Supabase client isn't configured
- **Fix**: Set environment variables and ensure OAuth redirect URLs are correct

#### 3. Punycode deprecation warning
- **Status**: Already handled in `next.config.mjs`
- **Impact**: Non-critical, doesn't affect functionality

## Quick Setup Steps

1. **Create `.env.local`**:
   ```bash
   cp .env.example .env.local
   ```

2. **Edit `.env.local`** with your actual Supabase credentials

3. **Restart your development server**:
   ```bash
   npm run dev
   ```

4. **Verify configuration**:
   ```bash
   npm run check-env
   ```

## Environment Variable Priority

Next.js loads environment variables in this order:
1. `.env.local` (highest priority, ignored by git)
2. `.env.production` or `.env.development`
3. `.env`

## Security Notes

- **Never commit `.env.local`** to version control
- **Only commit `.env.example`** with placeholder values
- **Use Railway/Vercel environment variables** for production

## Testing the Fix

After setting up the environment variables:

1. **Clear browser storage**:
   ```javascript
   // In browser console:
   localStorage.clear();
   sessionStorage.clear();
   ```

2. **Restart the application**:
   ```bash
   npm run dev
   ```

3. **Test authentication**:
   - Try signing in
   - Check browser console for `[SUPABASE-CLIENT] ✅ Client initialized successfully`
   - OAuth should work without code verifier errors

## Production Deployment

For production platforms like Railway, Vercel, etc.:

1. **Set environment variables in your platform's dashboard**
2. **Update OAuth redirect URLs** to use your production domain
3. **Ensure CORS settings** in Supabase allow your domain

## Need Help?

If you continue experiencing issues after setting up environment variables:

1. **Check the browser console** for detailed error messages
2. **Use `/clear-sessions`** to manually clear any corrupted sessions
3. **Verify Supabase project status** in the dashboard
4. **Check OAuth provider configuration** (Google, etc.)