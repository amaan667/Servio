# End-to-End Testing Checklist

## Changes Made

### 1. Auth Cookie Management
- ✅ Created new `/api/auth/set-session` endpoint that properly uses Supabase's `setSession()` method
- ✅ Updated auth callback to use the new set-session endpoint instead of sync-session
- ✅ Maintained manual cookie setting as backup for redundancy
- ✅ Both sign-in-password and sync-session routes already properly set cookies

### 2. Settings Page
- ✅ Removed unnecessary loading states
- ✅ Settings page now loads instantly using cached sessionStorage data
- ✅ Proper error handling without loading spinners

### 3. Feature Cards (Analytics, Feedback, Settings)
- ✅ Verified FeatureSections component properly displays all cards
- ✅ Analytics, Feedback, and Settings cards only show for owner/manager roles
- ✅ Cards are properly integrated in dashboard page.client.tsx

### 4. Home Page Plan Detection
- ✅ Logic already properly checks venues table subscription_tier first
- ✅ Falls back to organizations table if needed
- ✅ Defaults to "basic" if no plan found
- ✅ Shows correct CTA buttons based on user's current plan

## Testing Steps

### Test 1: Auth Cookie Persistence
1. Sign in with email/password or Google OAuth
2. Verify cookies are set by checking `/api/auth/check-cookies`
3. Navigate to different pages
4. Refresh the page
5. ✅ **Expected**: Session persists across navigation and refreshes

### Test 2: Settings Page Loading
1. Sign in as venue owner
2. Navigate to `/dashboard/[venueId]/settings`
3. ✅ **Expected**: Page loads instantly without loading spinner (uses cached data)
4. Settings form should be immediately visible

### Test 3: Feature Cards Display
1. Sign in as venue owner
2. Navigate to dashboard
3. Scroll to feature sections
4. ✅ **Expected**: See three sections:
   - **Operations**: Live Orders, Kitchen Display, Table Management
   - **Management**: Menu Builder, Staff Management, Inventory, QR Codes
   - **Insights**: Analytics, Feedback, Settings (only for owners/managers)

### Test 4: Home Page Plan Detection
1. Sign in as venue owner with a subscription
2. Navigate to home page (/)
3. Scroll to pricing section
4. ✅ **Expected**: 
   - Current plan shows "Current Plan" button (disabled)
   - Lower tiers show "Downgrade to X" buttons
   - Higher tiers show "Upgrade to X" buttons
5. Try as a user without a subscription
6. ✅ **Expected**: All plans show "Start Free Trial" or "Contact Sales"

### Test 5: Auth Flow - Google OAuth
1. Click "Sign in with Google"
2. Complete OAuth flow
3. Verify redirect to `/auth/callback`
4. Verify session sync to server cookies via `/api/auth/set-session`
5. ✅ **Expected**: Redirected to dashboard with valid session

### Test 6: Auth Flow - Email/Password
1. Sign in with email and password
2. Verify cookies are set on the response
3. Check redirect to appropriate page (dashboard or select-plan)
4. ✅ **Expected**: Valid session with cookies set

### Test 7: Cross-Request Cookie Persistence
1. Sign in successfully
2. Make API request to protected endpoint (e.g., `/api/venues`)
3. Open new tab to the same domain
4. Navigate to dashboard
5. ✅ **Expected**: Session persists across all tabs and requests

## Files Modified

### New Files
- `app/api/auth/set-session/route.ts` - New endpoint using Supabase setSession()

### Modified Files
- `app/api/auth/sign-in-password/route.ts` - Already properly sets cookies
- `app/api/auth/sync-session/route.ts` - Already properly sets cookies
- `app/auth/callback/page.tsx` - Updated to use set-session endpoint
- `app/dashboard/[venueId]/settings/settings-client.tsx` - Removed loading states

## Implementation Notes

### Cookie Setting Strategy
We use a **dual approach** for maximum reliability:

1. **Primary**: Supabase's `setSession()` method (in set-session endpoint)
2. **Backup**: Manual cookie setting with proper options

This ensures cookies are set even if one method fails.

### Cookie Configuration
```typescript
{
  path: "/",
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  httpOnly: false,  // Must be false for Supabase client to read
  maxAge: 60 * 60 * 24 * 7  // 7 days
}
```

### Session Management
- Browser client uses singleton pattern to prevent multiple instances
- Server client properly integrates with Next.js cookies API
- Cached data in sessionStorage prevents UI flicker
- All endpoints properly handle refresh token errors

## Known Behaviors

1. **Settings Page**: Loads instantly from cache, no loading spinner
2. **Feature Cards**: Only owners/managers see Analytics, Feedback, Settings
3. **Plan Detection**: Checks venues.subscription_tier first, then organizations
4. **Auth Cookies**: Set via both setSession() and manual cookie setting

## Success Criteria

✅ All auth endpoints properly set and persist cookies
✅ Settings page loads without blank/loading screen
✅ Feature cards display for appropriate user roles
✅ Home page correctly detects and displays user's subscription tier
✅ Session persists across page navigation and refreshes
✅ Both OAuth and email/password auth flows work correctly

