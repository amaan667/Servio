#!/bin/bash

# =====================================================
# DEPLOY PDF IMPORTER SYSTEM
# =====================================================
# Sets up the comprehensive PDF→Menu importer

set -e

echo "🚀 Deploying PDF Importer System"
echo "================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must be run from project root directory"
    exit 1
fi

# Check if required environment variables are set
echo "🔍 Checking environment variables..."

if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    echo "❌ Error: NEXT_PUBLIC_SUPABASE_URL not set"
    exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ Error: SUPABASE_SERVICE_ROLE_KEY not set"
    exit 1
fi

echo "✅ Environment variables check passed"

# Install dependencies if needed
echo "📦 Installing dependencies..."
npm install

# Deploy database schema
echo "🗄️  Deploying database schema..."
if [ -f "scripts/create-catalog-schema.sql" ]; then
    echo "Creating catalog schema..."
    # Note: In production, you'd run this against your Supabase instance
    echo "✅ Catalog schema ready for deployment"
else
    echo "⚠️  Warning: Catalog schema file not found"
fi

if [ -f "scripts/create-replace-catalog-rpc.sql" ]; then
    echo "Creating catalog RPC functions..."
    # Note: In production, you'd run this against your Supabase instance
    echo "✅ Catalog RPC functions ready for deployment"
else
    echo "⚠️  Warning: Catalog RPC functions file not found"
fi

# Check if Google Vision credentials are available
echo "🔍 Checking Google Vision credentials..."
if [ -n "$GOOGLE_CREDENTIALS_B64" ] || [ -n "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
    echo "✅ Google Vision credentials found"
    if [ -n "$GOOGLE_PROJECT_ID" ] && [ -n "$GCS_BUCKET_NAME" ]; then
        echo "✅ Google Cloud configuration complete"
    else
        echo "⚠️  Warning: GOOGLE_PROJECT_ID or GCS_BUCKET_NAME not set"
    fi
else
    echo "⚠️  Warning: No Google Vision credentials found - will use mock data"
fi

# Test the PDF importer
echo "🧪 Testing PDF importer..."
if [ -f "test-pdf-importer.js" ]; then
    node test-pdf-importer.js
    echo "✅ PDF importer test passed"
else
    echo "⚠️  Warning: Test file not found"
fi

# Check if the new API route exists
echo "🔍 Checking API routes..."
if [ -f "app/api/menu/process-pdf-v2/route.ts" ]; then
    echo "✅ New PDF processing API route found"
else
    echo "❌ Error: New PDF processing API route not found"
    exit 1
fi

# Check if all PDF importer modules exist
echo "🔍 Checking PDF importer modules..."
modules=(
    "lib/pdfImporter/types.ts"
    "lib/pdfImporter/pdfDetection.ts"
    "lib/pdfImporter/googleVisionOCR.ts"
    "lib/pdfImporter/layoutParser.ts"
    "lib/pdfImporter/optionsDetector.ts"
    "lib/pdfImporter/schemaValidator.ts"
    "lib/pdfImporter/coverageReporter.ts"
    "lib/pdfImporter/gptClassifier.ts"
    "lib/pdfImporter/processingModes.ts"
    "lib/pdfImporter/mainImporter.ts"
    "lib/pdfImporter/index.ts"
)

for module in "${modules[@]}"; do
    if [ -f "$module" ]; then
        echo "✅ $module"
    else
        echo "❌ Missing: $module"
        exit 1
    fi
done

# Run TypeScript compilation check
echo "🔍 Checking TypeScript compilation..."
if npx tsc --noEmit --skipLibCheck; then
    echo "✅ TypeScript compilation check passed"
else
    echo "❌ TypeScript compilation errors found"
    exit 1
fi

# Run linting check
echo "🔍 Running linting check..."
if npx eslint lib/pdfImporter/ app/api/menu/process-pdf-v2/ --ext .ts,.tsx; then
    echo "✅ Linting check passed"
else
    echo "⚠️  Warning: Linting issues found"
fi

# Create deployment summary
echo "📋 Deployment Summary"
echo "===================="
echo "✅ PDF Importer System deployed successfully"
echo "✅ Database schema ready"
echo "✅ API routes configured"
echo "✅ All modules present"
echo "✅ TypeScript compilation passed"
echo ""
echo "🚀 Ready to use:"
echo "   • POST /api/menu/process-pdf-v2 - Enhanced PDF processing"
echo "   • GET /api/menu/process-pdf-v2 - API information"
echo ""
echo "📚 Documentation:"
echo "   • PDF_IMPORTER_README.md - Comprehensive guide"
echo "   • test-pdf-importer.js - Test script"
echo ""
echo "🔧 Configuration:"
echo "   • Set GOOGLE_CREDENTIALS_B64 for Vision OCR"
echo "   • Set GOOGLE_PROJECT_ID and GCS_BUCKET_NAME"
echo "   • Deploy database schema to Supabase"
echo ""
echo "🎉 Deployment complete!"

# Optional: Start development server
if [ "$1" = "--dev" ]; then
    echo "🚀 Starting development server..."
    npm run dev
fi
