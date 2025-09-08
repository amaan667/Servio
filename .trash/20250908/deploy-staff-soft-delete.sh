#!/bin/bash

# Deploy staff soft deletion and forever count fixes
echo "Deploying staff soft deletion and forever count fixes..."

# Apply the staff schema updates
echo "Applying staff schema updates..."
psql $DATABASE_URL -f scripts/update-staff-schema-soft-delete.sql

# Apply the staff counts function
echo "Applying staff counts function..."
psql $DATABASE_URL -f scripts/create-staff-counts-function.sql

echo "Staff soft deletion and forever count fixes deployed successfully!"
echo ""
echo "Changes made:"
echo "1. Added deleted_at column to staff table for soft deletion"
echo "2. Updated staff_counts RPC function to count all staff ever added (forever count)"
echo "3. Updated deletion logic to use soft deletion instead of hard deletion"
echo "4. Updated staff queries to filter out deleted staff"
echo ""
echo "The 'Total Staff' count will now show all staff ever added, even if they were removed."
echo "The 'Active Staff' count will show only currently active, non-deleted staff."
