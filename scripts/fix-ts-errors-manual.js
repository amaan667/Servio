#!/usr/bin/env node
/**
 * Manual TypeScript error fixes
 */

const fs = require('fs');
const path = require('path');

// Fix specific files with known issues
const fixes = [
  {
    file: '__tests__/middleware/authorization.test.ts',
    addImport: "import type { AuthorizedContext } from '@/lib/middleware/authorization';",
  },
  {
    file: '__tests__/hooks/useMenuItems.test.ts',
    changes: [
      {
        find: /expect\(result\.current\.menuItems\)\.toHaveLength\(2\);\s*\n\s*\}\);/g,
        replace: 'expect(result.current.menuItems).toHaveLength(2);\n      return true;\n    });',
      },
    ],
  },
];

fixes.forEach(({ file, addImport, changes }) => {
  const fullPath = path.join(__dirname, '..', file);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`Skipping ${file} (not found)`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;
  
  if (addImport && !content.includes(addImport)) {
    content = addImport + '\n' + content;
    modified = true;
  }
  
  if (changes) {
    changes.forEach(({ find, replace }) => {
      if (content.match(find)) {
        content = content.replace(find, replace);
        modified = true;
      }
    });
  }
  
  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ Fixed ${file}`);
  }
});

console.log('\n✅ Manual fixes applied!');

