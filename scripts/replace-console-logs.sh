#!/bin/bash

# Script to replace console.log with logger
# Usage: ./scripts/replace-console-logs.sh

echo "🔍 Finding console.log statements..."

# Count console.logs
count=$(grep -r "console.log" --include="*.ts" --include="*.tsx" app/ components/ lib/ | wc -l | tr -d ' ')
echo "Found $count console.log statements"

# Create backup
echo "📦 Creating backup..."
cp -r app app.backup
cp -r components components.backup
cp -r lib lib.backup

echo ""
echo "⚠️  Backup created. To restore:"
echo "   rm -rf app components lib"
echo "   mv app.backup app && mv components.backup components && mv lib.backup lib"
echo ""
echo "Ready to replace console.log with logger? (y/n)"
read -r response

if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo "🔄 Replacing console.log..."
    
    # Replace console.log with logger.info
    find app components lib -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's/console\.log(/logger.info(/g' {} +
    
    # Replace console.error with logger.error
    find app components lib -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's/console\.error(/logger.error(/g' {} +
    
    # Replace console.warn with logger.warn
    find app components lib -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's/console\.warn(/logger.warn(/g' {} +
    
    echo "✅ Replacement complete!"
    echo ""
    echo "Next steps:"
    echo "1. Add 'import { logger } from '@/lib/logger';' to files that need it"
    echo "2. Review changes: git diff"
    echo "3. Test the application"
else
    echo "❌ Cancelled"
fi

