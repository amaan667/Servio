#!/usr/bin/env python3
"""
Fix test file TypeScript errors
"""

import os
import re
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent

def fix_test_file_errors(file_path: Path):
    """Fix common test file errors"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception:
        return False

    original_content = content

    # Fix: Cannot assign to 'NODE_ENV' because it is a read-only property
    # Replace process.env.NODE_ENV = ... with Object.defineProperty
    content = re.sub(
        r'process\.env\.NODE_ENV\s*=\s*([^;]+);',
        lambda m: f'Object.defineProperty(process.env, "NODE_ENV", {{ value: {m.group(1)}, writable: true, configurable: true }});',
        content
    )

    # Fix: Cannot assign to 'url' because it is a read-only property
    content = re.sub(
        r'(\w+)\.url\s*=\s*([^;]+);',
        lambda m: f'Object.defineProperty({m.group(1)}, "url", {{ value: {m.group(2)}, writable: true, configurable: true }});',
        content
    )

    # Fix: Cannot assign to 'method' because it is a read-only property
    content = re.sub(
        r'(\w+)\.method\s*=\s*([^;]+);',
        lambda m: f'Object.defineProperty({m.group(1)}, "method", {{ value: {m.group(2)}, writable: true, configurable: true }});',
        content
    )

    # Fix: Cannot find name 'afterEach'
    if 'afterEach' in content and 'from \'vitest\'' not in content and 'from "vitest"' not in content:
        if 'import' in content:
            # Check if there's already a vitest import
            vitest_import = re.search(r'^import\s+\{([^}]+)\}\s+from\s+[\'"]vitest[\'"];?$', content, re.MULTILINE)
            if vitest_import:
                # Add afterEach to existing import
                imports = vitest_import.group(1)
                if 'afterEach' not in imports:
                    new_imports = imports.rstrip() + ', afterEach'
                    content = content.replace(vitest_import.group(0), f'import {{ {new_imports} }} from \'vitest\';')
            else:
                # Add new import
                import_pattern = re.compile(r'^import .* from [\'"].*[\'"];?$', re.MULTILINE)
                imports = list(import_pattern.finditer(content))
                if imports:
                    last_import = imports[-1]
                    insert_pos = last_import.end()
                    content = content[:insert_pos] + "\nimport { afterEach } from 'vitest';" + content[insert_pos:]
        else:
            # Add at top
            content = "import { afterEach } from 'vitest';\n" + content

    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    
    return False

def main():
    """Main function to fix test file errors"""
    
    test_dir = PROJECT_ROOT / '__tests__'
    
    if not test_dir.exists():
        print("No __tests__ directory found")
        return
    
    fixed_files = []
    
    for file_path in test_dir.rglob('*.ts'):
        if file_path.is_file():
            print(f"Processing: {file_path.relative_to(PROJECT_ROOT)}")
            
            fixed = fix_test_file_errors(file_path)
            
            if fixed:
                fixed_files.append(file_path)
                print(f"  ✓ Fixed: {file_path.relative_to(PROJECT_ROOT)}")
    
    print(f"\n✓ Fixed {len(fixed_files)} test files")

if __name__ == '__main__':
    main()
