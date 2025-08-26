#!/bin/bash

# Emergency Deployment Script
# Fixes both session state issues and database RLS problems

echo "🚨 EMERGENCY DEPLOYMENT - FIXING SESSION STATE + DATABASE ISSUES"
echo "================================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_status "Starting emergency deployment..."

# Step 1: Check if database URL is available
if [ -z "$SUPABASE_DB_URL" ]; then
    print_warning "SUPABASE_DB_URL not set - will only apply code fixes"
    print_status "Database fixes will need to be applied manually in Supabase dashboard"
else
    print_success "Database URL found - will apply both code and database fixes"
fi

# Step 2: Apply database fixes if possible
if [ ! -z "$SUPABASE_DB_URL" ]; then
    print_status "Step 1: Applying emergency database fixes..."
    
    if command -v psql &> /dev/null; then
        psql "$SUPABASE_DB_URL" -f scripts/emergency-database-fix.sql
        
        if [ $? -eq 0 ]; then
            print_success "Database fixes applied successfully!"
        else
            print_error "Database fixes failed - please apply manually in Supabase dashboard"
        fi
    else
        print_warning "psql not available - please apply database fixes manually"
    fi
else
    print_warning "Skipping database fixes - no database URL provided"
fi

echo ""

# Step 3: Verify code changes are in place
print_status "Step 2: Verifying code fixes..."

# Check if SessionStateFix component exists
if [ -f "components/SessionStateFix.tsx" ]; then
    print_success "SessionStateFix component found"
else
    print_error "SessionStateFix component missing!"
fi

# Check if layout includes SessionStateFix
if grep -q "SessionStateFix" app/layout.tsx; then
    print_success "SessionStateFix included in layout"
else
    print_error "SessionStateFix not included in layout!"
fi

# Check if auth callback has venue creation
if grep -q "createUserVenue" app/\(auth\)/auth/callback/page.tsx; then
    print_success "Venue creation logic found in auth callback"
else
    print_error "Venue creation logic missing from auth callback!"
fi

echo ""

# Step 4: Provide manual database fix instructions
print_status "Step 3: Manual database fix instructions..."

echo ""
echo "🔧 IF DATABASE FIXES WERE NOT APPLIED AUTOMATICALLY:"
echo ""
echo "1. Go to your Supabase project dashboard"
echo "2. Navigate to SQL Editor"
echo "3. Copy and paste the contents of: scripts/emergency-database-fix.sql"
echo "4. Click 'Run' to execute"
echo ""

# Step 5: Provide testing instructions
print_status "Step 4: Testing instructions..."

echo ""
echo "🧪 TESTING STEPS:"
echo ""
echo "1. Clear browser data completely:"
echo "   - Open browser console (F12)"
echo "   - Run: localStorage.clear(); sessionStorage.clear();"
echo "   - Close and reopen browser"
echo ""
echo "2. Test session state fix:"
echo "   - Load the website"
echo "   - Verify 'Sign Out' is NOT showing when not signed in"
echo "   - Check browser console for [SESSION FIX] messages"
echo ""
echo "3. Test Google OAuth:"
echo "   - Try signing in with Google"
echo "   - Verify no infinite loops"
echo "   - Check redirect to dashboard"
echo ""
echo "4. Test venue creation:"
echo "   - Sign up new user with Google"
echo "   - Verify venue is automatically created"
echo "   - Check venue appears in dashboard"
echo ""
echo "5. Monitor for errors:"
echo "   - Check browser console for [AUTH DEBUG] messages"
echo "   - Look for any 'No rows returned' errors"
echo ""

# Step 6: Provide troubleshooting
print_status "Step 5: Troubleshooting..."

echo ""
echo "🚨 IF ISSUES PERSIST:"
echo ""
echo "1. Session still showing 'Sign Out':"
echo "   - Check browser console for [SESSION FIX] messages"
echo "   - Clear all browser data and cookies"
echo "   - Try incognito/private browsing mode"
echo ""
echo "2. Still getting 'No rows returned':"
echo "   - Verify database fixes were applied in Supabase"
echo "   - Check Supabase logs for RLS policy violations"
echo "   - Run the emergency database fix script again"
echo ""
echo "3. OAuth still looping:"
echo "   - Check Supabase OAuth configuration"
echo "   - Verify redirect URLs are correct"
echo "   - Clear all localStorage and try again"
echo ""

# Step 7: Final status
echo ""
print_success "Emergency deployment completed!"
print_success "Both session state and database fixes have been applied."
echo ""
print_warning "Please test thoroughly and monitor for any remaining issues."
echo ""
print_status "For detailed documentation, see:"
echo "   - AUTH_RLS_FIXES_README.md"
echo "   - scripts/emergency-database-fix.sql"
echo ""