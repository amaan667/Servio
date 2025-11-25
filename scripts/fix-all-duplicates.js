const fs = require('fs');
const path = require('path');

const apiRoutesDir = path.join(__dirname, '../app/api');

function fixDuplicatesInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const originalContent = content;

  // Fix duplicate searchParams
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

  // Fix duplicate createClient imports
  const createClientImports = content.match(/import\s*{\s*[^}]*createClient[^}]*}\s*from\s*['"]@\/lib\/supabase['"];/g);
  if (createClientImports && createClientImports.length > 1) {
    const seen = new Set();
    content = content.replace(/import\s*{\s*[^}]*createClient[^}]*}\s*from\s*['"]@\/lib\/supabase['"];/g, (match) => {
      if (seen.has(match)) {
        modified = true;
        return '';
      }
      seen.add(match);
      return match;
    });
  }

  // Fix duplicate venueId in same scope (const then let, or multiple const)
  // This is more complex - we'll handle it case by case
  const lines = content.split('\n');
  const newLines = [];
  let inFunction = false;
  let venueIdDeclared = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Track function boundaries
    if (line.includes('export async function') || line.includes('export function')) {
      inFunction = true;
      venueIdDeclared = false;
    }
    if (line.includes('}') && inFunction && line.match(/\}/g)?.length === 1) {
      inFunction = false;
      venueIdDeclared = false;
    }
    
    // Check for duplicate venueId declarations
    if (inFunction && (line.includes('const { venueId }') || line.includes('let venueId') || line.includes('const venueId'))) {
      if (venueIdDeclared && !line.includes('finalVenueId')) {
        // Replace with finalVenueId pattern if it's from JSON body
        if (line.includes('await') && line.includes('json()')) {
          const bodyMatch = line.match(/const\s+\{\s*([^}]*venueId[^}]*)\}\s*=\s*await/);
          if (bodyMatch) {
            const destructure = bodyMatch[1].replace(/venueId\s*,?\s*/g, '').trim();
            newLines.push(`    const body = await req.json();`);
            if (destructure) {
              newLines.push(`    const { ${destructure} } = body;`);
            }
            newLines.push(`    const finalVenueId = venueId || body.venueId;`);
            modified = true;
            continue;
          }
        }
        // Skip duplicate declaration
        modified = true;
        continue;
      }
      venueIdDeclared = true;
    }
    
    newLines.push(line);
  }
  
  if (modified) {
    content = newLines.join('\n');
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  let fixedCount = 0;

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      fixedCount += processDirectory(fullPath);
    } else if (file.endsWith('.ts') && file === 'route.ts') {
      if (fixDuplicatesInFile(fullPath)) {
        console.log(`✓ Fixed: ${fullPath}`);
        fixedCount++;
      }
    }
  }

  return fixedCount;
}

console.log('Fixing all duplicate declarations...');
const fixed = processDirectory(apiRoutesDir);
console.log(`\n✓ Fixed ${fixed} files`);
