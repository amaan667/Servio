#!/bin/bash
# Fix logger type errors by adding errorToContext helper

echo "Fixing logger type errors..."

# Add import to files that need it
files=(
  "hooks/use-staff-counts.ts"
  "hooks/use-tab-counts.ts"
  "hooks/useCounterOrders.ts"
  "hooks/useCsvDownload.ts"
  "hooks/useDailyReset.ts"
  "hooks/useEnhancedTableMerge.ts"
  "hooks/useGestures.ts"
  "hooks/useGroupSessions.ts"
  "hooks/useInventoryAlerts.ts"
  "hooks/useLiveOrders.ts"
  "hooks/usePerformanceMonitor.ts"
  "hooks/useTableActions.ts"
  "hooks/useTableManagement.ts"
  "hooks/useTableOrders.ts"
  "lib/ai/assistant-llm.ts"
  "lib/ai/context-builders.ts"
  "lib/ai/executors/translation-executor.ts"
  "lib/ai/openai-service.ts"
  "lib/auth/client.ts"
  "lib/auth/server.ts"
  "lib/auth/signin.ts"
  "lib/cache/index.ts"
  "lib/connection-monitor.ts"
  "lib/email.ts"
  "lib/feature-gates.ts"
  "lib/google-maps.ts"
  "lib/gptVisionMenuParser.ts"
  "lib/improvedMenuParser.ts"
  "lib/inventory-seed.ts"
  "lib/monitoring/performance.ts"
  "lib/parseMenuFC.ts"
  "lib/parseWithOpenAI.ts"
  "lib/pdf-to-images.ts"
  "lib/pdfImporter/googleVisionOCR.ts"
  "lib/pdfImporter/pdfDetection.ts"
  "lib/queue.ts"
  "lib/session.ts"
  "lib/table-cleanup.ts"
  "lib/code-splitting.tsx"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "Processing $file..."
    # Add import if not present
    if ! grep -q "errorToContext" "$file"; then
      sed -i '' "1i\\
import { errorToContext } from '@/lib/utils/error-to-context';\\
" "$file"
    fi
  fi
done

echo "Done! Now manually replace logger.error/warn calls with errorToContext wrapper"

