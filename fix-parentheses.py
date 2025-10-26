#!/usr/bin/env python3
"""Add closing parentheses to query chains"""

from pathlib import Path
import re

print("🔧 Fixing Parentheses\n")

files = [
    'app/api/table-sessions/handlers/table-action-handlers.ts',
    'lib/analytics/business-metrics.ts'
]

for file_path in files:
    path = Path(file_path)
    if not path.exists():
        continue
    
    lines = path.read_text().split('\n')
    modified = False
    
    for i, line in enumerate(lines):
        # Find lines with " as any).from(" or " as any).rpc("
        if re.search(r' as any\)\.(from|rpc)\(', line):
            # Look ahead to find where the chain ends (.single() or .select() followed by end)
            # Add closing paren at the end of the await statement
            j = i + 1
            paren_count = 0
            found_end = False
            
            while j < len(lines) and j < i + 20:
                if lines[j].strip().endswith(';'):
                    lines[j] = lines[j].rstrip()[:-1] + ');'
                    modified = True
                    found_end = True
                    break
                j += 1
    
    if modified:
        path.write_text('\n'.join(lines))
        print(f"✅ {path.name}")

print("\n✅ Fixed parentheses")
