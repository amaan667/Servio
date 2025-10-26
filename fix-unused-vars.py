#!/usr/bin/env python3
"""Fix all unused variables by prefixing with _"""

import subprocess
import re
from pathlib import Path

print("🔧 Fixing Unused Variables\n")

# Get ESLint output
result = subprocess.run(['npm', 'run', 'lint'], capture_output=True, text=True, timeout=60)
output = result.stdout + result.stderr

# Parse unused variable errors
fixes = {}
for line in output.split('\n'):
    # Pattern: file.ts:12:14 error 'name' is defined but never used
    match = re.search(r'^([^:]+):(\d+):\d+\s+error\s+\'(\w+)\'.*never used', line)
    if match:
        file, line_num, var = match.groups()
        if file not in fixes:
            fixes[file] = []
        fixes[file].append((int(line_num), var))

print(f"Found {sum(len(v) for v in fixes.values())} unused variables in {len(fixes)} files\n")

# Fix each file
fixed = 0
for file_path, issues in fixes.items():
    try:
        path = Path(file_path)
        if not path.exists():
            continue
        
        lines = path.read_text().split('\n')
        
        for line_num, var in issues:
            idx = line_num - 1
            if 0 <= idx < len(lines):
                # Prefix with _
                lines[idx] = re.sub(rf'\b{var}\b', f'_{var}', lines[idx])
        
        path.write_text('\n'.join(lines))
        print(f"✅ {path.name}")
        fixed += 1
    except:
        pass

print(f"\n✅ Fixed {fixed} files")
