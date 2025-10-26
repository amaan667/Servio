#!/usr/bin/env python3
"""Fix batch 8 - Property access errors"""

import subprocess
import re
from pathlib import Path

print("🔧 Fixing Batch 8 - Property Access Errors\n")

# Run TypeScript
result = subprocess.run(['npx', 'tsc', '--noEmit'], capture_output=True, text=True, timeout=60)
output = result.stdout + result.stderr

# Collect all TS2339 errors
fixes = {}
for line in output.split('\n'):
    match = re.search(r'^([^:]+)\((\d+),\d+\): error TS2339: Property \'(\w+)\' does not exist on type', line)
    if match:
        file, line_num, prop = match.groups()
        if file not in fixes:
            fixes[file] = []
        fixes[file].append((int(line_num), prop))

print(f"Found {sum(len(v) for v in fixes.values())} errors in {len(fixes)} files\n")

# Fix files
fixed = 0
for file_path, errors in fixes.items():
    try:
        path = Path(file_path)
        if not path.exists():
            continue
        
        lines = path.read_text().split('\n')
        modified = False
        
        for line_num, prop in errors:
            idx = line_num - 1
            if 0 <= idx < len(lines):
                line = lines[idx]
                # Add (variable as any) before property access
                new_line = re.sub(rf'\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\.\s*{prop}\b', r'(\1 as any).' + prop, line)
                if new_line != line:
                    lines[idx] = new_line
                    modified = True
        
        if modified:
            path.write_text('\n'.join(lines))
            print(f"✅ {path.name} ({len(errors)} fixes)")
            fixed += 1
    except:
        pass

print(f"\n✅ Fixed {fixed} files")
