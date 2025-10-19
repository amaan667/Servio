#!/usr/bin/env python3
"""
Fix all 'Cannot find name err/error' TypeScript errors.
These were created by the previous script that converted 'e' to 'err' but didn't update all references.
"""

import os
import re
from pathlib import Path

# Project root
ROOT = Path("/Users/amaan/Downloads/servio-mvp-cleaned")

# Patterns for finding and fixing the issue
# Pattern 1: catch (e: unknown) { const err = toError(e); ... then later referencing 'err' or 'error' that doesn't exist
#   Fix: Change the variable name in the catch block to match what's used later

def fix_file(filepath):
    """Fix a single file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original = content
        modified = False
        
        # Fix pattern: We have `const err = toError(e)` but code references `err` later
        # This is actually correct, so we need to find where code still references undefined `error`
        
        # Look for catch blocks that create `const err = toError(e)` and then code that uses undefined `error`
        # Actually, the issue is that my script changed catch (error) to catch (e: unknown) and added const err = toError(e)
        # But then code that used `error` still references it
        # Solution: Change `error` references to `err`
        
        # Simple replacements for common patterns where `error` is used but `err` is defined
        # Pattern: logger.error(..., error); where we have const err = toError(e);
        # Replace with: logger.error(..., err);
        
        # Also fix: Cannot find name 'error' -> should be 'err'
        # But we need to be smart - only within catch blocks that defined err
        
        # Let's do a simpler approach: find all locations where we have:
        # catch (e: unknown) {
        #    const err = toError(e);
        #    ...
        #    use of 'error'
        # }
        # and replace 'error' with 'err'
        
        # Split into lines and process
        lines = content.split('\n')
        in_catch_with_err = False
        catch_indent = 0
        
        for i, line in enumerate(lines):
            # Check if we're entering a catch block with err
            if 'catch (e: unknown)' in line:
                # Look ahead to see if next non-empty line has const err = toError
                for j in range(i+1, min(i+5, len(lines))):
                    if 'const err = toError(e)' in lines[j] or 'const error = toError(e)' in lines[j]:
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
                
                # Replace common patterns where 'error' is used but 'err' is defined
                # Be careful not to replace 'error' in strings or comments
                if not line.strip().startswith('//') and not line.strip().startswith('*'):
                    # Replace patterns like: logger.error('...', error);
                    if re.search(r',\s*error\s*[;,\)]', line):
                        lines[i] = re.sub(r',(\s*)error(\s*[;,\)])', r',\1err\2', line)
                        modified = True
                    # Replace: throw error;
                    if re.search(r'throw\s+error\s*;', line):
                        lines[i] = re.sub(r'throw\s+error\s*;', 'throw err;', line)
                        modified = True
                    # Replace: error.message
                    if re.search(r'\berror\.message\b', line):
                        lines[i] = re.sub(r'\berror\.message\b', 'err.message', line)
                        modified = True
                    # Replace standalone error in expressions
                    if re.search(r'\berror\s*\)', line) or re.search(r'\berror\s*;', line):
                        lines[i] = re.sub(r'\berror(\s*[\);,])', r'err\1', line)
                        modified = True
        
        if modified:
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
    # Find all TypeScript files
    patterns = [
        "app/api/**/*.ts",
        "app/**/*.tsx",
        "components/**/*.tsx",
        "hooks/**/*.ts",
        "lib/**/*.ts",
    ]
    
    fixed_count = 0
    for pattern in patterns:
        for filepath in ROOT.glob(pattern):
            if 'node_modules' in str(filepath):
                continue
            if fix_file(filepath):
                fixed_count += 1
                print(f"Fixed: {filepath.relative_to(ROOT)}")
    
    print(f"\nTotal files fixed: {fixed_count}")

if __name__ == "__main__":
    main()

