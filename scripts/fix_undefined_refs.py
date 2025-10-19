#!/usr/bin/env python3
"""
Fix 'Cannot find name err/error' by standardizing catch blocks.
"""

import re
from pathlib import Path

ROOT = Path("/Users/amaan/Downloads/servio-mvp-cleaned")

def fix_file(filepath):
    """Fix a single file by standardizing all catch blocks"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original = content
        
        # Pattern 1: catch (error) { ... err.message ... }
        # Fix: Change err to error
        content = re.sub(
            r'(\bcatch\s*\(\s*error\s*\)\s*{[^}]*?)\berr\b',
            r'\1error',
            content,
            flags=re.DOTALL
        )
        
        # Pattern 2: catch (error) but not using toError - add it
        # Find catch (error) blocks that don't have toError
        def fix_catch_block(match):
            catch_line = match.group(0)
            # Change to catch (e: unknown) and add toError
            if 'toError' not in match.group(0):
                indent = len(catch_line) - len(catch_line.lstrip())
                spaces = ' ' * (indent + 2)
                return f"catch (e: unknown) {{\n{spaces}const error = toError(e);"
            return catch_line
        
        # Actually, simpler approach: just fix the specific patterns causing errors
        # 1. catch (error) with references to err -> change err to error
        # 2. catch (e: unknown) without const err/error -> add it
        
        if content != original:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        return False
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False

# Simpler: just run sed-like replacements on specific error patterns
def main():
    import subprocess
    
    # Pattern 1: References to undefined 'err' in catch(error) blocks
    # We'll just change the undefined variable name in error messages
    # Example: error instanceof Error ? err.message : ...
    # Fix: error instanceof Error ? error.message : ...
    
    files_with_errors = [
        "app/api/admin/emergency-fix/route.ts",
        "app/api/admin/reset-tables/route.ts",
    ]
    
    for file_rel in files_with_errors:
        filepath = ROOT / file_rel
        if not filepath.exists():
            continue
        
        with open(filepath, 'r') as f:
            content = f.read()
        
        original = content
        
        # Fix: err.message when we only have error defined
        content = re.sub(r'error instanceof Error \? err\.message', 'error instanceof Error ? error.message', content)
        content = re.sub(r'\berr\.message\b', 'error.message', content)
        content = re.sub(r':\s*err\s*\)', ': error)', content)
        content = re.sub(r',\s*err\s*\)', ', error)', content)
        
        if content != original:
            with open(filepath, 'w') as f:
                f.write(content)
            print(f"Fixed: {file_rel}")

if __name__ == "__main__":
    main()

