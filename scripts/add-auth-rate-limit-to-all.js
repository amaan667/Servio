const fs = require('fs');
const path = require('path');

const apiRoutesDir = path.join(__dirname, '../app/api');

// Routes that should NOT have auth/rate limiting
const excludeRoutes = [
  'auth/callback/route.ts',
  'auth/sign-in/route.ts',
  'auth/sign-up/route.ts',
  'auth/forgot-password/route.ts',
  'auth/reset-password/route.ts',
  'auth/verify-otp/route.ts',
  'auth/sync-session/route.ts',
  'stripe/webhook/route.ts',
  'health/route.ts',
  'admin/cleanup-incomplete-accounts/route.ts',
  'admin/force-sync-subscription/route.ts',
  'admin/reset-tables/route.ts',
  'admin/update-tier-to-enterprise/route.ts',
];

function shouldExclude(filePath) {
  return excludeRoutes.some(excluded => filePath.includes(excluded));
}

function hasAuth(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return content.includes('requireAuthForAPI') || content.includes('requireVenueAccessForAPI');
}

function hasRateLimit(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return content.includes('rateLimit') || content.includes('RATE_LIMITS');
}

function addAuthAndRateLimit(filePath) {
  if (shouldExclude(filePath)) {
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Skip if already has both
  if (hasAuth(filePath) && hasRateLimit(filePath)) {
    return false;
  }

  // Add imports if needed
  if (!hasAuth(filePath)) {
    // Check if it's a GET route (might need venue access) or POST/PUT/PATCH/DELETE
    const isGet = content.includes('export async function GET');
    const isPost = content.includes('export async function POST');
    const isPut = content.includes('export async function PUT');
    const isPatch = content.includes('export async function PATCH');
    const isDelete = content.includes('export async function DELETE');

    if (isGet || isPost || isPut || isPatch || isDelete) {
      // Add import
      if (!content.includes("requireVenueAccessForAPI") && !content.includes("requireAuthForAPI")) {
        const importLine = "import { requireAuthForAPI, requireVenueAccessForAPI } from '@/lib/auth/api';";
        // Insert after last import
        const lastImportIndex = content.lastIndexOf('import');
        if (lastImportIndex !== -1) {
          const nextNewline = content.indexOf('\n', lastImportIndex);
          content = content.slice(0, nextNewline + 1) + importLine + '\n' + content.slice(nextNewline + 1);
          modified = true;
        }
      }
    }
  }

  if (!hasRateLimit(filePath)) {
    if (!content.includes("rateLimit") && !content.includes("RATE_LIMITS")) {
      const importLine = "import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';";
      const lastImportIndex = content.lastIndexOf('import');
      if (lastImportIndex !== -1) {
        const nextNewline = content.indexOf('\n', lastImportIndex);
        content = content.slice(0, nextNewline + 1) + importLine + '\n' + content.slice(nextNewline + 1);
        modified = true;
      }
    }
  }

  // Add auth and rate limit checks to handler functions
  const handlerPattern = /export async function (GET|POST|PUT|PATCH|DELETE)\s*\(([^)]+)\)\s*\{/g;
  let match;
  const handlers = [];
  
  while ((match = handlerPattern.exec(content)) !== null) {
    handlers.push({
      method: match[1],
      params: match[2],
      index: match.index,
      fullMatch: match[0]
    });
  }

  // Process handlers in reverse order to maintain indices
  for (let i = handlers.length - 1; i >= 0; i--) {
    const handler = handlers[i];
    const startIndex = handler.index + handler.fullMatch.length;
    
    // Find the opening brace and add auth/rate limit after it
    let braceCount = 1;
    let currentIndex = startIndex;
    let foundTry = false;
    
    // Check if there's already a try block
    const nextChars = content.slice(startIndex, startIndex + 50);
    if (nextChars.includes('try {')) {
      foundTry = true;
    }

    if (!foundTry && !hasAuth(filePath)) {
      // Add try block with auth and rate limit
      const authBlock = `
  try {
    // CRITICAL: Authentication check
    const authResult = await requireAuthForAPI();
    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: authResult.error || 'Authentication required' },
        { status: 401 }
      );
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
`;
      content = content.slice(0, startIndex) + authBlock + content.slice(startIndex);
      modified = true;
    } else if (foundTry && !hasAuth(filePath)) {
      // Insert auth/rate limit after try {
      const tryIndex = content.indexOf('try {', startIndex);
      const afterTry = tryIndex + 5;
      const authBlock = `
    // CRITICAL: Authentication check
    const authResult = await requireAuthForAPI();
    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: authResult.error || 'Authentication required' },
        { status: 401 }
      );
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
`;
      content = content.slice(0, afterTry) + authBlock + content.slice(afterTry);
      modified = true;
    }
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
      if (addAuthAndRateLimit(fullPath)) {
        console.log(`✓ Updated: ${fullPath}`);
        fixedCount++;
      }
    }
  }

  return fixedCount;
}

console.log('Adding authentication and rate limiting to all routes...');
const fixed = processDirectory(apiRoutesDir);
console.log(`\n✓ Updated ${fixed} files`);

