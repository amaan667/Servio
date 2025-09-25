# Database Migrations

This directory contains idempotent database migration scripts for the Servio application.

## Migration Files

- `add-source-column-to-orders.sql` - Adds source column to orders table
- `add-unique-constraints.sql` - Adds unique constraints for data integrity
- `add-venue-reset-config.sql` - Adds venue reset configuration
- `create-api-reserve-table-function.sql` - Creates API function for table reservations
- `create-daily-reset-log-table.sql` - Creates daily reset logging table
- `create-dashboard-counts-function.sql` - Creates dashboard counting functions
- `create-merge-tables-function.sql` - Creates table merging functions
- `create-orders-for-all-tabs.sql` - Creates orders for all tabs functionality
- `create-table-group-sessions-complete.sql` - Creates complete table group sessions
- `delete-yesterday-tables.sql` - Deletes yesterday's table data
- `pos-system-schema.sql` - POS system schema definition
- `remove-tables-template.sql` - Template for removing tables
- `remove-tables.sql` - Removes tables functionality
- `reset-all-tables-new-day.sql` - Resets all tables for new day
- `reset-tables-new-day.sql` - Resets tables for new day
- `update-orders-payment-status.sql` - Updates order payment status
- `update-payment-status-pay-later.sql` - Updates payment status for pay later
- `update-table-runtime-state-view.sql` - Updates table runtime state view

## Usage

These migrations are idempotent and can be run multiple times safely. They should be executed in order when setting up a new database instance.

## Note

Ad-hoc debug and fix SQL scripts have been moved to `/docs/archive/sql/` for historical reference.
