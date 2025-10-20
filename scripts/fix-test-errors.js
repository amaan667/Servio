#!/usr/bin/env node
/**
 * Fix all test file TypeScript errors
 */

const fs = require('fs');
const path = require('path');

// Fix specific test files
const fixes = [
  {
    file: '__tests__/api/menu.test.ts',
    changes: [
      {
        find: 'const request = new Request(',
        replace: 'const request = new NextRequest(',
      },
    ],
  },
  {
    file: '__tests__/api/orders.test.ts',
    changes: [
      {
        find: /mockRequest\.url = 'http:\/\/localhost:3000\/api\/orders\?venueId=venue-1&status=COMPLETED';/g,
        replace: 'Object.defineProperty(mockRequest, \'url\', { value: \'http://localhost:3000/api/orders?venueId=venue-1&status=COMPLETED\', writable: true });',
      },
      {
        find: /mockRequest\.method = 'POST';/g,
        replace: 'Object.defineProperty(mockRequest, \'method\', { value: \'POST\', writable: true });',
      },
    ],
  },
  {
    file: '__tests__/hooks/useMenuItems.test.ts',
    changes: [
      {
        find: /it\('should fetch menu items', async \(\) => \{[\s\S]*?expect\(result\.current\.menuItems\)\.toHaveLength\(2\);/g,
        replace: (match) => {
          return match.replace(/expect\(result\.current\.menuItems\)\.toHaveLength\(2\);/g, 'expect(result.current.menuItems).toHaveLength(2);\n      return true;');
        },
      },
    ],
  },
  {
    file: '__tests__/logger/production-logger.test.ts',
    changes: [
      {
        find: 'afterEach(() => {',
        replace: 'afterEach(() => {',
        addImport: 'import { afterEach } from \'vitest\';',
      },
      {
        find: /process\.env\.NODE_ENV = 'production';/g,
        replace: 'Object.defineProperty(process.env, \'NODE_ENV\', { value: \'production\', writable: true });',
      },
      {
        find: /process\.env\.NODE_ENV = 'development';/g,
        replace: 'Object.defineProperty(process.env, \'NODE_ENV\', { value: \'development\', writable: true });',
      },
    ],
  },
  {
    file: '__tests__/middleware/authorization.test.ts',
    changes: [
      {
        find: /const context = \{[\s\S]*?venue: \{ venue_id: 'venue-123' \},[\s\S]*?user: \{ id: 'user-123' \},[\s\S]*?role: 'owner',[\s\S]*?venueId: 'venue-123'[\s\S]*?\};/g,
        replace: 'const context: AuthorizedContext = {\n      venue: {\n        venue_id: \'venue-123\',\n        owner_id: \'user-123\',\n        name: \'Test Venue\',\n        created_at: new Date().toISOString(),\n        updated_at: new Date().toISOString(),\n      },\n      user: { id: \'user-123\' },\n      role: \'owner\',\n      venueId: \'venue-123\'\n    };',
      },
    ],
  },
];

fixes.forEach(({ file, changes }) => {
  const fullPath = path.join(__dirname, '..', file);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`Skipping ${file} (not found)`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;
  
  changes.forEach(({ find, replace, addImport }) => {
    if (typeof find === 'string') {
      if (content.includes(find)) {
        if (typeof replace === 'function') {
          content = content.replace(find, replace);
        } else {
          content = content.replace(find, replace);
        }
        modified = true;
      }
    } else if (find instanceof RegExp) {
      if (content.match(find)) {
        if (typeof replace === 'function') {
          content = content.replace(find, replace);
        } else {
          content = content.replace(find, replace);
        }
        modified = true;
      }
    }
    
    if (addImport && !content.includes(addImport)) {
      content = addImport + '\n' + content;
      modified = true;
    }
  });
  
  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ Fixed ${file}`);
  }
});

console.log('\n✅ All test errors fixed!');

