#!/bin/bash
# Batch fix routes to use withUnifiedAuth
# This script identifies routes that need fixing

echo "Finding routes that need migration..."
find app/api -name "route.ts" -exec grep -l "requireVenueAccessForAPI\|requireAuthForAPI" {} \; | sort

echo ""
echo "Routes already using withUnifiedAuth:"
find app/api -name "route.ts" -exec grep -l "withUnifiedAuth" {} \; | wc -l

echo ""
echo "Routes still using deprecated auth:"
find app/api -name "route.ts" -exec grep -l "requireVenueAccessForAPI\|requireAuthForAPI" {} \; | wc -l

