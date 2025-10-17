#!/bin/bash

# Complete cleanup script for Servio codebase
# Removes all migration files, SQL files, JS files, MD files, and other technical debt

set -e

echo "🧹 Starting complete cleanup..."

# Create backup
echo "📦 Creating backup..."
BACKUP_DIR="../servio-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r . "$BACKUP_DIR/"
echo "✅ Backup created at: $BACKUP_DIR"

# Remove migration files
echo "🗑️  Removing migration files..."
find . -name "*.sql" -type f ! -path "./node_modules/*" ! -path "./.next/*" -delete
echo "✅ Removed all .sql files"

# Remove JS files (keep only TS)
echo "🗑️  Removing JS files..."
find . -name "*.js" -type f ! -path "./node_modules/*" ! -path "./.next/*" -delete
find . -name "*.jsx" -type f ! -path "./node_modules/*" ! -path "./.next/*" -delete
echo "✅ Removed all .js and .jsx files"

# Remove MD documentation files (except README.md and ROADMAP)
echo "🗑️  Removing documentation files..."
find . -name "*.md" -type f ! -name "README.md" ! -name "ROADMAP-TO-10.md" ! -path "./node_modules/*" ! -path "./.next/*" -delete
echo "✅ Removed documentation files"

# Remove backup files
echo "🗑️  Removing backup files..."
find . -name "*.backup" -type f ! -path "./node_modules/*" ! -path "./.next/*" -delete
find . -name "*.old" -type f ! -path "./node_modules/*" ! -path "./.next/*" -delete
find . -name "*.bak" -type f ! -path "./node_modules/*" ! -path "./.next/*" -delete
echo "✅ Removed backup files"

# Remove temporary files
echo "🗑️  Removing temporary files..."
find . -name "*.tmp" -type f ! -path "./node_modules/*" ! -path "./.next/*" -delete
find . -name "*.log" -type f ! -path "./node_modules/*" ! -path "./.next/*" -delete
find . -name "*.swp" -type f ! -path "./node_modules/*" ! -path "./.next/*" -delete
find . -name "*.swo" -type f ! -path "./node_modules/*" ! -path "./.next/*" -delete
echo "✅ Removed temporary files"

# Remove empty directories
echo "🗑️  Removing empty directories..."
find . -type d -empty ! -path "./node_modules/*" ! -path "./.next/*" -delete
echo "✅ Removed empty directories"

# Remove .env.local if exists (should use Railway env vars)
echo "🗑️  Removing .env.local..."
rm -f .env.local
echo "✅ Removed .env.local"

# Remove docs folder (migrations are now in separate repo)
echo "🗑️  Removing docs folder..."
rm -rf docs
echo "✅ Removed docs folder"

# Remove scripts folder (cleanup scripts no longer needed)
echo "🗑️  Removing scripts folder..."
rm -rf scripts
echo "✅ Removed scripts folder"

# Remove migrations folder if it exists
echo "🗑️  Removing migrations folder..."
rm -rf migrations
echo "✅ Removed migrations folder"

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "📊 Summary:"
echo "  - Removed all .sql files"
echo "  - Removed all .js and .jsx files"
echo "  - Removed documentation files"
echo "  - Removed backup files"
echo "  - Removed temporary files"
echo "  - Removed empty directories"
echo "  - Removed .env.local"
echo "  - Removed docs, scripts, and migrations folders"
echo ""
echo "💾 Backup location: $BACKUP_DIR"
echo ""
echo "Next steps:"
echo "1. Review changes: git status"
echo "2. Commit: git add -A && git commit -m 'Complete cleanup: remove all migration/SQL/JS/MD files'"
echo "3. Push: git push origin main"

