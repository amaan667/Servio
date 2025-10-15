# Staff Invitation Cancel Fix

## Problem
The staff invitation cancel functionality was failing with a 500 error due to a database constraint issue. The constraint `UNIQUE(venue_id, email, status)` prevented cancelling invitations because it would conflict with existing cancelled invitations for the same email.

## Root Cause
1. **Database Constraint Issue**: The unique constraint `UNIQUE(venue_id, email, status)` on the `staff_invitations` table prevented having multiple invitations with the same email for the same venue, even with different statuses.
2. **Cancel Logic**: The cancel endpoint was trying to update the status to 'cancelled' instead of completely removing the invitation.

## Solution

### 1. Database Schema Fix
- **File**: `scripts/fix-invitations-constraint-manual.sql`
- **Changes**: 
  - Removed the problematic unique constraint that included status
  - Added a partial unique index that only prevents multiple pending invitations for the same email/venue
  - This allows cancelled invitations to be completely removed and new ones to be created

### 2. API Logic Fix
- **File**: `app/api/staff/invitations/cancel/route.ts`
- **Changes**:
  - Changed from updating status to 'cancelled' to completely deleting the invitation record
  - This ensures cancelled invitations are completely removed, allowing re-invitation

### 3. Invitation Creation Logic Enhancement
- **File**: `app/api/staff/invitations/route.ts`
- **Changes**:
  - Added better validation to prevent inviting users who already have access to the venue
  - Improved error handling and user feedback

## Benefits
1. **Complete Cancellation**: Cancelled invitations are completely removed from the database
2. **Re-invitation Support**: The same email can be invited again after cancellation
3. **Better User Experience**: Clear error messages and proper validation
4. **Data Integrity**: Maintains proper constraints while allowing the desired workflow

## Manual Steps Required
1. Run the SQL script `scripts/fix-invitations-constraint-manual.sql` in your Supabase dashboard
2. Deploy the updated API endpoints

## Testing
After deployment, test the following scenarios:
1. ✅ Cancel a pending invitation - should completely remove it
2. ✅ Invite the same email again after cancellation - should work
3. ✅ Prevent duplicate pending invitations for the same email
4. ✅ Proper error messages for edge cases
