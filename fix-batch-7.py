#!/usr/bin/env python3
"""Fix batch 7 - Multiple error types"""

import subprocess
import re
from pathlib import Path

print("🔧 Fixing Batch 7 - Multiple Error Types\n")

# Run TypeScript
result = subprocess.run(['npx', 'tsc', '--noEmit'], capture_output=True, text=True, timeout=60)
output = result.stdout + result.stderr

# Collect all errors
fixes = {}
for line in output.split('\n'):
    # TS2551: Property '_error' does not exist
    match = re.search(r'^([^:]+)\((\d+),\d+\): error TS2551: Property \'_error\' does not exist', line)
    if match:
        file, line_num = match.groups()
        if file not in fixes:
            fixes[file] = []
        fixes[file].append((int(line_num), 'logger._error', 'logger.error'))
    
    # TS2552: Cannot find name 'error'. Did you mean '_error'?
    match2 = re.search(r'^([^:]+)\((\d+),\d+\): error TS2552: Cannot find name \'error\'', line)
    if match2:
        file, line_num = match2.groups()
        if file not in fixes:
            fixes[file] = []
        fixes[file].append((int(line_num), 'error', '_error'))

print(f"Found {sum(len(v) for v in fixes.values())} fixes in {len(fixes)} files\n")

# Apply fixes
fixed = 0
for file_path, changes in fixes.items():
    try:
        path = Path(file_path)
        if not path.exists():
            continue
        
        lines = path.read_text().split('\n')
        modified = False
        
        for line_num, old, new in changes:
            idx = line_num - 1
            if 0 <= idx < len(lines):
                lines[idx] = lines[idx].replace(old, new)
                modified = True
        
        if modified:
            path.write_text('\n'.join(lines))
            print(f"✅ {path.name}")
            fixed += 1
    except:
        pass

print(f"\n✅ Fixed {fixed} files")
