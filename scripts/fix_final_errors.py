#!/usr/bin/env python3
"""
Fix final TypeScript errors by correcting undefined variable references.
"""

import re
from pathlib import Path

ROOT = Path("/Users/amaan/Downloads/servio-mvp-cleaned")

def fix_file(filepath):
    """Fix undefined variable references in a single file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original = content
        
        # Pattern 1: catch (e: unknown) { const err = toError(e); ... error.message
        # Fix: Change error.message to err.message
        content = re.sub(
            r'catch \(e: unknown\) \{[\s\S]*?const err = toError\(e\);[\s\S]*?\berror\.message\b',
            lambda m: m.group(0).replace('error.message', 'err.message'),
            content,
            flags=re.MULTILINE
        )
        
        # Pattern 2: catch (e: unknown) { ... error.message where we have err
        # This is more complex - we need to check if err is defined
        lines = content.split('\n')
        in_catch_with_err = False
        catch_indent = 0
        
        for i, line in enumerate(lines):
            # Check if we're entering a catch block with err
            if 'catch (e: unknown)' in line:
                # Look ahead to see if next non-empty line has const err = toError
                for j in range(i+1, min(i+5, len(lines))):
                    if 'const err = toError(e)' in lines[j]:
                        in_catch_with_err = True
                        catch_indent = len(line) - len(line.lstrip())
                        break
            
            # If we're in a catch block with err, replace error references
            if in_catch_with_err:
                current_indent = len(line) - len(line.lstrip())
                
                # Check if we've exited the catch block
                if line.strip() and current_indent <= catch_indent and '}' in line:
                    in_catch_with_err = False
                    continue
                
                # Replace patterns where 'error' is used but 'err' is defined
                if 'error.message' in line and 'err' not in line:
                    lines[i] = line.replace('error.message', 'err.message')
                if 'error instanceof Error' in line and 'err' not in line:
                    lines[i] = line.replace('error instanceof Error', 'err instanceof Error')
        
        content = '\n'.join(lines)
        
        if content != original:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        return False
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False

def main():
    # Find all TypeScript files in app/api
    api_files = list(ROOT.glob("app/api/**/*.ts"))
    
    fixed_count = 0
    for filepath in api_files:
        if 'node_modules' in str(filepath):
            continue
        if fix_file(filepath):
            fixed_count += 1
            print(f"Fixed: {filepath.relative_to(ROOT)}")
    
    print(f"\nTotal files fixed: {fixed_count}")

if __name__ == "__main__":
    main()

