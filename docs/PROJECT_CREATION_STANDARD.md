# Project Creation Standard

## Single Source of Truth

**All project creation MUST use:**
- `server/project-table-provisioner.ts` → `provisionProjectTables()`
- `server/db-project-schema.sql` → Canonical schema definition

## Project Creation Flow

1. **Create project record** in main database (`projects` table)
2. **Call `provisionProjectTables()`** with project ID
3. Provisioner reads `db-project-schema.sql` and creates all tables with prefix `proj_{projectId}_`

## DO NOT USE

- ❌ `server/table-prefix-helper.ts` - **DEPRECATED** - Creates tables with different schema
- ❌ Direct SQL table creation - Always use the provisioner

## External Tools

If you're creating projects from external tools (Python scripts, other services):

1. **Option A (Recommended):** Call the `projects.create` tRPC endpoint
2. **Option B:** Import and call `provisionProjectTables()` from Node.js
3. **Option C:** Execute `db-project-schema.sql` manually with correct table prefix

## Schema Differences Found

Projects 390002, 390005, 390006 were created with incorrect schema:
- Missing `stage` column in `processing_jobs` table
- Missing default value for `uploadDate` column in `documents` table
- Using `job_type` instead of `stage`

These have been fixed with ALTER TABLE statements, but future projects must use the standard provisioner.

## Verification

To check if a project was created correctly:

```sql
-- Check processing_jobs has 'stage' column
SELECT COLUMN_NAME 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'proj_{projectId}_processing_jobs' 
AND COLUMN_NAME = 'stage';

-- Check documents has uploadDate default
SELECT COLUMN_DEFAULT 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'proj_{projectId}_documents' 
AND COLUMN_NAME = 'uploadDate';
```

## Migration for Existing Projects

If you find projects with schema mismatches:

1. Add missing columns with ALTER TABLE
2. Update default values
3. Document the fix in this file

See `docs/CONSOLIDATION_FIXES_2026-02-04.md` for examples of schema fixes applied.
