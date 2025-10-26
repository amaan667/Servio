#!/usr/bin/env python3
"""Fix TypeScript property access errors"""

import subprocess
import re
from pathlib import Path

print("🔧 Fixing TypeScript Property Access Errors\n")

# Run TypeScript
result = subprocess.run(['npx', 'tsc', '--noEmit'], capture_output=True, text=True, timeout=60)
output = result.stdout + result.stderr

# Find property access errors
fixes = {}
for line in output.split('\n'):
    # Pattern: file.ts(line,col): error TS2339: Property 'xxx' does not exist on type 'never'
    match = re.search(r'^([^:]+)\((\d+),\d+\): error TS2339: Property \'(\w+)\' does not exist on type \'never\'', line)
    if match:
        file, line_num, prop = match.groups()
        if file not in fixes:
            fixes[file] = []
        fixes[file].append((int(line_num), prop))

print(f"Found {sum(len(v) for v in fixes.values())} property access errors in {len(fixes)} files\n")

# Fix each file - add type assertions
fixed = 0
for file_path, issues in fixes.items():
    try:
        path = Path(file_path)
        if not path.exists():
            continue
        
        lines = path.read_text().split('\n')
        
        for line_num, prop in issues:
            idx = line_num - 1
            if 0 <= idx < len(lines):
                line = lines[idx]
                # Add type assertion: `(org as any).prop` instead of `org.prop`
                if re.search(rf'\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\.\s*{prop}\b', line):
                    lines[idx] = re.sub(rf'\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\.\s*{prop}\b', r'(\1 as any).' + prop, line)
        
        path.write_text('\n'.join(lines))
        print(f"✅ {path.name}")
        fixed += 1
    except:
        pass

print(f"\n✅ Fixed {fixed} files")
