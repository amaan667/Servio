# Mobile Authentication Troubleshooting Guide

## Issue Description
Users are experiencing "Application Error" when trying to sign in on mobile devices. The error shows a client-side exception during application loading.

## Recent Fixes Applied

### 1. Improved Mobile Detection
- Enhanced mobile device detection to include more mobile keywords
- Added screen width detection as fallback
- Better handling of mobile-specific OAuth flows

### 2. Enhanced Error Handling
- Added comprehensive error boundaries for authentication components
- Improved error messages with specific guidance
- Better timeout handling for OAuth operations

### 3. Session State Management
- Disabled automatic session persistence to prevent conflicts
- Added thorough auth state clearing before OAuth initiation
- Improved storage cleanup (localStorage, sessionStorage, cookies)

### 4. OAuth Flow Improvements
- Added timeout protection for OAuth operations
- Better handling of PKCE errors
- Improved redirect URL handling for mobile

## Testing Steps

### 1. Run Debug Script
Open the browser console on mobile and run:
```javascript
// Copy and paste the contents of debug-mobile-auth.js
```

### 2. Check Environment Variables
Verify these are set correctly:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL` (should be `https://servio-production.up.railway.app`)

### 3. Test Authentication Flow
1. Clear browser cache and cookies
2. Navigate to `/sign-in`
3. Click "Sign in with Google"
4. Complete OAuth flow
5. Check if redirected to dashboard successfully

## Common Issues and Solutions

### Issue: "Application Error" on page load
**Solution:**
- Clear browser cache and cookies
- Try in incognito/private mode
- Check network connectivity

### Issue: OAuth redirect fails
**Solution:**
- Verify redirect URL is correct in Supabase settings
- Check if mobile browser blocks popups
- Try using external browser for OAuth

### Issue: PKCE errors
**Solution:**
- Clear all auth-related storage
- Restart the authentication flow
- Check if using latest version of Supabase client

### Issue: Network timeouts
**Solution:**
- Check internet connection
- Try on different network (WiFi vs mobile data)
- Verify Supabase service status

## Debug Information

### Console Logs to Look For
- `[AUTH DEBUG]` - Authentication flow logs
- `[SUPABASE]` - Supabase client logs
- `[AUTH CALLBACK]` - OAuth callback logs

### Error Patterns
- Missing environment variables
- Network connectivity issues
- OAuth state mismatches
- Session persistence conflicts

## Environment-Specific Notes

### Production Environment
- URL: `https://servio-production.up.railway.app`
- Ensure all environment variables are set in Railway
- Check Railway logs for server-side errors

### Development Environment
- URL: `http://localhost:3000`
- May need to configure OAuth redirect URLs in Supabase
- Check for CORS issues

## Support Steps

If the issue persists:

1. **Collect Debug Information:**
   - Run the debug script and save output
   - Take screenshots of error messages
   - Note browser type and version

2. **Check Supabase Dashboard:**
   - Verify OAuth settings
   - Check authentication logs
   - Ensure redirect URLs are correct

3. **Test on Different Devices:**
   - Try different mobile browsers
   - Test on desktop for comparison
   - Check if issue is device-specific

## Recent Changes Made

### Files Modified:
- `app/sign-in/page.tsx` - Improved mobile auth flow
- `app/auth/callback/page.tsx` - Enhanced error handling
- `lib/supabase/browser.ts` - Better session management
- `components/auth-error-boundary.tsx` - New error boundary component

### Key Improvements:
- Better mobile detection
- Comprehensive error handling
- Improved OAuth flow reliability
- Enhanced debugging capabilities

## Next Steps

1. Deploy the updated code
2. Test on various mobile devices
3. Monitor error logs
4. Collect user feedback
5. Iterate based on findings