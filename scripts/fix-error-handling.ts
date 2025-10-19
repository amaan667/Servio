#!/usr/bin/env tsx
/**
 * Bulk fix script for error handling
 * Converts unsafe 'unknown' error patterns to type-safe patterns
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const filesToFix = [
  'app/api/ai-assistant/activity/route.ts',
  'app/api/ai-assistant/conversations/[conversationId]/messages/route.ts',
  'app/api/ai-assistant/conversations/[conversationId]/route.ts',
  'app/api/ai-assistant/conversations/route.ts',
  'app/api/ai-assistant/execute/route.ts',
  'app/api/ai-assistant/fix-access/route.ts',
  'app/api/ai-assistant/migrate/route.ts',
  'app/api/ai-assistant/plan/route.ts',
  'app/api/ai-assistant/undo/route.ts',
  'app/api/ai/conversations/route.ts',
  'app/api/ai/messages/route.ts',
  'app/api/auth/health/route.ts',
  'app/admin/migrate-ai/page.tsx',
];

function fixErrorHandling(content: string): string {
  // Pattern 1: catch (error) { logger.error('msg', { error: error.message }) }
  // Fix: Add type guard
  content = content.replace(
    /catch\s*\(\s*error\s*\)\s*\{[\s\S]*?logger\.error\([^)]*\{[\s\S]*?error:\s*error\.message[\s\S]*?\}/g,
    (match) => {
      if (!match.includes('error instanceof Error')) {
        return match.replace(
          /catch\s*\(\s*error\s*\)\s*\{/,
          'catch (error: unknown) {\n    const err = error instanceof Error ? error : new Error(String(error));'
        );
      }
      return match;
    }
  );

  // Pattern 2: catch (error) { return NextResponse.json({ error: error.message }) }
  content = content.replace(
    /catch\s*\(\s*error\s*\)\s*\{[\s\S]*?NextResponse\.json\([\s\S]*?error:\s*error\.message/g,
    (match) => {
      if (!match.includes('error instanceof Error')) {
        return match.replace(
          /catch\s*\(\s*error\s*\)\s*\{/,
          'catch (error: unknown) {\n    const err = error instanceof Error ? error : new Error(String(error));'
        ).replace(/error\.message/g, 'err.message');
      }
      return match;
    }
  );

  // Pattern 3: error.code, error.details, error.name
  content = content.replace(
    /catch\s*\(\s*error\s*\)\s*\{[\s\S]*?error\.(code|details|name)/g,
    (match) => {
      if (!match.includes('error instanceof Error')) {
        return match.replace(
          /catch\s*\(\s*error\s*\)\s*\{/,
          'catch (error: unknown) {\n    const err = error as any;'
        ).replace(/error\.(code|details|name)/g, 'err.$1');
      }
      return match;
    }
  );

  return content;
}

function main() {

  for (const file of filesToFix) {
    const filePath = join(process.cwd(), file);
    try {
      const content = readFileSync(filePath, 'utf-8');
      const fixed = fixErrorHandling(content);
      
      if (content !== fixed) {
        writeFileSync(filePath, fixed, 'utf-8');
      } else {
      }
    } catch (error) {
      console.error(`❌ Error fixing ${file}:`, error);
    }
  }

}

main();

