#!/usr/bin/env python3
"""
Fix TypeScript errors in API routes by applying toError pattern
This script systematically fixes "error is of type 'unknown'" errors
"""

import re
import sys
from pathlib import Path

def needs_to_error_import(content: str) -> bool:
    """Check if file needs toError import"""
    return 'import { toError }' not in content

def add_to_error_import(content: str) -> str:
    """Add toError import after other imports"""
    # Find the last import statement
    lines = content.split('\n')
    last_import_idx = -1
    
    for i, line in enumerate(lines):
        if line.strip().startswith('import '):
            last_import_idx = i
    
    if last_import_idx >= 0:
        # Insert toError import after the last import
        lines.insert(last_import_idx + 1, "import { toError } from '@/lib/utils/errors';")
        return '\n'.join(lines)
    
    return content

def fix_catch_blocks(content: str) -> str:
    """Fix catch blocks to use toError pattern"""
    # Pattern 1: catch (error: unknown) -> catch (e: unknown)
    content = re.sub(r'catch \(error: unknown\)', 'catch (e: unknown)', content)
    
    # Pattern 2: Add const err = toError(e); after catch if not present
    def add_to_error(match):
        catch_line = match.group(0)
        # Check if next line already has toError
        return catch_line + '\n    const err = toError(e);'
    
    # Only add if not already present
    if 'const err = toError(e);' not in content:
        content = re.sub(r'catch \(e: unknown\) \{', add_to_error, content)
    
    # Pattern 3: Replace error.message with err.message (but not in logger calls)
    # This is tricky - we need to be careful not to replace in logger.error calls
    # where we already have the pattern
    
    # First, let's fix the obvious cases where error.message is accessed directly
    # after a catch block
    content = re.sub(r'\berror\.message\b', 'err.message', content)
    content = re.sub(r'\berror\.name\b', 'err.name', content)
    content = re.sub(r'\berror\.errors\b', '(err as any).errors', content)
    
    # Fix logger.error calls that use error directly
    content = re.sub(
        r'logger\.error\([^,]+,\s*\{\s*error:\s*error\s*\}',
        'logger.error("[API] Error", err',
        content
    )
    
    # Fix logger.error calls with error.message pattern
    content = re.sub(
        r'logger\.error\([^,]+,\s*\{\s*error:\s*error instanceof Error \? error\.message : \'Unknown error\'\s*\}',
        'logger.error("[API] Error", err',
        content
    )
    
    return content

def fix_file(file_path: Path) -> bool:
    """Fix a single file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Add toError import if needed
        if needs_to_error_import(content):
            content = add_to_error_import(content)
        
        # Fix catch blocks
        content = fix_catch_blocks(content)
        
        # Only write if changed
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        
        return False
    except Exception as e:
        print(f"Error processing {file_path}: {e}", file=sys.stderr)
        return False

def main():
    """Main function"""
    # Find all TypeScript files in app/api
    api_dir = Path('app/api')
    
    if not api_dir.exists():
        print("Error: app/api directory not found", file=sys.stderr)
        sys.exit(1)
    
    # Get all .ts files
    ts_files = list(api_dir.rglob('*.ts'))
    
    print(f"Found {len(ts_files)} TypeScript files in app/api")
    
    fixed_count = 0
    for file_path in sorted(ts_files):
        if fix_file(file_path):
            print(f"✓ Fixed: {file_path}")
            fixed_count += 1
    
    print(f"\n✅ Fixed {fixed_count} files")
    print("Run 'pnpm tsc --noEmit' to verify fixes")

if __name__ == '__main__':
    main()

