#!/usr/bin/env python3
"""Fix all .lte(.*)); patterns"""

from pathlib import Path
import re

print("🔧 Fixing All .lte Patterns\n")

path = Path('lib/analytics/business-metrics.ts')
lines = path.read_text().split('\n')
modified = False

for i, line in enumerate(lines):
    if '.lte(.*));' in line:
        # Find the context by looking back
        prev_line = lines[i-1] if i > 0 else ''
        if 'gte' in prev_line:
            # It's likely a dateRange pattern
            lines[i] = line.replace('.lte(.*));', '.lte("created_at", dateRange.end.toISOString());')
            modified = True

if modified:
    path.write_text('\n'.join(lines))
    print(f"✅ Fixed {path.name}")

print("\n✅ Fixed all .lte patterns")
