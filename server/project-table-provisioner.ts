/**
 * Project Table Provisioner
 *
 * Creates prefixed tables in the main database instead of separate databases.
 * Uses the shared connection pool from db.ts to avoid cold SSL connection overhead.
 * Caches provisioned project IDs in-memory so subsequent calls are instant.
 */

import fs from 'fs';
import path from 'path';

interface ProjectTableConfig {
  projectId: number;
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbPassword: string;
  database: string;
}

/** In-memory cache of project IDs whose tables have been confirmed to exist */
const provisionedProjects = new Set<number>();

/**
 * Get table prefix for a project
 */
export function getTablePrefix(projectId: number): string {
  return `proj_${projectId}_`;
}

/**
 * Get full table name with prefix
 */
export function getTableName(projectId: number, tableName: string): string {
  return `${getTablePrefix(projectId)}${tableName}`;
}

/**
 * Provision tables for a project using the shared connection pool.
 * Safe to call repeatedly — skips immediately if already provisioned this session,
 * and uses IF NOT EXISTS so it's idempotent even across restarts.
 */
export async function provisionProjectTables(config: ProjectTableConfig): Promise<boolean> {
  // Fast path: already provisioned in this process lifetime
  if (provisionedProjects.has(config.projectId)) {
    return true;
  }

  // Use the shared pool from db.ts to avoid cold SSL connection overhead
  const { getPool } = await import('./db');
  const pool = await getPool();

  console.log(`[ProjectTables] Provisioning tables for project ${config.projectId}`);

  // Read the schema SQL
  const schemaPath = path.join(process.cwd(), 'server', 'db-project-schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

  // Transform schema: add table prefixes and update foreign key references
  const prefix = getTablePrefix(config.projectId);
  const transformedSql = transformSchemaWithPrefix(schemaSql, prefix);

  // Split and execute statements
  const parts = transformedSql.split(';');

  const statements = parts
    .map(part => {
      const lines = part.split('\n');
      const sqlLines = lines.filter(line => {
        const trimmed = line.trim();
        return trimmed.length > 0 && !trimmed.startsWith('--');
      });
      return sqlLines.join('\n').trim();
    })
    .filter(stmt => stmt.length > 0 && stmt.toUpperCase().includes('CREATE TABLE'));

  console.log(`[ProjectTables] Executing ${statements.length} CREATE TABLE statements`);

  for (const statement of statements) {
    try {
      await pool.execute(statement);
      const match = statement.match(/CREATE TABLE (?:IF NOT EXISTS )?`?(\w+)`?/i);
      if (match) {
        console.log(`[ProjectTables] ✓ Created/verified table: ${match[1]}`);
      }
    } catch (error: any) {
      // Ignore "table already exists" errors (ER_TABLE_EXISTS_ERROR)
      if (error.code !== 'ER_TABLE_EXISTS_ERROR') {
        console.error(`[ProjectTables] ✗ Error:`, error);
        console.error(`[ProjectTables] Failed statement: ${statement.substring(0, 100)}...`);
        throw error;
      }
    }
  }

  // Run schema migrations for existing tables (adds missing columns, renames, etc.)
  await migrateProjectTables(pool, prefix, config.projectId);

  // Mark as provisioned so future calls skip immediately
  provisionedProjects.add(config.projectId);
  console.log(`[ProjectTables] Successfully provisioned tables for project ${config.projectId}`);
  return true;
}

/**
 * Run incremental schema migrations on existing project tables.
 * Each migration is idempotent — safe to run multiple times.
 */
async function migrateProjectTables(pool: any, prefix: string, projectId: number): Promise<void> {
  const accUploads = `${prefix}acc_uploads`;

  // Migration 1: acc_uploads — rename old columns and add missing ones
  const columnMigrations: Array<{ table: string; check: string; alter: string }> = [
    {
      table: accUploads,
      check: 'acc_folder_path',
      alter: `ALTER TABLE \`${accUploads}\` ADD COLUMN acc_folder_path VARCHAR(500)`,
    },
    {
      table: accUploads,
      check: 'acc_file_name',
      alter: `ALTER TABLE \`${accUploads}\` ADD COLUMN acc_file_name VARCHAR(500)`,
    },
    {
      table: accUploads,
      check: 'acc_web_view_url',
      alter: `ALTER TABLE \`${accUploads}\` ADD COLUMN acc_web_view_url VARCHAR(500)`,
    },
    {
      table: accUploads,
      check: 'uploaded_at',
      alter: `ALTER TABLE \`${accUploads}\` ADD COLUMN uploaded_at TIMESTAMP NULL`,
    },
  ];

  for (const migration of columnMigrations) {
    try {
      // Check if column already exists
      const [cols]: any = await pool.execute(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [migration.table, migration.check]
      );
      if (cols.length === 0) {
        await pool.execute(migration.alter);
        console.log(`[ProjectTables] ✓ Migration: added column ${migration.check} to ${migration.table}`);
      }
    } catch (err: any) {
      console.error(`[ProjectTables] Migration warning for ${migration.check}:`, err.message);
    }
  }
}

/**
 * Delete all tables for a project.
 * Still uses a dedicated connection since DROP TABLE requires care.
 */
export async function deleteProjectTables(config: ProjectTableConfig): Promise<boolean> {
  const { getPool } = await import('./db');
  const pool = await getPool();

  const prefix = getTablePrefix(config.projectId);

  // Get all tables with this prefix
  const [tables]: any = await pool.execute(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name LIKE ?`,
    [`${prefix}%`]
  );

  if (tables.length === 0) {
    console.log(`[ProjectTables] No tables found for project ${config.projectId}`);
    provisionedProjects.delete(config.projectId);
    return true;
  }

  console.log(`[ProjectTables] Deleting ${tables.length} tables for project ${config.projectId}`);

  await pool.execute('SET FOREIGN_KEY_CHECKS = 0');
  for (const row of tables) {
    const tableName = row.table_name || row.TABLE_NAME;
    await pool.execute(`DROP TABLE IF EXISTS \`${tableName}\``);
    console.log(`[ProjectTables] ✓ Dropped table: ${tableName}`);
  }
  await pool.execute('SET FOREIGN_KEY_CHECKS = 1');

  provisionedProjects.delete(config.projectId);
  console.log(`[ProjectTables] Successfully deleted all tables for project ${config.projectId}`);
  return true;
}

/**
 * Transform schema SQL to use table prefixes
 */
function transformSchemaWithPrefix(schemaSql: string, prefix: string): string {
  const tableNames = [
    'processing_jobs',
    'consolidation_jobs',
    'documents',
    'extracted_facts',
    'insight_conflicts',
    'redFlags',
    'section_narratives',
    'performance_parameters',
    'performance_validations',
    'weather_files',
    'weather_monthly_data',
    'financial_data',
    'project_location',
    'acc_credentials',
    'acc_project_mapping',
    'acc_uploads',
    'factVerificationQueue',
    'processingLogs',
    'projectMetadata',
  ];

  let transformed = schemaSql;

  for (const tableName of tableNames) {
    const createPattern = new RegExp(
      `CREATE TABLE (IF NOT EXISTS )?${tableName}\\b`,
      'gi'
    );
    transformed = transformed.replace(
      createPattern,
      `CREATE TABLE IF NOT EXISTS ${prefix}${tableName}`
    );

    const fkPattern = new RegExp(`REFERENCES ${tableName}\\b`, 'gi');
    transformed = transformed.replace(fkPattern, `REFERENCES ${prefix}${tableName}`);
  }

  return transformed;
}

/**
 * Get connection config from DATABASE_URL for table provisioning.
 * The config is kept for backward compatibility but provisionProjectTables
 * no longer uses the raw connection fields — it uses the shared pool.
 */
export function getTableProvisionConfig(projectId: number): ProjectTableConfig {
  const isProduction = process.env.NODE_ENV === 'production';
  const databaseUrl = process.env.DATABASE_URL;

  if (isProduction && databaseUrl) {
    const url = new URL(databaseUrl);
    return {
      projectId,
      dbHost: url.hostname,
      dbPort: parseInt(url.port) || 3306,
      dbUser: url.username,
      dbPassword: url.password,
      database: url.pathname.slice(1),
    };
  } else {
    return {
      projectId,
      dbHost: 'localhost',
      dbPort: 3306,
      dbUser: 'root',
      dbPassword: '',
      database: 'ingestion_engine_main',
    };
  }
}
