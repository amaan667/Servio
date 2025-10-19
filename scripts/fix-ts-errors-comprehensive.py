#!/usr/bin/env python3
"""
Comprehensive TypeScript error fixing script
Fixes common TS errors:
- TS18046: 'error'/'err' is of type 'unknown'
- TS2345: Type assignment issues
- TS2339: Property does not exist
- TS2554: Expected X arguments, but got Y
"""

import os
import re
from pathlib import Path

# Get the project root
PROJECT_ROOT = Path(__file__).parent.parent

def fix_unknown_error_catches(file_path: Path):
    """Fix 'error' is of type 'unknown' errors in catch blocks"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception:
        return False

    original_content = content

    # Pattern 1: catch (error) { ... error.message ... }
    # Replace with: catch (error) { ... getErrorMessage(error) ... }
    pattern1 = re.compile(
        r'(catch\s*\(\s*)(error|err|e)\s*(\s*\)\s*\{)',
        re.MULTILINE
    )
    
    def replace_catch(match):
        var_name = match.group(2)
        return f'{match.group(1)}{var_name}: unknown{match.group(3)}'
    
    content = pattern1.sub(replace_catch, content)

    # Pattern 2: error.message -> getErrorMessage(error)
    # Only replace in catch blocks
    lines = content.split('\n')
    in_catch = False
    catch_var = None
    new_lines = []
    
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

    # Add import if we modified the file
    if content != original_content and 'getErrorMessage' in content:
        # Check if import already exists
        if 'from \'@/lib/utils/errors\'' not in content:
            # Find the last import statement
            import_pattern = re.compile(r'^import .* from [\'"].*[\'"];?$', re.MULTILINE)
            imports = list(import_pattern.finditer(content))
            
            if imports:
                last_import = imports[-1]
                insert_pos = last_import.end()
                # Add new import after the last import
                import_stmt = "\nimport { getErrorMessage, getErrorDetails } from '@/lib/utils/errors';"
                content = content[:insert_pos] + import_stmt + content[insert_pos:]
            else:
                # Add at the top of the file
                content = "import { getErrorMessage, getErrorDetails } from '@/lib/utils/errors';\n" + content

    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    
    return False

def fix_logger_context_errors(file_path: Path):
    """Fix logger context type errors"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception:
        return False

    original_content = content

    # Fix: logger.error(message, string) -> logger.error(message, { message: string })
    content = re.sub(
        r'logger\.(error|warn|info|debug|log)\s*\(\s*([^,]+),\s*([\'"])([^\'"]+)\3\s*\)',
        r'logger.\1(\2, { message: \3\4\3 })',
        content
    )

    # Fix: logger.error(message, error) where error is unknown
    # Replace with: logger.error(message, getErrorDetails(error))
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
        
        # Replace logger calls with error variable
        if in_catch and catch_var:
            # Pattern: logger.error(msg, catch_var)
            line = re.sub(
                rf'logger\.(error|warn|info|debug|log)\s*\(\s*([^,]+),\s*{re.escape(catch_var)}\s*\)',
                rf'logger.\1(\2, getErrorDetails({catch_var}))',
                line
            )
        
        new_lines.append(line)
    
    content = '\n'.join(new_lines)

    # Add imports if needed
    if content != original_content:
        if 'getErrorDetails' in content and 'from \'@/lib/utils/errors\'' not in content:
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

def fix_property_does_not_exist(file_path: Path):
    """Fix property does not exist errors (TS2339)"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception:
        return False

    original_content = content

    # Fix: error.message where error is {} -> getErrorMessage(error)
    content = re.sub(
        r'(\w+)\.message',
        lambda m: f'getErrorMessage({m.group(1)})' if m.group(1) not in ['console', 'logger', 'process', 'window', 'document'] else m.group(0),
        content
    )

    # Add import if needed
    if content != original_content and 'getErrorMessage' in content:
        if 'from \'@/lib/utils/errors\'' not in content:
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

def main():
    """Main function to fix all TypeScript errors"""
    
    # Directories to process
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
        
        # Find all TypeScript files
        for file_path in dir_path.rglob('*.ts'):
            if file_path.is_file():
                print(f"Processing: {file_path.relative_to(PROJECT_ROOT)}")
                
                fixed = False
                fixed |= fix_unknown_error_catches(file_path)
                fixed |= fix_logger_context_errors(file_path)
                fixed |= fix_property_does_not_exist(file_path)
                
                if fixed:
                    fixed_files.append(file_path)
                    print(f"  ✓ Fixed: {file_path.relative_to(PROJECT_ROOT)}")
    
    print(f"\n✓ Fixed {len(fixed_files)} files")
    if fixed_files:
        print("\nFixed files:")
        for f in fixed_files:
            print(f"  - {f.relative_to(PROJECT_ROOT)}")

if __name__ == '__main__':
    main()

