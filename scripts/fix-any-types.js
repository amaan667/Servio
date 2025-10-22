#!/usr/bin/env node
/**
 * Script to safely eliminate 'any' types from TypeScript files
 * Usage: node scripts/fix-any-types.js
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

async function fixAnyTypes() {
  const files = await glob('**/*.{ts,tsx}', {
    ignore: ['node_modules/**', '.next/**', '**/*.d.ts', '**/ANY_TYPES*.md'],
    cwd: process.cwd(),
  });

  let totalFixed = 0;
  const replacements = [
    // Catch blocks
    [/catch \(error: any\)/g, 'catch (error)'],
    [/catch \(err: any\)/g, 'catch (err)'],
    [/catch \(e: any\)/g, 'catch (e)'],
    
    // Arrays
    [/: any\[\]/g, ': unknown[]'],
    
    // Function parameters
    [/\(payload: any\)/g, '(payload: unknown)'],
    [/\(session: any\)/g, '(session: unknown)'],
    [/\(event: any\)/g, '(event: unknown)'],
    [/\(data: any\)/g, '(data: unknown)'],
    [/\(value: any\)/g, '(value: unknown)'],
    [/\(options: any\)/g, '(options: Record<string, unknown>)'],
    [/\(order: any\)/g, '(order: Record<string, unknown>)'],
    [/\(item: any\)/g, '(item: Record<string, unknown>)'],
    [/\(o: any\)/g, '(o: Record<string, unknown>)'],
    [/\(mi: any\)/g, '(mi: Record<string, unknown>)'],
    [/\(identity: any\)/g, '(identity: Record<string, unknown>)'],
    
    // Type annotations
    [/: any,/g, ': unknown,'],
    [/: any;/g, ': unknown;'],
    [/: any =/g, ': unknown ='],
    [/: any\)/g, ': unknown)'],
    [/: any\]/g, ': unknown]'],
    [/: any }/g, ': unknown }'],
    
    // Index signatures
    [/\[key: string\]: any/g, '[key: string]: unknown'],
    
    // Generic types - be more conservative
    [/<any>/g, '<unknown>'],
  ];

  for (const file of files) {
    const filePath = path.join(process.cwd(), file);
    let content = fs.readFileSync(filePath, 'utf8');
    let fileFixed = 0;

    for (const [pattern, replacement] of replacements) {
      const matches = content.match(pattern);
      if (matches) {
        content = content.replace(pattern, replacement);
        fileFixed += matches.length;
      }
    }

    if (fileFixed > 0) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Fixed ${fileFixed} in ${file}`);
      totalFixed += fileFixed;
    }
  }

  console.log(`\n🎉 Total fixed: ${totalFixed} any types`);
}

fixAnyTypes().catch(console.error);

