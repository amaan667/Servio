#!/bin/bash

# Deploy fix for duplicate reservations issue
# This ensures each table shows only one reservation at a time

echo "🔧 Deploying duplicate reservations fix..."

# Check if we're in the right directory
if [ ! -f "scripts/fix-duplicate-reservations.sql" ]; then
    echo "❌ Error: fix-duplicate-reservations.sql not found"
    echo "Please run this script from the project root directory"
    exit 1
fi

echo "📋 Instructions for manual deployment:"
echo ""
echo "1. Open your Supabase project dashboard"
echo "2. Go to the SQL Editor"
echo "3. Copy and paste the contents of scripts/fix-duplicate-reservations.sql"
echo "4. Run the SQL script"
echo ""
echo "This will fix the issue where the same reservations were showing up multiple times"
echo "for each table. Now each table will show only one reservation at a time."
echo ""
echo "✅ After running the SQL script, each table will display only its most recent reservation"
echo ""
echo "📁 SQL file location: scripts/fix-duplicate-reservations.sql"

# Show the SQL content for easy copying
echo ""
echo "📄 SQL Content to run in Supabase:"
echo "=================================="
cat scripts/fix-duplicate-reservations.sql
echo "=================================="
