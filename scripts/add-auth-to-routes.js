/**
 * Script to systematically add authentication to API routes
 * This script identifies routes that need auth and adds the necessary imports and checks
 */

const fs = require('fs');
const path = require('path');

const PUBLIC_ROUTES = [
  '/api/health',
  '/api/ping',
  '/api/status',
  '/api/ready',
  '/api/vitals',
  '/api/stripe/webhook',
  '/api/stripe/webhooks',
  '/api/feedback/questions/public',
  '/api/auth/',
  '/api/orders', // POST for customer orders
  '/api/menu', // Public menu viewing
];

function isPublicRoute(filePath) {
  return PUBLIC_ROUTES.some(route => filePath.includes(route));
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

  // Skip if uses admin client (needs special handling)
  if (content.includes('createAdminClient') || content.includes('SUPABASE_SERVICE_ROLE_KEY')) {
    return true; // These definitely need auth
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
  let insertIndex = -1;

  // Find where to insert (after imports, before handler)
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('export async function')) {
      insertIndex = i;
      break;
    }
  }

  if (insertIndex === -1) return { content, modified: false };

  // Check if already has imports
  const hasAuthImport = content.includes('requireVenueAccessForAPI') || content.includes('requireAuthForAPI');
  const hasRateLimitImport = content.includes('rateLimit') || content.includes('RATE_LIMITS');

  // Add imports if needed
  if (!hasAuthImport || !hasRateLimitImport) {
    // Find last import line
    let lastImportIndex = -1;
    for (let i = 0; i < insertIndex; i++) {
      if (lines[i].trim().startsWith('import ')) {
        lastImportIndex = i;
      }
    }

    if (lastImportIndex !== -1) {
      const imports = [];
      if (!hasAuthImport) {
        imports.push("import { requireVenueAccessForAPI } from '@/lib/auth/api';");
      }
      if (!hasRateLimitImport) {
        imports.push("import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';");
      }
      lines.splice(lastImportIndex + 1, 0, ...imports);
      insertIndex += imports.length;
      modified = true;
    }
  }

  // Add auth check at start of handler
  const handlerLine = lines[insertIndex];
  const handlerMatch = handlerLine.match(/export async function (\w+)\(req: (Request|NextRequest)/);
  
  if (handlerMatch) {
    const handlerName = handlerMatch[1];
    const isNextRequest = handlerMatch[2] === 'NextRequest';
    
    // Extract venueId from handler
    const hasVenueId = content.includes('venueId') || content.includes('venue_id');
    
    const authCode = hasVenueId ? `
    // CRITICAL: Authentication and venue access verification
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get('venueId') || searchParams.get('venue_id');
    
    if (venueId) {
      const venueAccessResult = await requireVenueAccessForAPI(venueId);
      if (!venueAccessResult.success) {
        return venueAccessResult.response;
      }
    } else {
      // Try to get from body
      try {
        const body = await req.clone().json();
        const venueIdFromBody = body?.venueId || body?.venue_id;
        if (venueIdFromBody) {
          const venueAccessResult = await requireVenueAccessForAPI(venueIdFromBody);
          if (!venueAccessResult.success) {
            return venueAccessResult.response;
          }
        }
      } catch {
        // Body parsing failed, continue
      }
    }

    // CRITICAL: Rate limiting
    const rateLimitResult = await rateLimit(req${isNextRequest ? '' : ' as unknown as NextRequest'}, RATE_LIMITS.GENERAL);
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
    const rateLimitResult = await rateLimit(req${isNextRequest ? '' : ' as unknown as NextRequest'}, RATE_LIMITS.GENERAL);
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

    // Find the opening brace of the handler
    let braceIndex = insertIndex + 1;
    while (braceIndex < lines.length && !lines[braceIndex].includes('{')) {
      braceIndex++;
    }

    if (braceIndex < lines.length) {
      lines.splice(braceIndex + 1, 0, authCode);
      modified = true;
    }
  }

  return {
    content: lines.join('\n'),
    modified,
  };
}

function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    if (!needsAuth(filePath, content)) {
      return false;
    }

    const result = addAuthToRoute(filePath, content);
    if (result.modified) {
      fs.writeFileSync(filePath, result.content, 'utf8');
      console.log(`✓ Added auth to: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
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
routes.forEach(route => {
  if (processFile(route)) {
    processedCount++;
  }
});

console.log(`\n✓ Processed ${processedCount} routes`);
