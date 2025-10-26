#!/usr/bin/env python3
"""Fix all supabase await patterns"""

from pathlib import Path
import re

print("🔧 Fixing All Supabase Patterns\n")

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
        # Fix: await supabase\n       as any).from
        if 'await supabase' in line and i + 1 < len(lines) and 'as any).from' in lines[i + 1]:
            # Move (supabase as any) to same line
            lines[i] = lines[i].replace('await supabase', 'await (supabase as any)')
            lines[i + 1] = lines[i + 1].replace('as any).from', '.from')
            modified = True
        
        # Fix: (supabase as any).rpc("...", {\n      })); - extra closing paren
        if 'await (supabase as any).rpc' in line:
            j = i + 1
            while j < len(lines) and j < i + 10:
                if lines[j].strip() == '}));':
                    lines[j] = '});'
                    modified = True
                    break
                j += 1
    
    if modified:
        path.write_text('\n'.join(lines))
        print(f"✅ {path.name}")

print("\n✅ Fixed all patterns")
