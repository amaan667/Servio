#!/bin/bash
# Ultra-aggressive script to eliminate ALL 'any' types

echo "🔧 Ultra-aggressive fix for ALL remaining 'any' types..."

# Find all TypeScript files
find app lib components hooks -name "*.ts" -o -name "*.tsx" | while read file; do
  # Skip node_modules and .next
  if [[ "$file" == *"node_modules"* ]] || [[ "$file" == *".next"* ]]; then
    continue
  fi
  
  # Create backup
  cp "$file" "$file.bak3"
  
  # Ultra-aggressive replacements
  sed -i '' 's/:\s*any\b/: unknown/g' "$file"
  sed -i '' 's/:\s*any\[/: unknown[/g' "$file"
  sed -i '' 's/:\s*any,/:/g' "$file"
  sed -i '' 's/:\s*any)/: unknown)/g' "$file"
  sed -i '' 's/:\s*any}/: unknown}/g' "$file"
  sed -i '' 's/:\s*any;/: unknown;/g' "$file"
  sed -i '' 's/:\s*any$/:/g' "$file"
  sed -i '' 's/<any>/<unknown>/g' "$file"
  sed -i '' 's/Array<any>/Array<unknown>/g' "$file"
  sed -i '' 's/Promise<any>/Promise<unknown>/g' "$file"
  sed -i '' 's/Record<string,\s*any>/Record<string, unknown>/g' "$file"
  sed -i '' 's/Map<string,\s*any>/Map<string, unknown>/g' "$file"
  sed -i '' 's/Set<any>/Set<unknown>/g' "$file"
  
  # Remove backup if no changes
  if cmp -s "$file" "$file.bak3"; then
    rm "$file.bak3"
  fi
done

echo "✅ Done! Fixed ALL remaining 'any' types."
echo "📝 Review changes and test your code."
echo "🗑️  Backup files (.bak3) have been created. Remove them when satisfied."

