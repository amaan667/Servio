#!/usr/bin/env python3
"""Fix all TypeScript errors from bulk variable renaming"""

from pathlib import Path
import subprocess
import re

print("🔧 Comprehensive TypeScript Error Fix\n")

# Run TypeScript and capture specific renamed variable errors
result = subprocess.run(['npx', 'tsc', '--noEmit'], capture_output=True, text=True, timeout=30)
output = result.stdout + result.stderr

# Find all "Did you mean '_xxx'?" errors
errors = []
for line in output.split('\n'):
    # Pattern: file.ts(line,col): error TS2552: Cannot find name 'xxx'. Did you mean '_xxx'?
    match = re.search(r'(.+)\((\d+),\d+\).*Cannot find name [\'"](\w+)[\'"]\. Did you mean [\'"](_\w+)[\'"]', line)
    if match:
        file, line_num, old, new = match.groups()
        errors.append((file, int(line_num), old, new))

print(f"Found {len(errors)} variable reference errors")

# Group by file
files_to_fix = {}
for file, line_num, old, new in errors:
    if file not in files_to_fix:
        files_to_fix[file] = []
    files_to_fix[file].append((line_num, old, new))

# Fix each file
fixed = 0
for file_path, issues in files_to_fix.items():
    try:
        path = Path(file_path)
        if not path.exists():
            continue
        
        content = path.read_text()
        lines = content.split('\n')
        
        # Apply fixes
        for line_num, old_var, new_var in issues:
            idx = line_num - 1
            if 0 <= idx < len(lines):
                # Replace old with new on this line only
                lines[idx] = re.sub(rf'\b{old_var}\b', new_var, lines[idx])
        
        new_content = '\n'.join(lines)
        if new_content != content:
            path.write_text(new_content)
            short = '/'.join(file_path.split('/')[-3:])
            print(f"✅ {short}")
            fixed += 1
    except:
        pass

print(f"\n✅ Fixed {fixed} files")
