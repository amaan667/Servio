#!/usr/bin/env python3
"""Comprehensive TypeScript error fixer"""

import subprocess
import re
from pathlib import Path

print("🔧 Fixing ALL TypeScript Errors\n")

# Run TypeScript
result = subprocess.run(['npx', 'tsc', '--noEmit'], capture_output=True, text=True, timeout=60)
output = result.stdout + result.stderr

# Fix patterns
fixes = {}
for line in output.split('\n'):
    # Pattern: file.ts(line,col): error TS2304: Cannot find name 'error'. Did you mean '_error'?
    match = re.search(r'^([^:]+)\((\d+),\d+\): error TS\d+: Cannot find name \'(\w+)\'.*Did you mean \'(_\w+)\'?', line)
    if match:
        file, line_num, old_name, new_name = match.groups()
        if file not in fixes:
            fixes[file] = []
        fixes[file].append((int(line_num), old_name, new_name))
    
    # Pattern: Cannot find name 'error' (without suggestion)
    match2 = re.search(r'^([^:]+)\((\d+),\d+\): error TS2304: Cannot find name \'(\w+)\'', line)
    if match2:
        file, line_num, var = match2.groups()
        # Try to find similar pattern in catch blocks
        if var in ['error', 'e', 'err', 'request', 'req']:
            if file not in fixes:
                fixes[file] = []
            fixes[file].append((int(line_num), var, f'_{var}'))

print(f"Found {sum(len(v) for v in fixes.values())} issues in {len(fixes)} files\n")

# Fix each file
fixed = 0
for file_path, issues in fixes.items():
    try:
        path = Path(file_path)
        if not path.exists():
            continue
        
        lines = path.read_text().split('\n')
        
        for line_num, old_var, new_var in issues:
            idx = line_num - 1
            if 0 <= idx < len(lines):
                lines[idx] = re.sub(rf'\b{old_var}\b(?!:)', new_var, lines[idx])
        
        path.write_text('\n'.join(lines))
        print(f"✅ {path.name}")
        fixed += 1
    except:
        pass

print(f"\n✅ Fixed {fixed} files")
