/**
 * Project Table Provisioner
 * 
 * Creates prefixed tables in the main database instead of separate databases.
 * This approach works within Manus production database permission constraints.
 * 
 * Architecture:
 * - All projects share the main database
 * - Tables are prefixed with proj_{id}_ (e.g., proj_6_documents)
 * - No CREATE/DROP DATABASE permissions needed
 */

import mysql from 'mysql2/promise';
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
 * Provision tables for a new project
 */
export async function provisionProjectTables(config: ProjectTableConfig): Promise<boolean> {
  let connection: mysql.Connection | null = null;

  try {
    const isLocal = config.dbHost === 'localhost' || config.dbHost === '127.0.0.1';
    connection = await mysql.createConnection({
      host: config.dbHost,
      port: config.dbPort,
      user: config.dbUser,
      password: config.dbPassword,
      database: config.database,
      multipleStatements: true,
      ...(isLocal ? {} : { ssl: { rejectUnauthorized: true } }),
    });

    console.log(`[ProjectTables] Provisioning tables for project ${config.projectId}`);

    // Read the schema SQL
    const schemaPath = path.join(process.cwd(), 'server', 'db-project-schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

    // Transform schema: add table prefixes and update foreign key references
    const prefix = getTablePrefix(config.projectId);
    const transformedSql = transformSchemaWithPrefix(schemaSql, prefix);

    // Split and execute statements
    const parts = transformedSql.split(';');
    
    // Process each part: remove comment lines but keep the SQL statements
    const statements = parts
      .map(part => {
        // Remove comment lines (lines starting with --)
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
        await connection.execute(statement);
        // Extract table name for logging
        const match = statement.match(/CREATE TABLE (?:IF NOT EXISTS )?`?(\w+)`?/i);
        if (match) {
          console.log(`[ProjectTables] ✓ Created table: ${match[1]}`);
        }
      } catch (error: any) {
        // Ignore "table already exists" errors
        if (error.code !== 'ER_TABLE_EXISTS_ERROR') {
          console.error(`[ProjectTables] ✗ Error:`, error);
          console.error(`[ProjectTables] Failed statement: ${statement.substring(0, 100)}...`);
          throw error;
        }
      }
    }

    console.log(`[ProjectTables] Successfully provisioned tables for project ${config.projectId}`);
    return true;
  } catch (error) {
    console.error(`[ProjectTables] Failed to provision tables for project ${config.projectId}:`, error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

/**
 * Delete all tables for a project
 */
export async function deleteProjectTables(config: ProjectTableConfig): Promise<boolean> {
  let connection: mysql.Connection | null = null;

  try {
    const isLocal = config.dbHost === 'localhost' || config.dbHost === '127.0.0.1';
    connection = await mysql.createConnection({
      host: config.dbHost,
      port: config.dbPort,
      user: config.dbUser,
      password: config.dbPassword,
      database: config.database,
      ...(isLocal ? {} : { ssl: { rejectUnauthorized: true } }),
    });

    const prefix = getTablePrefix(config.projectId);

    // Get all tables with this prefix
    const [tables]: any = await connection.execute(
      `SELECT table_name FROM information_schema.tables 
       WHERE table_schema = ? AND table_name LIKE ?`,
      [config.database, `${prefix}%`]
    );

    if (tables.length === 0) {
      console.log(`[ProjectTables] No tables found for project ${config.projectId}`);
      return true;
    }

    console.log(`[ProjectTables] Deleting ${tables.length} tables for project ${config.projectId}`);

    // Disable foreign key checks temporarily
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');

    // Drop all tables
    for (const row of tables) {
      const tableName = row.table_name || row.TABLE_NAME;
      await connection.execute(`DROP TABLE IF EXISTS \`${tableName}\``);
      console.log(`[ProjectTables] ✓ Dropped table: ${tableName}`);
    }

    // Re-enable foreign key checks
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

    console.log(`[ProjectTables] Successfully deleted all tables for project ${config.projectId}`);
    return true;
  } catch (error) {
    console.error(`[ProjectTables] Failed to delete tables for project ${config.projectId}:`, error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

/**
 * Transform schema SQL to use table prefixes
 */
function transformSchemaWithPrefix(schemaSql: string, prefix: string): string {
  // List of table names from the schema (extracted from CREATE TABLE statements)
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
    // ACC integration tables
    'acc_credentials',
    'acc_project_mapping',
    'acc_uploads',
    'factVerificationQueue',
    'processingLogs',
    'projectMetadata'
  ];

  let transformed = schemaSql;

  // Add prefix to CREATE TABLE statements
  for (const tableName of tableNames) {
    // Match CREATE TABLE with optional IF NOT EXISTS
    const createPattern = new RegExp(
      `CREATE TABLE (IF NOT EXISTS )?${tableName}\\b`,
      'gi'
    );
    transformed = transformed.replace(
      createPattern,
      `CREATE TABLE IF NOT EXISTS ${prefix}${tableName}`
    );

    // Update FOREIGN KEY REFERENCES
    const fkPattern = new RegExp(
      `REFERENCES ${tableName}\\b`,
      'gi'
    );
    transformed = transformed.replace(
      fkPattern,
      `REFERENCES ${prefix}${tableName}`
    );
  }

  return transformed;
}

/**
 * Get connection config from DATABASE_URL for table provisioning
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
      database: url.pathname.slice(1), // Remove leading /
    };
  } else {
    // Development: use local MySQL
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
