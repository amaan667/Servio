#!/usr/bin/env node

/**
 * Batch fix specific files with known patterns
 */

import fs from 'fs';

const fixes = [
  // API Routes - Remove unused imports
  {
    file: 'app/api/cart/store/route.ts',
    changes: [
      { from: /import.*getSupabaseClient.*\n/, to: '' }
    ]
  },
  {
    file: 'app/api/orders/verify/route.ts',
    changes: [
      { from: /import Stripe.*\n/, to: '' }
    ]
  },
  {
    file: 'app/api/reviews/list/route.ts',
    changes: [
      { from: /import.*\bz\b.*\n/, to: '' }
    ]
  },
  {
    file: 'app/api/payments/create-intent/route.ts',
    changes: [
      { from: /import.*\bENV\b.*\n/, to: '' }
    ]
  },
  {
    file: 'app/api/orders/createFromPaidIntent/route.ts',
    changes: [
      { from: /import.*\bENV\b.*\n/, to: '' }
    ]
  },
  {
    file: 'app/api/signup/with-subscription/route.ts',
    changes: [
      { from: /import Stripe.*\n/, to: '' }
    ]
  },
  {
    file: 'app/dashboard/[venueId]/live-orders/hooks/useBulkOperations.ts',
    changes: [
      { from: /import.*createClient.*supabase.*\n/, to: '' }
    ]
  },
  {
    file: 'app/dashboard/[venueId]/menu-management/hooks/useDragAndDrop.ts',
    changes: [
      { from: /import.*useState.*\n/, to: '' }
    ]
  },
  {
    file: 'hooks/use-tab-counts.ts',
    changes: [
      { from: /,\s*useMemo/, to: '' }
    ]
  },
  {
    file: 'hooks/useCsvDownload.ts',
    changes: [
      { from: /import.*errorToContext.*\n/, to: '' }
    ]
  },
  {
    file: 'lib/ai/openai-service.ts',
    changes: [
      { from: /import.*\bMessage\b.*\n/, to: '' }
    ]
  },
  {
    file: 'lib/inventory-seed.ts',
    changes: [
      { from: /import.*CreateIngredientRequest.*\n/, to: '' }
    ]
  },
  {
    file: 'app/complete-profile/form.tsx',
    changes: [
      { from: /import.*\blogger\b.*\n/, to: '' }
    ]
  },
  {
    file: 'components/analytics/AdvancedAnalytics.tsx',
    changes: [
      { from: /, Button/, to: '' }
    ]
  },
  {
    file: 'components/customer-feedback-form.tsx',
    changes: [
      { from: /, Badge/, to: '' }
    ]
  },
  {
    file: 'components/enhanced-error-boundary.tsx',
    changes: [
      { from: /, Wifi/, to: '' }
    ]
  },
  {
    file: 'components/venue-switcher.tsx',
    changes: [
      { from: /import.*\bButton\b.*\n/, to: '' }
    ]
  },
];

let fixed = 0;

for (const { file, changes } of fixes) {
  try {
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;
    
    for (const { from, to } of changes) {
      if (content.match(from)) {
        content = content.replace(from, to);
        modified = true;
      }
    }
    
    if (modified) {
      fs.writeFileSync(file, content, 'utf8');
      console.log(`✅ ${file}`);
      fixed++;
    }
  } catch (err) {
    console.error(`❌ Error fixing ${file}:`, err.message);
  }
}

console.log(`\n✅ Fixed ${fixed} files with unused imports`);

