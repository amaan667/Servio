const fs = require('fs');
const path = require('path');

// Files known to have issues
const problemFiles = [
  'app/api/tables/remove/route.ts',
  'app/api/tables/clear-completed/route.ts',
  'app/api/tables/cleanup-duplicates/route.ts',
  'app/api/tables/auto-create/route.ts',
  'app/api/tables/[tableId]/route.ts',
  'app/api/tables/[tableId]/close/route.ts',
  'app/api/tables/[tableId]/seat/route.ts',
  'app/api/table-sessions/route.ts',
  'app/api/table-sessions/enhanced-merge/route.ts',
  'app/api/table-management/seat-party/route.ts',
];

function fixFile(filePath) {
  const fullPath = path.join(__dirname, '..', filePath);
  if (!fs.existsSync(fullPath)) {
    return false;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;

  // Fix _request -> req in auth blocks
  if (content.includes('_request') && content.includes('const { searchParams } = new URL(req.url)')) {
    content = content.replace(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(_request:/g, 'export async function $1(req:');
    content = content.replace(/await\s+_request\./g, 'await req.');
    content = content.replace(/new\s+URL\(_request\.url\)/g, 'new URL(req.url)');
    modified = true;
  }

  // Remove duplicate searchParams
  const searchParamsMatches = [...content.matchAll(/const\s+\{\s*searchParams\s*\}\s*=\s*new\s+URL\([^)]+\);/g)];
  if (searchParamsMatches.length > 1) {
    let first = true;
    content = content.replace(/const\s+\{\s*searchParams\s*\}\s*=\s*new\s+URL\([^)]+\);/g, (match) => {
      if (first) {
        first = false;
        return match;
      }
      modified = true;
      return '';
    });
  }

  // Fix duplicate venueId from body destructuring
  if (content.includes('let venueId') && content.includes('const {') && content.includes('venueId')) {
    // Replace body destructuring that includes venueId
    content = content.replace(/const\s+\{\s*([^}]*venueId[^}]*)\}\s*=\s*await\s+.*\.json\(\);/g, (match, destructure) => {
      const newDestructure = destructure.replace(/,\s*venueId\s*/g, '').replace(/venueId\s*,?\s*/g, '');
      modified = true;
      return `const body = await req.json();\n    const { ${newDestructure} } = body;\n    const finalVenueId = venueId || body.venueId;`;
    });
  }

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8');
    return true;
  }
  return false;
}

console.log('Fixing remaining errors...');
let fixedCount = 0;
for (const file of problemFiles) {
  if (fixFile(file)) {
    console.log(`✓ Fixed: ${file}`);
    fixedCount++;
  }
}
console.log(`\n✓ Fixed ${fixedCount} files`);

