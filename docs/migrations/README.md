# Database Migrations

This directory contains SQL migration scripts for the Servio database.

## 📋 Migration Scripts

### Core Features
- `multi-venue-schema.sql` - Multi-venue support
- `menu-design-settings.sql` - Menu design customization
- `menu-hotspots-schema.sql` - Interactive PDF menu hotspots
- `menu-items-position.sql` - Menu item ordering
- `pdf-images-to-menu-uploads.sql` - PDF image storage

### Inventory System
- `inventory-system-schema.sql` - Inventory management tables
- `inventory-auto-deduction.sql` - Auto-deduction triggers

### KDS (Kitchen Display System)
- `kds-system-schema.sql` - KDS tables and functions

### AI Features
- `ai-assistant-schema.sql` - AI assistant tables
- `ai-chat-production-schema.sql` - AI chat production schema

### Staff Management
- `create-invitation-functions.sql` - Staff invitation functions
- `fix-invitation-constraint.sql` - Fix invitation constraints
- `force-drop-invitation-constraint.sql` - Drop old constraints

### Organization
- `fix-organization-insert-policy.sql` - Organization RLS policies

### Venue Settings
- `add-venue-settings-columns.sql` - Additional venue settings
- `add-served-at-column.sql` - Served at timestamp

## 🚀 Running Migrations

### Via Supabase Dashboard
1. Go to your Supabase project
2. Navigate to SQL Editor
3. Copy and paste the migration script
4. Run the query

### Via CLI
```bash
# Using Supabase CLI
supabase db push

# Or manually with psql
psql -h your-host -U postgres -d postgres -f migration-file.sql
```

## ⚠️ Important Notes

- **Always backup your database before running migrations**
- **Test migrations in a staging environment first**
- **Run migrations in order** (check dependencies)
- **Some migrations may need to be run manually** (check for errors)

## 📝 Migration Status

| Migration | Status | Date | Notes |
|-----------|--------|------|-------|
| multi-venue-schema | ✅ Applied | - | Core schema |
| menu-design-settings | ✅ Applied | - | Design customization |
| menu-hotspots-schema | ✅ Applied | - | Interactive menus |
| menu-items-position | ✅ Applied | Oct 2024 | Item ordering |
| pdf-images-to-menu-uploads | ✅ Applied | Oct 2024 | PDF preview |
| inventory-system-schema | ✅ Applied | - | Inventory management |
| kds-system-schema | ✅ Applied | - | Kitchen display |
| ai-assistant-schema | ✅ Applied | - | AI features |

## 🔄 Rollback Instructions

If you need to rollback a migration:

1. **Check the migration file** for rollback SQL (if provided)
2. **Manually reverse the changes** if no rollback is provided
3. **Update the status table** above

## 📚 Related Documentation

- [Database Schema](./schema.md) - Complete database schema
- [API Documentation](../api.md) - API endpoints
- [Deployment Guide](../deployment.md) - Deployment instructions

