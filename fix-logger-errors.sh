#!/bin/bash

# Fix all logger.error() and logger.debug() calls that pass error objects directly
# This script wraps error objects in proper context objects

find app/api -name "*.ts" -type f | while read file; do
  # Fix logger.error calls with error objects
  sed -i.bak 's/logger\.error(\([^,]*\), error)/logger.error(\1, { error: error instanceof Error ? error.message : '\''Unknown error'\'' })/g' "$file"
  
  # Fix logger.debug calls with error objects
  sed -i.bak 's/logger\.debug(\([^,]*\), error)/logger.debug(\1, { error: error instanceof Error ? error.message : '\''Unknown error'\'' })/g' "$file"
  
  # Fix logger.error calls with tableError
  sed -i.bak 's/logger\.error(\([^,]*\), tableError)/logger.error(\1, { error: tableError instanceof Error ? tableError.message : '\''Unknown error'\'' })/g' "$file"
  
  # Fix logger.debug calls with tableError
  sed -i.bak 's/logger\.debug(\([^,]*\), tableError)/logger.debug(\1, { error: tableError instanceof Error ? tableError.message : '\''Unknown error'\'' })/g' "$file"
  
  rm -f "$file.bak"
done

echo "Done fixing logger error calls!"

