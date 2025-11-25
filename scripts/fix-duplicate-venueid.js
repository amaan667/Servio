const fs = require('fs');
const path = require('path');

const apiRoutesDir = path.join(__dirname, '../app/api');

function fixDuplicateVenueId(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Pattern: if we have "let venueId" or "const venueId" early, and then later "const { venueId }" or "let { venueId }" from JSON
  // We need to replace the second one with finalVenueId pattern

  // Check if file has both patterns
  const hasEarlyVenueId = /let\s+venueId\s*=|const\s+venueId\s*=\s*searchParams/.test(content);
  const hasLaterVenueIdDestructure = /const\s+\{\s*[^}]*venueId[^}]*\}\s*=\s*await\s+.*\.json\(\)/.test(content);

  if (hasEarlyVenueId && hasLaterVenueIdDestructure) {
    // Replace the destructured venueId with finalVenueId pattern
    content = content.replace(
      /const\s+\{\s*([^}]*venueId[^}]*)\}\s*=\s*await\s+.*\.json\(\);/,
      (match, destructure) => {
        // Remove venueId from destructure
        const newDestructure = destructure.replace(/,\s*venueId\s*/g, '').replace(/venueId\s*,?\s*/g, '');
        return `const body = await req.json();\n    const { ${newDestructure} } = body;\n    const finalVenueId = venueId || body.venueId;`;
      }
    );

    // Replace all other venueId references with finalVenueId (but not in the auth block)
    // Only replace after the JSON parsing
    const lines = content.split('\n');
    let inAuthBlock = true;
    const newLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if we're past the auth/rate limit block
      if (line.includes('await req.json()') || line.includes('await _request.json()')) {
        inAuthBlock = false;
      }
      
      if (!inAuthBlock && line.includes('venueId') && !line.includes('finalVenueId') && !line.includes('let venueId') && !line.includes('const venueId = searchParams')) {
        // Replace venueId with finalVenueId in database queries and other uses
        newLines.push(line.replace(/\bvenueId\b/g, 'finalVenueId'));
        modified = true;
      } else {
        newLines.push(line);
      }
    }
    
    content = newLines.join('\n');
    modified = true;
  }

  if (modified) {
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
      if (fixDuplicateVenueId(fullPath)) {
        console.log(`✓ Fixed: ${fullPath}`);
        fixedCount++;
      }
    }
  }

  return fixedCount;
}

console.log('Fixing duplicate venueId declarations...');
const fixed = processDirectory(apiRoutesDir);
console.log(`\n✓ Fixed ${fixed} files`);

