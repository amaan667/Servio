#!/bin/bash

echo "🚀 Servio Environment Setup"
echo "=========================="
echo ""


# [FIX] Writing file to .env.local in project root
echo "📝 [FIX] Writing file to .env.local in project root"

# Ensure we're in the project root directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Check if .env.local exists
if [ -f ".env.local" ]; then
    echo "✅ .env.local file found"
else
    echo "❌ .env.local file not found"
    echo "Creating .env.local from template..."
    
    # Create .env.local from example if it exists
    if [ -f ".env.local.example" ]; then
        cp .env.local.example .env.local
        echo "✅ Created .env.local from .env.local.example"
    else
        echo "❌ .env.local.example not found"
        echo "Please create a .env.local file with your Supabase credentials"
        exit 1
    fi
fi

# Check Supabase environment variables
echo ""
echo "Checking Supabase configuration..."

if grep -q "your-project.supabase.co" .env.local; then
    echo "❌ NEXT_PUBLIC_SUPABASE_URL needs to be configured"
    echo "   Please replace 'https://your-project.supabase.co' with your actual Supabase URL"
else
    echo "✅ NEXT_PUBLIC_SUPABASE_URL appears to be configured"
fi

if grep -q "your_supabase_anon_key_here" .env.local; then
    echo "❌ NEXT_PUBLIC_SUPABASE_ANON_KEY needs to be configured"
    echo "   Please replace 'your_supabase_anon_key_here' with your actual Supabase anon key"
else
    echo "✅ NEXT_PUBLIC_SUPABASE_ANON_KEY appears to be configured"
fi

echo ""
echo "📋 Next Steps:"
echo "1. Go to your Supabase project dashboard"
echo "2. Navigate to Settings → API"
echo "3. Copy the Project URL and anon/public key"
echo "4. Update the .env.local file with your actual values"
echo "5. Restart the development server: npm run dev"
echo ""
echo "🔗 Supabase Dashboard: https://supabase.com/dashboard"
echo ""
echo "After setting up your credentials, the dashboard should work properly!"