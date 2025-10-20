#!/usr/bin/env node
/**
 * Fix all logger calls to use proper context format
 */

const fs = require('fs');
const path = require('path');

const files = [
  'hooks/use-staff-counts.ts',
  'hooks/use-tab-counts.ts',
  'hooks/useCounterOrders.ts',
  'hooks/useCsvDownload.ts',
  'hooks/useDailyReset.ts',
  'hooks/useEnhancedTableMerge.ts',
  'hooks/useGestures.ts',
  'hooks/useGroupSessions.ts',
  'hooks/useInventoryAlerts.ts',
  'hooks/useLiveOrders.ts',
  'hooks/usePerformanceMonitor.ts',
  'hooks/useTableActions.ts',
  'hooks/useTableManagement.ts',
  'hooks/useTableOrders.ts',
  'lib/ai/assistant-llm.ts',
  'lib/ai/context-builders.ts',
  'lib/ai/executors/translation-executor.ts',
  'lib/ai/openai-service.ts',
  'lib/auth/client.ts',
  'lib/auth/server.ts',
  'lib/auth/signin.ts',
  'lib/cache/index.ts',
  'lib/connection-monitor.ts',
  'lib/email.ts',
  'lib/feature-gates.ts',
  'lib/google-maps.ts',
  'lib/gptVisionMenuParser.ts',
  'lib/improvedMenuParser.ts',
  'lib/inventory-seed.ts',
  'lib/monitoring/performance.ts',
  'lib/parseMenuFC.ts',
  'lib/parseWithOpenAI.ts',
  'lib/pdf-to-images.ts',
  'lib/pdfImporter/googleVisionOCR.ts',
  'lib/pdfImporter/pdfDetection.ts',
  'lib/queue.ts',
  'lib/session.ts',
  'lib/table-cleanup.ts',
  'lib/code-splitting.tsx',
];

files.forEach(filePath => {
  const fullPath = path.join(__dirname, '..', filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`Skipping ${filePath} (not found)`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;
  
  // Add import if not present
  if (!content.includes('errorToContext')) {
    content = `import { errorToContext } from '@/lib/utils/error-to-context';\n${content}`;
    modified = true;
  }
  
  // Fix logger.error/warn/debug calls with unknown/string/any parameters
  const patterns = [
    // logger.error('msg', error) -> logger.error('msg', errorToContext(error))
    [/(logger\.error\('([^']+)',\s*)(err|error|e)\)/g, '$1errorToContext($3))'],
    [/(logger\.error\(`([^`]+)`,\s*)(err|error|e)\)/g, '$1errorToContext($3))'],
    [/(logger\.warn\('([^']+)',\s*)(err|error|e)\)/g, '$1errorToContext($3))'],
    [/(logger\.warn\(`([^`]+)`,\s*)(err|error|e)\)/g, '$1errorToContext($3))'],
    [/(logger\.debug\('([^']+)',\s*)(err|error|e)\)/g, '$1errorToContext($3))'],
    [/(logger\.debug\(`([^`]+)`,\s*)(err|error|e)\)/g, '$1errorToContext($3))'],
  ];
  
  patterns.forEach(([pattern, replacement]) => {
    if (content.match(pattern)) {
      content = content.replace(pattern, replacement);
      modified = true;
    }
  });
  
  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ Fixed ${filePath}`);
  }
});

console.log('\n✅ All logger calls fixed!');

