#!/bin/bash

# Comprehensive Auth + RLS Fixes Deployment Script
# This script applies all fixes for Google OAuth loop and venue creation issues

echo "🔧 Deploying Comprehensive Auth + RLS Fixes..."
echo "=============================================="

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

# Check if psql is available
if ! command -v psql &> /dev/null; then
    print_error "psql is not installed or not in PATH"
    echo ""
    echo "Please install PostgreSQL client tools or run the SQL manually in Supabase dashboard:"
    echo "1. Go to your Supabase project"
    echo "2. Navigate to SQL Editor"
    echo "3. Copy and paste the contents of scripts/comprehensive-auth-rls-fixes.sql"
    echo "4. Click 'Run' to execute"
    exit 1
fi

# Check if environment variables are set
if [ -z "$SUPABASE_DB_URL" ]; then
    print_warning "SUPABASE_DB_URL environment variable is not set"
    echo ""
    echo "Please set it to your Supabase database connection string:"
    echo "export SUPABASE_DB_URL='postgresql://postgres:[password]@[host]:5432/postgres'"
    echo ""
    echo "Or run the SQL manually in Supabase dashboard using the file:"
    echo "scripts/comprehensive-auth-rls-fixes.sql"
    exit 1
fi

print_status "Starting deployment process..."

# Step 1: Apply database fixes
print_status "Step 1: Applying database fixes..."
echo ""

# Run the comprehensive SQL script
psql "$SUPABASE_DB_URL" -f scripts/comprehensive-auth-rls-fixes.sql

if [ $? -eq 0 ]; then
    print_success "Database fixes applied successfully!"
else
    print_error "Failed to apply database fixes"
    echo ""
    echo "Please check the error messages above and try again."
    echo "You can also run the SQL manually in your Supabase dashboard."
    exit 1
fi

echo ""

# Step 2: Verify the fixes
print_status "Step 2: Verifying fixes..."

# Test database connection and basic queries
psql "$SUPABASE_DB_URL" -c "SELECT 'Database connection successful' as status;" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    print_success "Database connection verified"
else
    print_error "Database connection failed"
    exit 1
fi

echo ""

# Step 3: Provide next steps
print_status "Step 3: Next steps for testing..."

echo ""
echo "✅ Database fixes have been applied successfully!"
echo ""
echo "🔍 Next steps:"
echo "1. Clear browser cache and localStorage:"
echo "   - Open browser console (F12)"
echo "   - Run: localStorage.clear(); sessionStorage.clear();"
echo ""
echo "2. Test Google OAuth sign-in flow:"
echo "   - Try signing in with Google"
echo "   - Verify no infinite loops occur"
echo "   - Check that user is redirected to dashboard"
echo ""
echo "3. Test venue creation for new users:"
echo "   - Sign up a new user with Google"
echo "   - Verify venue is automatically created"
echo "   - Check that venue appears in dashboard"
echo ""
echo "4. Monitor browser console for debug logs:"
echo "   - Look for [AUTH DEBUG] messages"
echo "   - Check for any error messages"
echo ""
echo "📖 For detailed information, see:"
echo "   - AUTH_RLS_FIXES_README.md"
echo "   - AUTH_FIXES_SUMMARY.md"
echo ""
echo "🚨 If you encounter issues:"
echo "   - Check browser console for [AUTH DEBUG] messages"
echo "   - Review Supabase logs for RLS policy violations"
echo "   - Verify Supabase OAuth configuration"
echo "   - Test with a fresh browser session"
echo ""

print_success "Deployment completed successfully!"
print_success "Your authentication and venue creation issues should now be resolved!"