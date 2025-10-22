#!/bin/bash

echo "🔧 Fixing all TypeScript errors..."

# Fix missing await on createClient
find app/api -name "*.ts" -type f -exec sed -i '' 's/const supabase = createClient();/const supabase = await createClient();/g' {} \;

# Fix remaining user destructuring patterns
find app/api -name "*.ts" -type f -exec sed -i '' 's/const { data: { user } } = await supa\.auth\.getSession();/const { data: { session } } = await supa.auth.getSession();\n    const user = session?.user;/g' {} \;

# Fix unused request parameters
find app/api -name "*.ts" -type f -exec sed -i '' 's/export async function DELETE(request: NextRequest,/export async function DELETE(_request: NextRequest,/g' {} \;
find app/api -name "*.ts" -type f -exec sed -i '' 's/export async function PUT(request: NextRequest,/export async function PUT(_request: NextRequest,/g' {} \;
find app/api -name "*.ts" -type f -exec sed -i '' 's/export async function PATCH(request: NextRequest,/export async function PATCH(_request: NextRequest,/g' {} \;

# Fix unused imports
find app/api -name "*.ts" -type f -exec sed -i '' 's/import { getSupabaseClient } from/\/\/ import { getSupabaseClient } from/g' {} \;

echo "✅ Fixed TypeScript errors"

