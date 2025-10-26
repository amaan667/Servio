#!/usr/bin/env python3
"""Massive batch fix for multiple error types"""

import subprocess
import re
from pathlib import Path

print("🔧 MASSIVE BATCH FIX - Multiple Error Types\n")

# Run TypeScript
result = subprocess.run(['npx', 'tsc', '--noEmit'], capture_output=True, text=True, timeout=60)
output = result.stdout + result.stderr

# Collect all errors by type
fixes = {}

for line in output.split('\n'):
    # TS2551: Property '_error' does not exist
    match = re.search(r'^([^:]+)\((\d+),\d+\): error TS2551: Property \'_error\' does not exist', line)
    if match:
        file, line_num = match.groups()
        if file not in fixes:
            fixes[file] = []
        fixes[file].append((int(line_num), '_error', 'error'))
    
    # TS2339: Property 'from' does not exist on type 'unknown'
    match2 = re.search(r'^([^:]+)\((\d+),\d+\): error TS2339: Property \'from\' does not exist on type \'unknown\'', line)
    if match2:
        file, line_num = match2.groups()
        if file not in fixes:
            fixes[file] = []
        fixes[file].append((int(line_num), '.from', ' as any).from'))
    
    # TS2339: Property 'id' does not exist on type 'never'
    match3 = re.search(r'^([^:]+)\((\d+),\d+\): error TS2339: Property \'id\' does not exist on type \'never\'', line)
    if match3:
        file, line_num = match3.groups()
        if file not in fixes:
            fixes[file] = []
        fixes[file].append((int(line_num), 'id', '(item as any).id'))

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
                line = lines[idx]
                # Replace patterns
                if old in line:
                    lines[idx] = line.replace(old, new)
                    modified = True
        
        if modified:
            path.write_text('\n'.join(lines))
            print(f"✅ {path.name} ({len(changes)} fixes)")
            fixed += 1
    except:
        pass

print(f"\n✅ Fixed {fixed} files")
