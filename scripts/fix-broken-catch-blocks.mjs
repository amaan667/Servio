#!/usr/bin/env node

/**
 * Fix broken catch blocks from console cleanup
 * Restore error/req/e variables that were incorrectly prefixed
 */

import fs from 'fs';
import { glob } from 'glob';

async function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Fix 1: catch (_error) but code uses 'error'
  if (content.includes('catch (_error)') && content.includes(' error')) {
    content = content.replace(/catch \(_error\)/g, 'catch (error)');
    modified = true;
  }
  
  // Fix 2: catch (_e) but code uses 'e'
  if (content.includes('catch (_e)') && content.includes(' e ')) {
    content = content.replace(/catch \(_e\)/g, 'catch (e)');
    modified = true;
  }
  
  // Fix 3: catch (_err) but code uses 'err'
  if (content.includes('catch (_err)') && content.includes(' err')) {
    content = content.replace(/catch \(_err\)/g, 'catch (err)');
    modified = true;
  }
  
  // Fix 4: async function(_req: Request) but code uses 'req'
  if (content.includes('_req:') && content.match(/\breq\b/)) {
    // This is tricky - only fix if 'req' is actually used
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('_req:') && lines[i].includes('Request')) {
        // Check if 'req' is used in the function body
        let usesReq = false;
        for (let j = i + 1; j < Math.min(i + 50, lines.length); j++) {
          if (lines[j].match(/\breq\./)) {
            usesReq = true;
            break;
          }
        }
        if (usesReq) {
          lines[i] = lines[i].replace('_req:', 'req:');
          modified = true;
        }
      }
    }
    if (modified) {
      content = lines.join('\n');
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  
  return false;
}

async function main() {
  console.log('🔧 Fixing broken catch blocks from console cleanup...\n');
  
  const files = await glob('{app,components,lib,hooks}/**/*.{ts,tsx}', {
    ignore: ['**/node_modules/**', '**/.next/**', '**/scripts/**']
  });
  
  let fixed = 0;
  for (const file of files) {
    if (await fixFile(file)) {
      console.log(`✅ ${file}`);
      fixed++;
    }
  }
  
  console.log(`\n✅ Fixed ${fixed} files with broken error references`);
}

main().catch(console.error);

