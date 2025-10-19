#!/usr/bin/env python3
"""
Safe TypeScript Error Fixing Script
Fixes common TS errors without breaking code:
- TS18046: 'error'/'err' is of type 'unknown' - adds type annotations
- TS2339: Property does not exist - uses getErrorMessage()
- TS2345: Type assignment - uses getErrorDetails()
"""

import os
import re
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent

def fix_catch_blocks(file_path: Path):
    """Fix catch blocks to add : unknown type annotation"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception:
        return False

    original_content = content

    # Fix: catch (error) -> catch (error: unknown)
    # Only replace if not already typed
    content = re.sub(
        r'catch\s*\(\s*(error|err|e)\s*\)\s*\{',
        lambda m: f'catch ({m.group(1)}: unknown) {{',
        content
    )

    # Fix: catch (error: any) -> catch (error: unknown)
    content = re.sub(
        r'catch\s*\(\s*(error|err|e)\s*:\s*any\s*\)\s*\{',
        lambda m: f'catch ({m.group(1)}: unknown) {{',
        content
    )

    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    
    return False

def fix_error_property_access(file_path: Path):
    """Fix error.property access in catch blocks"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception:
        return False

    original_content = content

    # Split into lines to track catch blocks
    lines = content.split('\n')
    new_lines = []
    in_catch = False
    catch_var = None
    
    for line in lines:
        # Check if we're entering a catch block
        catch_match = re.search(r'catch\s*\(\s*(\w+)\s*:\s*unknown\s*\)', line)
        if catch_match:
            in_catch = True
            catch_var = catch_match.group(1)
            new_lines.append(line)
            continue
        
        # Check if we're leaving the catch block
        if in_catch and line.strip().startswith('}') and '{' not in line:
            in_catch = False
            catch_var = None
            new_lines.append(line)
            continue
        
        # If in catch block, replace error.message with getErrorMessage(error)
        if in_catch and catch_var:
            # Replace catch_var.message with getErrorMessage(catch_var)
            line = re.sub(
                rf'\b{re.escape(catch_var)}\.message\b',
                f'getErrorMessage({catch_var})',
                line
            )
            # Replace catch_var.name with getErrorDetails(catch_var).name
            line = re.sub(
                rf'\b{re.escape(catch_var)}\.name\b',
                f'getErrorDetails({catch_var}).name',
                line
            )
            # Replace catch_var.stack with getErrorDetails(catch_var).stack
            line = re.sub(
                rf'\b{re.escape(catch_var)}\.stack\b',
                f'getErrorDetails({catch_var}).stack',
                line
            )
        
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
                import_stmt = "\nimport { getErrorMessage, getErrorDetails } from '@/lib/utils/errors';"
                content = content[:insert_pos] + import_stmt + content[insert_pos:]
            else:
                content = "import { getErrorMessage, getErrorDetails } from '@/lib/utils/errors';\n" + content

    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    
    return False

def fix_logger_calls(file_path: Path):
    """Fix logger calls to use getErrorDetails()"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception:
        return False

    original_content = content

    # Split into lines to track catch blocks
    lines = content.split('\n')
    new_lines = []
    in_catch = False
    catch_var = None
    
    for line in lines:
        # Check if we're entering a catch block
        catch_match = re.search(r'catch\s*\(\s*(\w+)\s*:\s*unknown\s*\)', line)
        if catch_match:
            in_catch = True
            catch_var = catch_match.group(1)
            new_lines.append(line)
            continue
        
        # Check if we're leaving the catch block
        if in_catch and line.strip().startswith('}') and '{' not in line:
            in_catch = False
            catch_var = None
            new_lines.append(line)
            continue
        
        # If in catch block, replace logger calls with catch variable
        if in_catch and catch_var:
            # Pattern: logger.error(msg, catch_var) -> logger.error(msg, getErrorDetails(catch_var))
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
    """Main function to fix TypeScript errors"""
    
    # Directories to process
    directories = [
        'app',
        'lib',
        'hooks',
        'components',
    ]
    
    fixed_files = []
    
    for directory in directories:
        dir_path = PROJECT_ROOT / directory
        if not dir_path.exists():
            continue
        
        # Find all TypeScript files
        for file_path in dir_path.rglob('*.ts'):
            if file_path.is_file() and 'node_modules' not in str(file_path):
                print(f"Processing: {file_path.relative_to(PROJECT_ROOT)}")
                
                fixed = False
                fixed |= fix_catch_blocks(file_path)
                fixed |= fix_error_property_access(file_path)
                fixed |= fix_logger_calls(file_path)
                
                if fixed:
                    fixed_files.append(file_path)
                    print(f"  ✓ Fixed: {file_path.relative_to(PROJECT_ROOT)}")
    
    print(f"\n✓ Fixed {len(fixed_files)} files")
    if fixed_files:
        print("\nFixed files:")
        for f in fixed_files[:20]:  # Show first 20
            print(f"  - {f.relative_to(PROJECT_ROOT)}")
        if len(fixed_files) > 20:
            print(f"  ... and {len(fixed_files) - 20} more")

if __name__ == '__main__':
    main()

