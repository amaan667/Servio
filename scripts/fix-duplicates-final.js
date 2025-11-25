const fs = require('fs');
const path = require('path');

const filesToFix = [
  'app/api/receipts/[orderId]/pdf/route.ts',
  'app/api/reservations/[reservationId]/modify/route.ts',
  'app/api/signup/with-subscription/route.ts',
  'app/api/staff/check/route.ts',
  'app/api/staff/invitations/[token]/route.ts',
];

function fixDuplicates(filePath) {
  const fullPath = path.join(__dirname, '..', filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`File not found: ${filePath}`);
    return false;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;

  // Remove duplicate imports
  const importLines = content.split('\n').filter(line => line.includes('import'));
  const uniqueImports = new Set();
  const newImports = [];
  
  for (const line of importLines) {
    const normalized = line.trim();
    if (!uniqueImports.has(normalized)) {
      uniqueImports.add(normalized);
      newImports.push(line);
    } else {
      modified = true;
    }
  }

  // Remove duplicate searchParams declarations
  const searchParamsMatches = content.matchAll(/const\s+\{\s*searchParams\s*\}\s*=\s*new\s+URL\([^)]+\);/g);
  let firstFound = false;
  content = content.replace(/const\s+\{\s*searchParams\s*\}\s*=\s*new\s+URL\([^)]+\);/g, (match) => {
    if (!firstFound) {
      firstFound = true;
      return match;
    }
    modified = true;
    return ''; // Remove duplicate
  });

  // Remove duplicate createClient imports
  const createClientMatches = content.match(/import\s*{\s*[^}]*createClient[^}]*}\s*from\s*['"]@\/lib\/supabase['"];/g);
  if (createClientMatches && createClientMatches.length > 1) {
    let firstCreateClient = true;
    content = content.replace(/import\s*{\s*[^}]*createClient[^}]*}\s*from\s*['"]@\/lib\/supabase['"];/g, (match) => {
      if (firstCreateClient) {
        firstCreateClient = false;
        return match;
      }
      modified = true;
      return ''; // Remove duplicate
    });
  }

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8');
    return true;
  }
  return false;
}

console.log('Fixing duplicate declarations...');
let fixedCount = 0;
for (const file of filesToFix) {
  if (fixDuplicates(file)) {
    console.log(`✓ Fixed: ${file}`);
    fixedCount++;
  }
}
console.log(`\n✓ Fixed ${fixedCount} files`);

