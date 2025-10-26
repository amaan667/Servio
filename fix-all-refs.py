#!/usr/bin/env python3
"""Fix ALL broken variable references from bulk renaming"""

from pathlib import Path
import subprocess
import re

print("🔧 Fixing ALL Broken Variable References\n")

# Run TypeScript to get all "Did you mean" errors
try:
    result = subprocess.run(
        ['npx', 'tsc', '--noEmit'],
        capture_output=True,
        text=True,
        timeout=60
    )
    output = result.stdout + result.stderr
except:
    print("Error running tsc")
    exit(1)

# Parse all "Did you mean '_xxx'?" errors  
fixes_needed = {}
for line in output.split('\n'):
    # Pattern: file.ts(line,col): error TS2552: Cannot find name 'xxx'. Did you mean '_xxx'?
    match = re.search(r'(.+\.tsx?)\((\d+),\d+\).*Cannot find name [\'"](\w+)[\'"]\. Did you mean [\'"](_\w+)[\'"]', line)
    if match:
        file, line_num, old_name, new_name = match.groups()
        if file not in fixes_needed:
            fixes_needed[file] = []
        fixes_needed[file].append((int(line_num), old_name, new_name))

print(f"Found {sum(len(v) for v in fixes_needed.values())} broken references in {len(fixes_needed)} files\n")

# Fix each file
files_fixed = 0
refs_fixed = 0

for file_path, issues in fixes_needed.items():
    try:
        path = Path(file_path)
        if not path.exists():
            continue
        
        lines = path.read_text().split('\n')
        
        # Apply each fix
        for line_num, old_var, new_var in issues:
            idx = line_num - 1
            if 0 <= idx < len(lines):
                # Replace old_var with new_var on this line
                # But preserve 'error:' in object keys
                line = lines[idx]
                # Don't replace if it's an object key
                if f'{old_var}:' not in line or 'error:' in line:
                    lines[idx] = re.sub(rf'\b{old_var}\b(?!:)', new_var, line)
                    refs_fixed += 1
        
        # Write back
        new_content = '\n'.join(lines)
        path.write_text(new_content)
        short = '/'.join(file_path.split('/')[-3:])
        print(f"✅ {short}")
        files_fixed += 1
        
    except Exception as e:
        print(f"❌ {file_path}: {e}")

print(f"\n✅ Fixed {refs_fixed} references in {files_fixed} files")
