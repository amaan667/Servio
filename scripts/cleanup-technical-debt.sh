#!/bin/bash

# Technical Debt Cleanup Script
# Removes debug routes, test endpoints, and cleans up TODOs

echo "🧹 Cleaning up technical debt..."

# Count debug/test routes
DEBUG_ROUTES=$(find app/api -name "*.ts" -type f | grep -E "(debug|test)" | wc -l)
echo "📊 Found $DEBUG_ROUTES debug/test routes"

# List debug routes (for review)
echo ""
echo "🔍 Debug/Test routes found:"
find app/api -name "*.ts" -type f | grep -E "(debug|test)" | while read file; do
    echo "  - $file"
done

echo ""
echo "⚠️  These routes should be reviewed and removed in production:"
echo "  - app/api/debug/*"
echo "  - app/api/test/*"
echo "  - app/api/test-*"

# Count TODOs
TODO_COUNT=$(grep -r "TODO\|FIXME\|HACK\|XXX" --include="*.ts" --include="*.tsx" app components lib hooks 2>/dev/null | wc -l)
echo ""
echo "📊 Found $TODO_COUNT TODO/FIXME comments"

# Show TODOs by file
echo ""
echo "📝 TODOs by file (top 10):"
grep -r "TODO\|FIXME\|HACK\|XXX" --include="*.ts" --include="*.tsx" app components lib hooks 2>/dev/null | \
    cut -d: -f1 | \
    sort | \
    uniq -c | \
    sort -rn | \
    head -10

echo ""
echo "✅ Technical debt analysis complete!"
echo ""
echo "💡 Recommendations:"
echo "  1. Remove debug routes in production"
echo "  2. Address high-priority TODOs"
echo "  3. Remove test endpoints"
echo "  4. Clean up commented code"
echo ""
echo "🔒 To remove debug routes (CAREFUL - review first):"
echo "  rm -rf app/api/debug"
echo "  rm -rf app/api/test"
echo "  rm app/api/test-*.ts"

