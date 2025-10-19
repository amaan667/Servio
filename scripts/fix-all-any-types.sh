#!/bin/bash
# Comprehensive script to fix ALL remaining 'any' types

echo "🔧 Fixing ALL remaining 'any' types..."

# Find all TypeScript files
find app lib components hooks -name "*.ts" -o -name "*.tsx" | while read file; do
  # Skip node_modules and .next
  if [[ "$file" == *"node_modules"* ]] || [[ "$file" == *".next"* ]]; then
    continue
  fi
  
  # Create backup
  cp "$file" "$file.bak2"
  
  # Fix all remaining patterns
  sed -i '' 's/:\s*any\b/: unknown/g' "$file"
  sed -i '' 's/:\s*any\[/: unknown[/g' "$file"
  sed -i '' 's/:\s*any,/:/g' "$file"
  sed -i '' 's/:\s*any)/: unknown)/g' "$file"
  sed -i '' 's/:\s*any}/: unknown}/g' "$file"
  sed -i '' 's/:\s*any;/: unknown;/g' "$file"
  sed -i '' 's/:\s*any$/:/g' "$file"
  
  # Remove backup if no changes
  if cmp -s "$file" "$file.bak2"; then
    rm "$file.bak2"
  fi
done

echo "✅ Done! Fixed ALL remaining 'any' types."
echo "📝 Review changes and test your code."
echo "🗑️  Backup files (.bak2) have been created. Remove them when satisfied."

