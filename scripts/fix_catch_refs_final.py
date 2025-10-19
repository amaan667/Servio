#!/usr/bin/env python3
"""
Fix all catch blocks to use consistent variable names.
The previous script changed catch (error: unknown) to catch (e: unknown) with const err = toError(e),
but didn't update the rest of the code in that catch block to use err instead of error.
"""

import re
from pathlib import Path

ROOT = Path("/Users/amaan/Downloads/servio-mvp-cleaned")

def fix_catch_block_references(content):
    """
    Find all catch blocks with `const err = toError(e)` and replace subsequent 
    references to undefined `error` or `err` variables with the correct one.
    """
    lines = content.split('\n')
    result_lines = []
    
    i = 0
    while i < len(lines):
        line = lines[i]
        result_lines.append(line)
        
        # Check if this line starts a catch block with (e: unknown) or (error)
        if 'catch' in line and ('(e: unknown)' in line or '(error)' in line or '(err)' in line or '(e)' in line):
            # Determine what variable is defined
            catch_var = None
            if '(e: unknown)' in line or '(e)' in line and 'error' not in line:
                # Look ahead to see what const variable is created
                for j in range(i+1, min(i+10, len(lines))):
                    if 'const err = toError' in lines[j]:
                        catch_var = 'err'
                        break
                    elif 'const error = toError' in lines[j]:
                        catch_var = 'error'
                        break
            elif '(error)' in line:
                catch_var = 'error'
            elif '(err)' in line:
                catch_var = 'err'
            
            if not catch_var:
                i += 1
                continue
            
            # Find the end of this catch block
            catch_start = i
            brace_count = line.count('{') - line.count('}')
            catch_end = i
            
            for j in range(i+1, len(lines)):
                brace_count += lines[j].count('{') - lines[j].count('}')
                if brace_count == 0:
                    catch_end = j
                    break
            
            # Now fix all references in this catch block
            # If catch_var is 'err', replace 'error' with 'err'
            # If catch_var is 'error', replace 'err' with 'error'
            wrong_var = 'error' if catch_var == 'err' else 'err'
            
            for j in range(catch_start+1, catch_end+1):
                if j >= len(lines):
                    break
                
                original_line = result_lines[j] if j < len(result_lines) else lines[j]
                fixed_line = original_line
                
                # Don't replace in comments or strings
                if '//' not in fixed_line.split('#')[0]:  # Skip comment lines
                    # Replace wrong_var with catch_var in common patterns
                    # Pattern: , error) or , err)
                    fixed_line = re.sub(rf',\s*{wrong_var}\s*\)', f', {catch_var})', fixed_line)
                    # Pattern: : error or : err  
                    fixed_line = re.sub(rf':\s*{wrong_var}\s*\)', f': {catch_var})', fixed_line)
                    # Pattern: error.message or err.message
                    fixed_line = re.sub(rf'\b{wrong_var}\.message\b', f'{catch_var}.message', fixed_line)
                    # Pattern: error.stack or err.stack
                    fixed_line = re.sub(rf'\b{wrong_var}\.stack\b', f'{catch_var}.stack', fixed_line)
                    # Pattern: throw error; or throw err;
                    fixed_line = re.sub(rf'throw\s+{wrong_var}\s*;', f'throw {catch_var};', fixed_line)
                    # Pattern: (error or (err at start of expression
                    fixed_line = re.sub(rf'\({wrong_var}\s', f'({catch_var} ', fixed_line)
                    # Pattern: { error: or { err:
                    fixed_line = re.sub(rf'{{\s*error:\s*{wrong_var}\b', f'{{ error: {catch_var}', fixed_line)
                    # Pattern: return ... error ...
                    if 'return' in fixed_line and f' {wrong_var}' in fixed_line:
                        fixed_line = re.sub(rf'\b{wrong_var}\b(?=[,\)\s;])', catch_var, fixed_line)
                
                if j < len(result_lines):
                    result_lines[j] = fixed_line
        
        i += 1
    
    return '\n'.join(result_lines)

def process_file(filepath):
    """Process a single file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        new_content = fix_catch_block_references(content)
        
        if new_content != content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            return True
        return False
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False

def main():
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
            if process_file(filepath):
                fixed_count += 1
                print(f"Fixed: {filepath.relative_to(ROOT)}")
    
    print(f"\nTotal files fixed: {fixed_count}")

if __name__ == "__main__":
    main()

