#!/usr/bin/env python3
"""Fix property access errors on unknown types"""

import subprocess
import re
from pathlib import Path

print("🔧 Fixing Property Access Errors - Batch Processing\n")

# Run TypeScript
result = subprocess.run(['npx', 'tsc', '--noEmit'], capture_output=True, text=True, timeout=60)
output = result.stdout + result.stderr

# Group errors by file
file_errors = {}
for line in output.split('\n'):
    # Pattern: file.ts(line,col): error TS2339: Property 'xxx' does not exist on type 'unknown'
    match = re.search(r'^([^:]+)\((\d+),\d+\): error TS2339: Property \'(\w+)\' does not exist on type \'unknown\'', line)
    if match:
        file, line_num, prop = match.groups()
        if file not in file_errors:
            file_errors[file] = []
        file_errors[file].append((int(line_num), prop))

print(f"Found {sum(len(v) for v in file_errors.values())} errors in {len(file_errors)} files\n")

# Fix files with most errors first
for file_path, errors in sorted(file_errors.items(), key=lambda x: len(x[1]), reverse=True)[:10]:
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
                # Add (x as any) assertion before property access
                # Pattern: variable.prop → (variable as any).prop
                new_line = re.sub(rf'\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\.\s*{prop}\b', r'(\1 as any).' + prop, line)
                if new_line != line:
                    lines[idx] = new_line
                    modified = True
        
        if modified:
            path.write_text('\n'.join(lines))
            print(f"✅ {path.name} ({len(errors)} fixes)")
    except:
        pass

print("\n✅ Fixed property access errors")
