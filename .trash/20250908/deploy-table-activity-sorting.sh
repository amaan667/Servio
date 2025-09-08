#!/bin/bash

# Deploy table activity sorting updates
# This script updates the database view to support sorting tables by most recent activity

echo "🚀 Deploying table activity sorting updates..."

# Check if we're in the right directory
if [ ! -f "scripts/update-tables-view-with-activity-sorting.sql" ]; then
    echo "❌ Error: update-tables-view-with-activity-sorting.sql not found"
    echo "Please run this script from the project root directory"
    exit 1
fi

echo "📋 Instructions for manual deployment:"
echo ""
echo "1. Open your Supabase project dashboard"
echo "2. Go to the SQL Editor"
echo "3. Copy and paste the contents of scripts/update-tables-view-with-activity-sorting.sql"
echo "4. Run the SQL script"
echo ""
echo "This will update the tables_with_sessions view to include the most_recent_activity field"
echo "which enables sorting tables by their most recent actions (bookings, status changes, etc.)"
echo ""
echo "✅ After running the SQL script, tables will be sorted by most recent activity instead of alphabetically"
echo ""
echo "📁 SQL file location: scripts/update-tables-view-with-activity-sorting.sql"

# Show the SQL content for easy copying
echo ""
echo "📄 SQL Content to run in Supabase:"
echo "=================================="
cat scripts/update-tables-view-with-activity-sorting.sql
echo "=================================="
