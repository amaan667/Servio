#!/usr/bin/env python3
"""
Wave 2: Fix remaining TypeScript errors
Focuses on:
- Test files (mock setup, afterEach, etc.)
- Remaining unknown error types
- Type assignment issues
- Property access issues
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
    # Replace url = ... with Object.defineProperty
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
    # Add import if afterEach is used but not imported
    if 'afterEach' in content and 'from \'vitest\'' not in content and 'from "vitest"' not in content:
        if 'import' in content:
            # Add to existing imports
            import_pattern = re.compile(r'^import .* from [\'"]vitest[\'"];?$', re.MULTILINE)
            if not import_pattern.search(content):
                # Find last import
                all_imports = re.finditer(r'^import .* from [\'"].*[\'"];?$', content, re.MULTILINE)
                imports_list = list(all_imports)
                if imports_list:
                    last_import = imports_list[-1]
                    insert_pos = last_import.end()
                    content = content[:insert_pos] + "\nimport { afterEach } from 'vitest';" + content[insert_pos:]
        else:
            # Add at top
            content = "import { afterEach } from 'vitest';\n" + content

    # Fix: Expected X arguments, but got Y
    # This is more complex, we'll handle specific cases
    # Pattern: logger.error(message, context) where context is string
    # Replace with: logger.error(message, { message: context })
    content = re.sub(
        r'logger\.(error|warn|info|debug|log)\s*\(\s*([^,]+),\s*([\'"])([^\'"]+)\3\s*\)',
        r'logger.\1(\2, { message: \3\4\3 })',
        content
    )

    # Fix: Not all code paths return a value
    # Add explicit return in switch/case statements
    if 'return' in content and 'switch' in content:
        # This is complex, we'll handle case by case
        pass

    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    
    return False

def fix_remaining_unknown_errors(file_path: Path):
    """Fix remaining unknown error type issues"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception:
        return False

    original_content = content

    # Fix: error.message where error is unknown
    # Replace with getErrorMessage(error)
    lines = content.split('\n')
    new_lines = []
    
    for line in lines:
        # Check if line contains error.message but not in a function call
        if re.search(r'\berror\b\.message', line) and 'getErrorMessage' not in line:
            # Replace error.message with getErrorMessage(error)
            line = re.sub(r'\berror\b\.message', 'getErrorMessage(error)', line)
        
        # Same for err.message
        if re.search(r'\berr\b\.message', line) and 'getErrorMessage' not in line:
            line = re.sub(r'\berr\b\.message', 'getErrorMessage(err)', line)
        
        # Same for e.message
        if re.search(r'\be\b\.message', line) and 'getErrorMessage' not in line:
            # Be careful not to replace things like console.log
            if not re.search(r'(console|logger|process|window|document)\.', line):
                line = re.sub(r'\be\b\.message', 'getErrorMessage(e)', line)
        
        new_lines.append(line)
    
    content = '\n'.join(new_lines)

    # Add import if needed
    if content != original_content and 'getErrorMessage' in content:
        if 'from \'@/lib/utils/errors\'' not in content and 'from "@/lib/utils/errors"' not in content:
            import_pattern = re.compile(r'^import .* from [\'"].*[\'"];?$', re.MULTILINE)
            imports = list(import_pattern.finditer(content))
            
            if imports:
                last_import = imports[-1]
                insert_pos = last_import.end()
                import_stmt = "\nimport { getErrorMessage } from '@/lib/utils/errors';"
                content = content[:insert_pos] + import_stmt + content[insert_pos:]
            else:
                content = "import { getErrorMessage } from '@/lib/utils/errors';\n" + content

    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    
    return False

def fix_property_access_errors(file_path: Path):
    """Fix property does not exist errors"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception:
        return False

    original_content = content

    # Fix: Property 'message' does not exist on type '{}'
    # Replace with getErrorMessage
    content = re.sub(
        r'(\w+)\.message',
        lambda m: f'getErrorMessage({m.group(1)})' if m.group(1) not in ['console', 'logger', 'process', 'window', 'document', 'error', 'err', 'e'] else m.group(0),
        content
    )

    # Fix: Property 'choices' does not exist
    # This is more complex, might need type assertion
    content = re.sub(
        r'(\w+)\.choices',
        lambda m: f'({m.group(1)} as any).choices',
        content
    )

    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    
    return False

def fix_logger_argument_errors(file_path: Path):
    """Fix logger argument type errors"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception:
        return False

    original_content = content

    # Fix: Argument of type 'string' is not assignable to parameter of type 'LogContext'
    # Replace logger.error(msg, string) with logger.error(msg, { message: string })
    content = re.sub(
        r'logger\.(error|warn|info|debug|log)\s*\(\s*([^,]+),\s*([\'"])([^\'"]+)\3\s*\)',
        r'logger.\1(\2, { message: \3\4\3 })',
        content
    )

    # Fix: Argument of type 'unknown' is not assignable to parameter of type 'LogContext | undefined'
    # Replace logger.error(msg, unknown) with logger.error(msg, getErrorDetails(unknown))
    lines = content.split('\n')
    new_lines = []
    in_catch = False
    catch_var = None
    
    for line in lines:
        catch_match = re.search(r'catch\s*\(\s*(\w+)\s*:\s*unknown\s*\)', line)
        if catch_match:
            in_catch = True
            catch_var = catch_match.group(1)
            new_lines.append(line)
            continue
        
        if in_catch and line.strip().startswith('}') and '{' not in line:
            in_catch = False
            catch_var = None
            new_lines.append(line)
            continue
        
        if in_catch and catch_var:
            # Replace logger calls with catch variable
            line = re.sub(
                rf'logger\.(error|warn|info|debug|log)\s*\(\s*([^,]+),\s*{re.escape(catch_var)}\s*\)',
                rf'logger.\1(\2, getErrorDetails({catch_var}))',
                line
            )
        
        new_lines.append(line)
    
    content = '\n'.join(new_lines)

    # Add import if needed
    if content != original_content:
        if 'getErrorDetails' in content and 'from \'@/lib/utils/errors\'' not in content:
            import_pattern = re.compile(r'^import .* from [\'"].*[\'"];?$', re.MULTILINE)
            imports = list(import_pattern.finditer(content))
            
            if imports:
                last_import = imports[-1]
                insert_pos = last_import.end()
                import_stmt = "\nimport { getErrorDetails } from '@/lib/utils/errors';"
                content = content[:insert_pos] + import_stmt + content[insert_pos:]
            else:
                content = "import { getErrorDetails } from '@/lib/utils/errors';\n" + content

    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    
    return False

def main():
    """Main function to fix all remaining TypeScript errors"""
    
    directories = [
        'app',
        'components',
        'lib',
        'hooks',
        '__tests__',
    ]
    
    fixed_files = []
    
    for directory in directories:
        dir_path = PROJECT_ROOT / directory
        if not dir_path.exists():
            continue
        
        for file_path in dir_path.rglob('*.ts'):
            if file_path.is_file():
                print(f"Processing: {file_path.relative_to(PROJECT_ROOT)}")
                
                fixed = False
                fixed |= fix_test_file_errors(file_path)
                fixed |= fix_remaining_unknown_errors(file_path)
                fixed |= fix_property_access_errors(file_path)
                fixed |= fix_logger_argument_errors(file_path)
                
                if fixed:
                    fixed_files.append(file_path)
                    print(f"  ✓ Fixed: {file_path.relative_to(PROJECT_ROOT)}")
    
    print(f"\n✓ Fixed {len(fixed_files)} files")

if __name__ == '__main__':
    main()

