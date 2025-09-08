#!/bin/bash

# Deploy partitioned orders system
# This script updates the database function to ensure orders appear in only one tab

echo "🚀 Deploying partitioned orders system..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Check if Railway CLI is available
if ! command -v railway &> /dev/null; then
    echo "❌ Error: Railway CLI not found. Please install it first:"
    echo "   npm install -g @railway/cli"
    exit 1
fi

# Check if we're logged into Railway
if ! railway whoami &> /dev/null; then
    echo "❌ Error: Not logged into Railway. Please run 'railway login' first"
    exit 1
fi

echo "📊 Updating dashboard_counts function..."

# Get the absolute path to the project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "📁 Project root: $PROJECT_ROOT"

# Check Railway environment
echo "🔍 Checking Railway environment..."
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  DATABASE_URL not set, trying to get it from Railway..."
    DATABASE_URL=$(railway variables get DATABASE_URL 2>/dev/null)
    if [ -z "$DATABASE_URL" ]; then
        echo "⚠️  DATABASE_URL not available, but we can proceed with Supabase connection"
        echo "🔗 Using Supabase connection instead..."
    else
        echo "✅ DATABASE_URL retrieved from Railway"
        echo "🔗 DATABASE_URL: ${DATABASE_URL:0:50}..."
    fi
fi

# Check if the SQL file exists
SQL_FILE="$PROJECT_ROOT/scripts/update-dashboard-counts-partitioned.sql"
if [ ! -f "$SQL_FILE" ]; then
    echo "❌ Error: SQL file not found at $SQL_FILE"
    exit 1
fi

echo "📄 SQL file found at: $SQL_FILE"

# Apply the new database function
if [ -n "$DATABASE_URL" ]; then
    echo "🔧 Running SQL update via Railway..."
    railway run -- psql $DATABASE_URL -f "$SQL_FILE"
    
    if [ $? -eq 0 ]; then
        echo "✅ Database function updated successfully"
    else
        echo "❌ Error updating database function"
        exit 1
    fi
else
    echo "⚠️  Skipping database update (no DATABASE_URL)"
    echo "📋 You'll need to apply the database changes manually:"
    echo "   1. Connect to your Supabase database"
    echo "   2. Run the SQL from: $SQL_FILE"
    echo "   3. Or use the Supabase dashboard to run the SQL"
fi

echo "🔧 Installing new dependencies..."

# Install date-fns-tz
pnpm add date-fns@^3.0.0 date-fns-tz

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully"
else
    echo "❌ Error installing dependencies"
    exit 1
fi

echo "🚀 Deploying to Railway..."

# Deploy the application
railway up

if [ $? -eq 0 ]; then
    echo "✅ Application deployed successfully!"
    echo ""
    echo "🎉 Partitioned orders system is now live!"
    echo ""
    echo "📋 What was implemented:"
    echo "   • Live (Last 30 min): created_at >= now - 30m (regardless of day)"
    echo "   • Today (All Orders): placed today in venue's timezone and created_at < now - 30m"
    echo "   • History: created_at < startOfToday"
    echo "   • Rules precedence: LIVE takes priority over TODAY; anything not today falls into HISTORY"
    echo ""
    echo "🔍 Key features:"
    echo "   • Same order never shows in more than one tab"
    echo "   • Switching tabs doesn't change counts"
    echo "   • At midnight, orders within last 30 min remain in Live"
    echo "   • Counts and lists use the same filters"
    echo "   • Venue timezone aware"
else
    echo "❌ Error deploying application"
    exit 1
fi
