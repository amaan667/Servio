#!/usr/bin/env python3
"""Fix missing logger imports"""

import subprocess
import re
from pathlib import Path

print("🔧 Fixing Missing Logger Imports\n")

# Files that need logger import
files_needing_logger = [
    'app/api/analytics/vitals/route.ts',
    'components/GlobalBottomNav.tsx'
]

for file_path in files_needing_logger:
    try:
        path = Path(file_path)
        if not path.exists():
            continue
        
        content = path.read_text()
        
        # Check if logger is already imported
        if 'import.*logger' in content or 'from.*logger' in content:
            continue
        
        # Add logger import after other imports
        lines = content.split('\n')
        import_idx = -1
        
        for i, line in enumerate(lines):
            if line.startswith('import'):
                import_idx = i
        
        if import_idx >= 0:
            lines.insert(import_idx + 1, 'import { logger } from "@/lib/logger";')
            path.write_text('\n'.join(lines))
            print(f"✅ {path.name}")
    except:
        pass

print("\n✅ Fixed logger imports")
