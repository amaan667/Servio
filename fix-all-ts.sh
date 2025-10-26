#!/bin/bash

echo "🔧 Fixing ALL TypeScript Errors from Bulk Renames"

find app -type f -name "*.ts" 2>/dev/null | while read file; do
  cp "$file" "$file.bak"
  
  # Fix: catch (_error) { ...  error ... }
  # Look for catch blocks and fix references inside
  awk '
    /catch \(_error\)/ { in_catch_error=1; print; next }
    /catch \(_e\)/ { in_catch_e=1; print; next }
    /catch \(_err\)/ { in_catch_err=1; print; next }
    /^  }/ || /^}/ { 
      if (in_catch_error) in_catch_error=0
      if (in_catch_e) in_catch_e=0  
      if (in_catch_err) in_catch_err=0
      print; next 
    }
    in_catch_error {
      gsub(/\berror\b/, "_error")
      gsub(/\berror:/, "error:")  # Keep object keys
      print; next
    }
    in_catch_e {
      gsub(/\be\b(?!rror|lse)/, "_e")
      print; next
    }
    in_catch_err {
      gsub(/\berr\b/, "_err")
      print; next
    }
    { print }
  ' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
  
  # Fix: function foo(_request) { ... request.url ... }
  if grep -q "(_request:" "$file" || grep -q "(_request," "$file"; then
    sed -i '' 's/\brequest\.url\b/_request.url/g' "$file"
    sed -i '' 's/\brequest\.method\b/_request.method/g' "$file"
    sed -i '' 's/\brequest\.headers\b/_request.headers/g' "$file"
  fi
  
  # Fix: const _xxx but still using xxx
  sed -i '' 's/const { item_count, /const { item_count: _item_count, /g' "$file"
  sed -i '' 's/, total_amount }/, total_amount: _total_amount }/g' "$file"
  
  # Only keep if changed
  if cmp -s "$file" "$file.bak"; then
    mv "$file.bak" "$file"
  else
    rm "$file.bak"
    echo "✅ $(basename $file)"
  fi
done

echo ""
echo "Checking TypeScript errors..."
npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "node_modules" | wc -l
