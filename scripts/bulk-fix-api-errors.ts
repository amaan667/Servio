#!/usr/bin/env tsx
/**
 * Bulk fix API route error handling
 * Intelligently fixes error.message patterns with proper type guards
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';

interface FixResult {
  file: string;
  fixed: boolean;
  changes: number;
  errors: string[];
}

function fixErrorHandling(content: string): { fixed: string; changes: number } {
  let fixed = content;
  let changes = 0;

  // Pattern 1: Fix error.message in catch blocks
  // Find: } catch (error: unknown) { ... error.message ... }
  // Replace with: const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  
  const catchBlockRegex = /catch\s*\(\s*error\s*:\s*unknown\s*\)\s*\{([^}]*)\}/gs;
  
  fixed = fixed.replace(catchBlockRegex, (match, body) => {
    // Check if body has error.message without type guard
    if (body.includes('error.message') && !body.includes('error instanceof Error')) {
      // Add type guard at the beginning
      const newBody = body.replace(
        /(\s+)(logger\.error\([^)]*\{[^}]*error:\s*)(error instanceof Error \? error\.message : 'Unknown error')([^}]*\}\);)/g,
        (_, indent, prefix, _, suffix) => {
          changes++;
          return `${indent}const errorMessage = error instanceof Error ? error.message : 'Unknown error';\n${indent}${prefix}error: errorMessage${suffix}`;
        }
      );
      
      // Replace error.message with errorMessage
      const finalBody = newBody.replace(/error\.message/g, (match, offset) => {
        // Don't replace if it's part of the type guard we just added
        if (newBody.substring(Math.max(0, offset - 100), offset).includes('errorMessage')) {
          return match;
        }
        changes++;
        return 'errorMessage';
      });
      
      return `catch (error: unknown) {${finalBody}}`;
    }
    
    return match;
  });

  // Pattern 2: Fix error.code, error.details, error.hint
  fixed = fixed.replace(/catch\s*\(\s*error\s*:\s*unknown\s*\)\s*\{/g, (match) => {
    if (!fixed.includes('const errorObj = error')) {
      changes++;
      return match + '\n    const errorObj = error && typeof error === \'object\' ? error as Record<string, unknown> : {};';
    }
    return match;
  });

  // Replace error.code, error.details, error.hint with errorObj variants
  fixed = fixed.replace(/error\.(code|details|hint)/g, (match) => {
    changes++;
    return match.replace('error.', 'errorObj.');
  });

  // Pattern 3: Fix ZodError handling
  fixed = fixed.replace(
    /if\s*\(\s*error\.name\s*===\s*"ZodError"\s*\)/g,
    (match) => {
      changes++;
      return 'if (error && typeof error === \'object\' && \'name\' in error && error.name === "ZodError")';
    }
  );

  fixed = fixed.replace(
    /const\s+zodError\s*=\s*error\s+as\s+\{\s*errors:\s*unknown\s*\};/g,
    (match) => {
      changes++;
      return 'const zodError = error as unknown as { errors: unknown };';
    }
  );

  return { fixed, changes };
}

async function main() {
  

  const results: FixResult[] = [];

  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf-8');
      const { fixed, changes } = fixErrorHandling(content);

      if (changes > 0) {
        writeFileSync(file, fixed, 'utf-8');
        results.push({
          file,
          fixed: true,
          changes,
          errors: [],
        });
      }
    } catch (error) {
      results.push({
        file,
        fixed: false,
        changes: 0,
        errors: [error instanceof Error ? error.message : String(error)],
      });
      console.error(`❌ Error fixing ${file}:`, error);
    }
  }

  const fixedCount = results.filter(r => r.fixed).length;
  const totalChanges = results.reduce((sum, r) => sum + r.changes, 0);

  
}

main().catch(console.error);

