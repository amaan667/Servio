/**
 * Batch script to add authentication to all API routes
 * This systematically adds auth and rate limiting to routes that need it
 */

const fs = require('fs');
const path = require('path');

const PUBLIC_ROUTES = [
  'health',
  'ping',
  'status',
  'ready',
  'vitals',
  'stripe/webhook',
  'stripe/webhooks',
  'feedback/questions/public',
  'auth/',
  'orders', // POST for customer orders (but GET needs auth)
  'menu', // Public menu viewing
];

function isPublicRoute(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  return PUBLIC_ROUTES.some(route => normalized.includes(route));
}

function needsAuth(filePath, content) {
  // Skip if already has auth
  if (content.includes('requireAuthForAPI') || content.includes('requireVenueAccessForAPI')) {
    return false;
  }

  // Skip public routes
  if (isPublicRoute(filePath)) {
    return false;
  }

  // Routes that use admin client definitely need auth
  if (content.includes('createAdminClient') || content.includes('SUPABASE_SERVICE_ROLE_KEY')) {
    return true;
  }

  // Routes that access venue data need auth
  if (content.includes('venue_id') || content.includes('venueId')) {
    return true;
  }

  return false;
}

function addAuthToRoute(filePath, content) {
  const lines = content.split('\n');
  let modified = false;

  // Find handler function
  let handlerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('export async function')) {
      handlerIndex = i;
      break;
    }
  }

  if (handlerIndex === -1) return { content, modified: false };

  // Check if NextRequest is imported
  const hasNextRequest = content.includes('NextRequest');
  const needsNextRequestImport = !hasNextRequest && content.includes('Request');

  // Add imports
  let lastImportIndex = -1;
  for (let i = 0; i < handlerIndex; i++) {
    if (lines[i].trim().startsWith('import ')) {
      lastImportIndex = i;
    }
  }

  if (lastImportIndex !== -1) {
    const imports = [];
    if (!content.includes('requireVenueAccessForAPI')) {
      imports.push("import { requireVenueAccessForAPI } from '@/lib/auth/api';");
    }
    if (!content.includes('rateLimit')) {
      imports.push("import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';");
    }
    if (needsNextRequestImport) {
      imports.push("import { NextRequest } from 'next/server';");
    }
    if (imports.length > 0) {
      lines.splice(lastImportIndex + 1, 0, ...imports);
      handlerIndex += imports.length;
      modified = true;
    }
  }

  // Update handler signature if needed
  if (content.includes('req: Request') && !content.includes('req: NextRequest')) {
    lines[handlerIndex] = lines[handlerIndex].replace('req: Request', 'req: NextRequest');
    modified = true;
  }

  // Find opening brace of handler
  let braceIndex = handlerIndex + 1;
  while (braceIndex < lines.length && !lines[braceIndex].includes('{')) {
    braceIndex++;
  }

  if (braceIndex < lines.length) {
    const hasVenueId = content.includes('venueId') || content.includes('venue_id');
    
    const authCode = hasVenueId ? `
    // CRITICAL: Authentication and venue access verification
    const { searchParams } = new URL(req.url);
    let venueId = searchParams.get('venueId') || searchParams.get('venue_id');
    
    if (!venueId) {
      try {
        const body = await req.clone().json();
        venueId = body?.venueId || body?.venue_id;
      } catch {
        // Body parsing failed
      }
    }
    
    if (venueId) {
      const venueAccessResult = await requireVenueAccessForAPI(venueId);
      if (!venueAccessResult.success) {
        return venueAccessResult.response;
      }
    } else {
      // Fallback to basic auth if no venueId
      const { requireAuthForAPI } = await import('@/lib/auth/api');
      const authResult = await requireAuthForAPI();
      if (authResult.error || !authResult.user) {
        return NextResponse.json(
          { error: 'Unauthorized', message: authResult.error || 'Authentication required' },
          { status: 401 }
        );
      }
    }

    // CRITICAL: Rate limiting
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: \`Rate limit exceeded. Try again in \${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.\`,
        },
        { status: 429 }
      );
    }
` : `
    // CRITICAL: Authentication check
    const { requireAuthForAPI } = await import('@/lib/auth/api');
    const authResult = await requireAuthForAPI();
    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: authResult.error || 'Authentication required' },
        { status: 401 }
      );
    }

    // CRITICAL: Rate limiting
    const { rateLimit, RATE_LIMITS } = await import('@/lib/rate-limit');
    const rateLimitResult = await rateLimit(req as unknown as NextRequest, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: \`Rate limit exceeded. Try again in \${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.\`,
        },
        { status: 429 }
      );
    }
`;

    lines.splice(braceIndex + 1, 0, authCode);
    modified = true;
  }

  // Replace admin client with authenticated client
  if (content.includes('createAdminClient()')) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('createAdminClient()')) {
        lines[i] = lines[i].replace('createAdminClient()', 'await createClient()');
        // Add import if needed
        if (!content.includes("import { createClient }")) {
          if (content.includes("import { createAdminClient }")) {
            lines[i] = lines[i].replace('createAdminClient', 'createClient');
          } else {
            // Find last import and add
            let lastImport = -1;
            for (let j = 0; j < i; j++) {
              if (lines[j].trim().startsWith('import ')) {
                lastImport = j;
              }
            }
            if (lastImport !== -1) {
              lines.splice(lastImport + 1, 0, "import { createClient } from '@/lib/supabase';");
            }
          }
        }
        modified = true;
      }
    }
  }

  return {
    content: lines.join('\n'),
    modified,
  };
}

function findApiRoutes(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory() && !filePath.includes('node_modules') && !filePath.includes('.next')) {
      findApiRoutes(filePath, fileList);
    } else if (file === 'route.ts' || file === 'route.tsx') {
      fileList.push(filePath);
    }
  });

  return fileList;
}

// Process all API routes
const apiDir = path.join(__dirname, '..', 'app', 'api');
const routes = findApiRoutes(apiDir);

let processedCount = 0;
const errors = [];

routes.forEach(route => {
  try {
    if (needsAuth(route, fs.readFileSync(route, 'utf8'))) {
      const content = fs.readFileSync(route, 'utf8');
      const result = addAuthToRoute(route, content);
      if (result.modified) {
        fs.writeFileSync(route, result.content, 'utf8');
        console.log(`✓ ${route}`);
        processedCount++;
      }
    }
  } catch (error) {
    errors.push({ route, error: error.message });
    console.error(`✗ ${route}: ${error.message}`);
  }
});

console.log(`\n✓ Processed ${processedCount} routes`);
if (errors.length > 0) {
  console.log(`\n✗ ${errors.length} errors:`);
  errors.forEach(e => console.log(`  - ${e.route}: ${e.error}`));
}

