#!/bin/bash
# Script to automatically fix common 'any' type patterns

echo "🔧 Fixing common 'any' type patterns..."

# Find all TypeScript files
find app lib components hooks -name "*.ts" -o -name "*.tsx" | while read file; do
  # Skip node_modules and .next
  if [[ "$file" == *"node_modules"* ]] || [[ "$file" == *".next"* ]]; then
    continue
  fi
  
  # Create backup
  cp "$file" "$file.bak"
  
  # Fix error handling patterns
  # Replace: catch (error: any) { with catch (error: unknown) {
  sed -i '' 's/catch (error: any) {/catch (error: unknown) {/g' "$file"
  sed -i '' 's/catch (err: any) {/catch (err: unknown) {/g' "$file"
  sed -i '' 's/catch (e: any) {/catch (e: unknown) {/g' "$file"
  
  # Fix common variable declarations
  # Replace: const data: any = with const data: unknown =
  sed -i '' 's/const data: any =/const data: unknown =/g' "$file"
  sed -i '' 's/const result: any =/const result: unknown =/g' "$file"
  sed -i '' 's/const response: any =/const response: unknown =/g' "$file"
  sed -i '' 's/const payload: any =/const payload: unknown =/g' "$file"
  
  # Fix function parameters
  # Replace: (data: any) => with (data: unknown) =>
  sed -i '' 's/(data: any) =>/(data: unknown) =>/g' "$file"
  sed -i '' 's/(payload: any) =>/(payload: unknown) =>/g' "$file"
  sed -i '' 's/(result: any) =>/(result: unknown) =>/g' "$file"
  
  # Fix array types
  # Replace: Array<any> with Array<unknown>
  sed -i '' 's/Array<any>/Array<unknown>/g' "$file"
  sed -i '' 's/any\[\]/unknown[]/g' "$file"
  
  # Fix Promise types
  # Replace: Promise<any> with Promise<unknown>
  sed -i '' 's/Promise<any>/Promise<unknown>/g' "$file"
  
  # Remove backup if no changes were made
  if cmp -s "$file" "$file.bak"; then
    rm "$file.bak"
  fi
done

echo "✅ Done! Fixed common 'any' type patterns."
echo "📝 Review changes and test your code."
echo "🗑️  Backup files (.bak) have been created. Remove them when satisfied."

