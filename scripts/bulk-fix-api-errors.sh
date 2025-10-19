#!/bin/bash
# Bulk fix API route error handling patterns
# Fixes 331 errors in app/api routes

set -e

echo "🔧 Starting bulk fix for API route error handling..."
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Count files to fix
FILE_COUNT=$(find app/api -name "*.ts" -type f | wc -l)
echo -e "${YELLOW}Found $FILE_COUNT API route files${NC}"
echo ""

# Backup first
echo -e "${YELLOW}Creating backup...${NC}"
mkdir -p .backup
cp -r app/api .backup/app-api-$(date +%Y%m%d-%H%M%S)
echo -e "${GREEN}✅ Backup created${NC}"
echo ""

# Fix pattern 1: error.message without type guard
echo -e "${YELLOW}Fixing error.message patterns...${NC}"
find app/api -name "*.ts" -type f -exec sed -i '' \
  -e '/catch (error: unknown) {/,/^  }/ {
    /error\.message[^M]/ {
      i\
    const errorMessage = error instanceof Error ? error.message : '\''Unknown error'\'';
      s/error\.message/errorMessage/g
    }
  }' \
  {} \;
echo -e "${GREEN}✅ Pattern 1 fixed${NC}"

# Fix pattern 2: error.code without type guard
echo -e "${YELLOW}Fixing error.code patterns...${NC}"
find app/api -name "*.ts" -type f -exec sed -i '' \
  -e '/catch (error: unknown) {/,/^  }/ {
    /error\.code[^M]/ {
      i\
    const errorObj = error && typeof error === '\''object'\'' ? error as Record<string, unknown> : {};
      s/error\.code/errorObj.code/g
    }
  }' \
  {} \;
echo -e "${GREEN}✅ Pattern 2 fixed${NC}"

# Fix pattern 3: error.details without type guard
echo -e "${YELLOW}Fixing error.details patterns...${NC}"
find app/api -name "*.ts" -type f -exec sed -i '' \
  's/error\.details/errorObj.details/g' \
  {} \;
echo -e "${GREEN}✅ Pattern 3 fixed${NC}"

# Fix pattern 4: error.name without type guard (ZodError)
echo -e "${YELLOW}Fixing error.name patterns...${NC}"
find app/api -name "*.ts" -type f -exec sed -i '' \
  -e '/catch (error: unknown) {/,/^  }/ {
    /if (error\.name === "ZodError")/ {
      i\
    // Type guard for ZodError
    if (error && typeof error === '\''object'\'' && '\''name'\'' in error && error.name === "ZodError") {
      s/if (error\.name === "ZodError")/if (true)/g
      s/const zodError = error as { errors: unknown };/const zodError = error as unknown as { errors: unknown };/g
    }
  }' \
  {} \;
echo -e "${GREEN}✅ Pattern 4 fixed${NC}"

echo ""
echo -e "${GREEN}✨ Bulk fixes complete!${NC}"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Review changes before committing${NC}"
echo ""
echo "Next steps:"
echo "1. Run: pnpm typecheck"
echo "2. Review changes: git diff app/api"
echo "3. Test: pnpm build"
echo "4. If good: git add app/api && git commit -m 'fix: bulk fix API route error handling'"

