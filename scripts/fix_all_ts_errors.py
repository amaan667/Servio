#!/usr/bin/env python3
"""
Comprehensive script to fix all remaining TypeScript errors.
"""

import re
from pathlib import Path

ROOT = Path("/Users/amaan/Downloads/servio-mvp-cleaned")

def fix_file(filepath):
    """Fix all TypeScript errors in a single file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original = content
        
        # Fix 1: catch (e: unknown) { const err = toError(e); ... error.message
        # Replace error.message with err.message when err is defined
        content = re.sub(
            r'catch \(e: unknown\) \{[\s\S]*?const err = toError\(e\);[\s\S]*?\berror\.message\b',
            lambda m: m.group(0).replace('error.message', 'err.message'),
            content,
            flags=re.MULTILINE
        )
        
        # Fix 2: catch (e: unknown) { const err = toError(e); ... error instanceof Error
        content = re.sub(
            r'catch \(e: unknown\) \{[\s\S]*?const err = toError\(e\);[\s\S]*?\berror instanceof Error\b',
            lambda m: m.group(0).replace('error instanceof Error', 'err instanceof Error'),
            content,
            flags=re.MULTILINE
        )
        
        # Fix 3: catch (error) { ... err.message (when err is not defined)
        # Replace err.message with error.message
        content = re.sub(
            r'catch \(error\) \{[\s\S]*?\berr\.message\b',
            lambda m: m.group(0).replace('err.message', 'error.message'),
            content,
            flags=re.MULTILINE
        )
        
        # Fix 4: catch (e: unknown) { ... error.message (when error is not defined)
        # Replace error.message with (e instanceof Error ? e.message : String(e))
        content = re.sub(
            r'catch \(e: unknown\) \{[\s\S]*?\berror\.message\b',
            lambda m: m.group(0).replace('error.message', '(e instanceof Error ? e.message : String(e))'),
            content,
            flags=re.MULTILINE
        )
        
        # Fix 5: logger.error('msg', error) where error is unknown
        # Wrap in conditional
        content = re.sub(
            r'logger\.error\(([^,]+),\s*error\)',
            r'logger.error(\1, error instanceof Error ? error : { error: String(error) })',
            content
        )
        
        # Fix 6: logger.error('msg', err) where err is unknown
        # Wrap in conditional
        content = re.sub(
            r'logger\.error\(([^,]+),\s*err\)',
            r'logger.error(\1, err instanceof Error ? err : { error: String(err) })',
            content
        )
        
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
            if 'node_modules' in str(filepath) or '__tests__' in str(filepath):
                continue
            if fix_file(filepath):
                fixed_count += 1
                print(f"Fixed: {filepath.relative_to(ROOT)}")
    
    print(f"\nTotal files fixed: {fixed_count}")

if __name__ == "__main__":
    main()

