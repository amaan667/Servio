#!/usr/bin/env node
/**
 * Fix all remaining logger calls with string/unknown parameters
 */

const fs = require('fs');
const path = require('path');

const files = [
  'app/api/dashboard/orders/[id]/route.ts',
  'app/api/dashboard/orders/route.ts',
  'app/api/debug-email/route.ts',
  'app/api/debug/orders/route.ts',
  'app/api/debug/subscription-status/route.ts',
  'app/api/feedback-responses/route.ts',
  'app/api/feedback/questions/public/route.ts',
  'app/api/feedback/questions/route.ts',
  'app/api/kds/backfill-all/route.ts',
  'app/api/kds/backfill/route.ts',
  'app/api/kds/tickets/route.ts',
  'app/api/live-orders/route.ts',
  'app/api/log-demo-access/route.ts',
  'app/api/log-order-access/route.ts',
  'app/api/menu/[venueId]/route.ts',
  'app/api/menu/categories/route.ts',
  'app/api/menu/delete-category/route.ts',
  'app/api/menu/process/route.ts',
  'app/api/migrate-ai-conversations/route.ts',
  'app/api/migrate-chat/route.ts',
  'app/api/migrations/kds-trigger/route.ts',
  'app/api/migrations/kds/route.ts',
  'app/api/orders/[orderId]/route.ts',
  'app/api/orders/bulk-complete/route.ts',
  'app/api/orders/by-session/[sessionId]/route.ts',
  'app/api/orders/by-session/route.ts',
  'app/api/orders/createFromPaidIntent/route.ts',
  'app/api/orders/mark-paid/route.ts',
  'app/api/orders/route.example.ts',
  'app/api/orders/route.ts',
  'app/api/orders/set-status/route.ts',
  'app/api/orders/update-status/route.ts',
  'app/api/orders/verify/route.ts',
  'app/api/organization/ensure/route.ts',
  'app/api/pay/demo/route.ts',
  'app/api/pay/later/route.ts',
  'app/api/pay/stripe/route.ts',
  'app/api/pay/till/route.ts',
  'app/api/pos/orders/route.ts',
  'app/api/setup-kds/route.ts',
  'app/api/stripe/create-checkout-session/route.ts',
  'app/api/stripe/create-portal-session/route.ts',
  'app/api/stripe/downgrade-plan/route.ts',
  'app/api/stripe/webhook/route.ts',
  'app/api/stripe/webhooks/route.ts',
  'app/api/subscription/refresh-status/route.ts',
  'app/api/table-sessions/handlers/table-action-handlers.ts',
  'app/api/tables/[tableId]/route.ts',
  'app/api/tables/route.ts',
  'app/api/test-ai-chat/route.ts',
  'app/api/test-db/route.ts',
  'app/api/test/subscription-update/route.ts',
  'app/api/test/update-plan/route.ts',
];

let totalFixed = 0;

files.forEach(filePath => {
  const fullPath = path.join(__dirname, '..', filePath);
  
  if (!fs.existsSync(fullPath)) {
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;
  
  // Add import if not present
  if (!content.includes('errorToContext')) {
    content = `import { errorToContext } from '@/lib/utils/error-to-context';\n${content}`;
    modified = true;
  }
  
  // Fix logger calls with string parameters
  const patterns = [
    // logger.error('msg', stringVar) -> logger.error('msg', { value: stringVar })
    [/(logger\.(error|warn|debug|info)\('([^']+)',\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\)/g, (match, p1, p2, p3, p4) => {
      return `${p1}{ value: ${p4} })`;
    }],
    // logger.error('msg', null) -> logger.error('msg', { value: null })
    [/(logger\.(error|warn|debug|info)\('([^']+)',\s*)null\)/g, '$1{ value: null })'],
    // logger.error('msg', undefined) -> logger.error('msg', { value: undefined })
    [/(logger\.(error|warn|debug|info)\('([^']+)',\s*)undefined\)/g, '$1{ value: undefined })'],
    // logger.error('msg', boolean) -> logger.error('msg', { value: boolean })
    [/(logger\.(error|warn|debug|info)\('([^']+)',\s*)(true|false)\)/g, '$1{ value: $4 })'],
  ];
  
  patterns.forEach(([pattern, replacement]) => {
    if (typeof replacement === 'function') {
      if (content.match(pattern)) {
        content = content.replace(pattern, replacement);
        modified = true;
      }
    } else {
      if (content.match(pattern)) {
        content = content.replace(pattern, replacement);
        modified = true;
      }
    }
  });
  
  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ Fixed ${filePath}`);
    totalFixed++;
  }
});

console.log(`\n✅ Fixed ${totalFixed} files!`);

