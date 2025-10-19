#!/bin/bash

# Fix logger imports in all API routes
# This script adds 'logger' to the import statement from '@/lib/logger'

find app/api -name "*.ts" -type f | while read file; do
  # Check if file uses logger but doesn't import it
  if grep -q "logger\." "$file" && ! grep -q "import.*logger.*from.*@/lib/logger" "$file"; then
    # Check if file already imports from logger
    if grep -q "import.*from.*@/lib/logger" "$file"; then
      # Add logger to existing import
      sed -i.bak 's/import { \([^}]*\) } from '\''@\/lib\/logger'\''/import { \1, logger } from '\''@\/lib\/logger'\''/g' "$file"
      rm "$file.bak"
      echo "Fixed: $file"
    else
      # Add new import
      sed -i.bak '1 a\
import { logger } from '\''@/lib/logger'\'';
' "$file"
      rm "$file.bak"
      echo "Added logger import to: $file"
    fi
  fi
done

echo "Done fixing logger imports!"

