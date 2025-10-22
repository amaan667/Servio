#!/usr/bin/env node
/**
 * Script to fix Supabase session destructuring pattern
 * Converts: const { data: { user } } = await supabase.auth.getSession();
 * To: const { data: { session } } = await supabase.auth.getSession(); const user = session?.user;
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

async function fixSessionDestructuring() {
  const files = await glob('app/api/**/*.ts', {
    ignore: ['node_modules/**', '.next/**'],
    cwd: process.cwd(),
  });

  let totalFixed = 0;

  for (const file of files) {
    const filePath = path.join(process.cwd(), file);
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Pattern 1: Single line destructuring
    const pattern1 = /const\s*{\s*data:\s*{\s*user\s*}\s*,?\s*error:\s*(\w+)\s*}\s*=\s*await\s+supabase\.auth\.getSession\(\);/g;
    if (pattern1.test(content)) {
      content = content.replace(pattern1, (match, errorVar) => {
        return `const { data: { session }, error: ${errorVar} } = await supabase.auth.getSession();\n    const user = session?.user;`;
      });
      modified = true;
    }

    // Pattern 2: Multi-line destructuring
    const pattern2 = /const\s*{\s*\n\s*data:\s*{\s*user\s*}\s*,?\s*\n?\s*}\s*=\s*await\s+supabase\.auth\.getSession\(\);/g;
    content = content.replace(pattern2, () => {
      modified = true;
      return `const {\n      data: { session },\n    } = await supabase.auth.getSession();\n    const user = session?.user;`;
    });

    // Pattern 3: With error variable
    const pattern3 = /const\s*{\s*\n\s*data:\s*{\s*user\s*},\s*\n\s*error:\s*(\w+)\s*,?\s*\n\s*}\s*=\s*await\s+supabase\.auth\.getSession\(\);/g;
    content = content.replace(pattern3, (match, errorVar) => {
      modified = true;
      return `const {\n      data: { session },\n      error: ${errorVar},\n    } = await supabase.auth.getSession();\n    const user = session?.user;`;
    });

    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Fixed ${file}`);
      totalFixed++;
    }
  }

  console.log(`\n🎉 Total files fixed: ${totalFixed}`);
}

fixSessionDestructuring().catch(console.error);

