#!/usr/bin/env node

/**
 * Fix lexical declarations in case blocks
 * Wraps declarations in {}
 */

import fs from 'fs';
import { glob } from 'glob';

async function fixFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const newLines = [];
  
  let modified = false;
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Check if this is a case statement followed by const/let
    if (trimmed.startsWith('case ') && trimmed.endsWith(':')) {
      const nextLine = lines[i + 1];
      const nextTrimmed = nextLine?.trim() || '';
      
      if (nextTrimmed.startsWith('const ') || nextTrimmed.startsWith('let ')) {
        // Found case with lexical declaration - wrap in {}
        const indent = line.match(/^(\s*)/)[1];
        newLines.push(line);
        newLines.push(indent + '  {');
        
        // Add lines until break or next case
        i++;
        while (i < lines.length) {
          const currentLine = lines[i];
          const currentTrimmed = currentLine.trim();
          
          if (currentTrimmed.startsWith('case ') || currentTrimmed.startsWith('default:')) {
            // Found next case - close block before it
            newLines.push(indent + '  }');
            modified = true;
            i--; // Re-process this line
            break;
          }
          
          if (currentTrimmed === 'break;') {
            // Found break - add it then close block
            newLines.push(currentLine);
            newLines.push(indent + '  }');
            modified = true;
            i++;
            break;
          }
          
          // Regular line inside case
          newLines.push('  ' + currentLine); // Extra indent
          i++;
        }
        continue;
      }
    }
    
    newLines.push(line);
    i++;
  }
  
  if (modified) {
    fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
    return true;
  }
  
  return false;
}

async function main() {
  console.log('🔧 Fixing case declarations...\n');
  
  const files = await glob('{app,components,lib,hooks}/**/*.{ts,tsx}', {
    ignore: ['**/node_modules/**', '**/.next/**']
  });
  
  let fixed = 0;
  for (const file of files) {
    if (await fixFile(file)) {
      console.log(`✅ ${file}`);
      fixed++;
    }
  }
  
  console.log(`\n✅ Fixed ${fixed} files`);
}

main().catch(console.error);

