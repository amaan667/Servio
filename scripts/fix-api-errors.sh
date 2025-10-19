#!/bin/bash
# Fix TypeScript errors in API routes by applying toError pattern
# This script systematically fixes "error is of type 'unknown'" errors

echo "🔧 Fixing TypeScript errors in API routes..."

# Find all API route files with TypeScript errors
ERROR_FILES=$(pnpm tsc --noEmit 2>&1 | grep -E '^app/api.*\.ts\([0-9]+,[0-9]+\):' | cut -d: -f1 | sort -u)

echo "Found $(echo "$ERROR_FILES" | wc -l | tr -d ' ') files with errors"

# Process each file
for file in $ERROR_FILES; do
    echo "Processing: $file"
    
    # Check if file needs toError import
    if ! grep -q "import { toError }" "$file"; then
        # Add import after the last import statement
        sed -i.bak '/^import.*from.*$/a\
import { toError } from '\''@/lib/utils/errors'\'';
' "$file"
        rm -f "$file.bak"
        echo "  ✓ Added toError import"
    fi
    
    # Fix catch blocks with error.message access
    # Pattern 1: catch (error: unknown) with error.message access
    sed -i.bak 's/} catch (error: unknown) {/} catch (e: unknown) {/g' "$file"
    sed -i.bak 's/error\.message/err.message/g' "$file"
    
    # Add const err = toError(e); after catch if not present
    if grep -q "} catch (e: unknown) {" "$file"; then
        if ! grep -A1 "} catch (e: unknown) {" "$file" | grep -q "const err = toError"; then
            sed -i.bak 's/} catch (e: unknown) {/} catch (e: unknown) {\
    const err = toError(e);/g' "$file"
        fi
    fi
    
    rm -f "$file.bak"
done

echo "✅ Done! Run 'pnpm tsc --noEmit' to verify fixes."

