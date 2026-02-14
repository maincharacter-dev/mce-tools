/**
 * TA/TDD Engine Integration
 * 
 * Integrates OE Toolkit with the TA/TDD engine using shared database access.
 * Projects are created in the TA/TDD engine with prefixed tables (proj_{id}_*).
 */

import mysql from 'mysql2/promise';

/**
 * Get TA/TDD database connection
 */
async function getTaTddDbConnection() {
  const dbUrl = process.env.TA_TDD_DATABASE_URL;
  if (!dbUrl) {
    throw new Error('TA_TDD_DATABASE_URL environment variable not set');
  }

  const url = new URL(dbUrl);
  return await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1), // Remove leading /
    ssl: { rejectUnauthorized: true },
  });
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
 * Create a new TA/TDD engine project
 */
export async function createTaTddProject(data: {
  name: string;
  description?: string;
  createdByUserId: number;
}): Promise<{ id: number; dbName: string }> {
  const connection = await getTaTddDbConnection();

  try {
    // Insert project into TA/TDD projects table
    // Note: dbName is set to empty string initially, then updated after we get the project ID
    const [result] = await connection.execute(
      `INSERT INTO projects (name, description, dbName, createdByUserId, createdAt, updatedAt)
       VALUES (?, ?, '', ?, NOW(), NOW())`,
      [data.name, data.description || '', data.createdByUserId]
    ) as any;

    const projectId = Number(result.insertId);
    const dbName = `proj_${projectId}`;

    // Update the dbName field
    await connection.execute(
      `UPDATE projects SET dbName = ?, updatedAt = NOW() WHERE id = ?`,
      [dbName, projectId]
    );

    console.log(`[TaTddIntegration] Created TA/TDD project: ${projectId} (${data.name})`);

    // Provision prefixed tables for this project
    await provisionProjectTables(projectId);

    return { id: projectId, dbName };
  } catch (error) {
    console.error('[TaTddIntegration] Failed to create TA/TDD project:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

/**
 * Provision prefixed tables for a project
 */
async function provisionProjectTables(projectId: number): Promise<void> {
  const dbUrl = process.env.TA_TDD_DATABASE_URL;
  if (!dbUrl) {
    throw new Error('TA_TDD_DATABASE_URL not set');
  }

  const url = new URL(dbUrl);
  const connection = await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    multipleStatements: true,
    ssl: { rejectUnauthorized: true },
  });

  try {
    const prefix = getTablePrefix(projectId);
    console.log(`[TaTddIntegration] Provisioning tables with prefix: ${prefix}`);

    // Create essential project tables with prefix
    const tables = [
      // Documents table
      `CREATE TABLE IF NOT EXISTS \`${prefix}documents\` (
        id VARCHAR(255) PRIMARY KEY,
        fileName VARCHAR(500) NOT NULL,
        filePath VARCHAR(1000) NOT NULL,
        fileSizeBytes BIGINT NOT NULL,
        fileHash VARCHAR(64),
        documentType VARCHAR(100),
        uploadDate DATETIME NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'uploaded',
        extractedText LONGTEXT,
        pageCount INT,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deletedAt DATETIME NULL,
        INDEX idx_upload_date (uploadDate),
        INDEX idx_status (status),
        INDEX idx_document_type (documentType)
      )`,

      // Extracted facts table
      `CREATE TABLE IF NOT EXISTS \`${prefix}extracted_facts\` (
        id VARCHAR(255) PRIMARY KEY,
        project_id INT NOT NULL,
        data_type VARCHAR(100) NOT NULL,
        category VARCHAR(100),
        extracted_value TEXT NOT NULL,
        confidence DECIMAL(5,4),
        source_document_id VARCHAR(255),
        source_page INT,
        source_text_snippet TEXT,
        extraction_method VARCHAR(50),
        verification_status VARCHAR(50) DEFAULT 'pending',
        verified_by_user_id INT,
        verified_at DATETIME,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at DATETIME NULL,
        INDEX idx_data_type (data_type),
        INDEX idx_category (category),
        INDEX idx_verification_status (verification_status)
      )`,

      // ACC credentials table
      `CREATE TABLE IF NOT EXISTS \`${prefix}acc_credentials\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        expires_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`,

      // ACC project mapping table
      `CREATE TABLE IF NOT EXISTS \`${prefix}acc_project_mapping\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        acc_hub_id VARCHAR(255) NOT NULL,
        acc_hub_name VARCHAR(500),
        acc_project_id VARCHAR(255) NOT NULL,
        acc_project_name VARCHAR(500),
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`,

      // Processing jobs table
      `CREATE TABLE IF NOT EXISTS \`${prefix}processing_jobs\` (
        id VARCHAR(255) PRIMARY KEY,
        document_id VARCHAR(255) NOT NULL,
        job_type VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'queued',
        started_at DATETIME,
        completed_at DATETIME,
        error_message TEXT,
        progress_percent INT DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_document_id (document_id),
        INDEX idx_status (status)
      )`,
    ];

    for (const createTableSql of tables) {
      await connection.execute(createTableSql);
    }

    console.log(`[TaTddIntegration] ✓ Provisioned ${tables.length} tables for project ${projectId}`);
  } catch (error) {
    console.error(`[TaTddIntegration] Failed to provision tables for project ${projectId}:`, error);
    throw error;
  } finally {
    await connection.end();
  }
}

/**
 * Store ACC project mapping in TA/TDD per-project table
 */
export async function storeAccMapping(
  projectId: number,
  mapping: {
    accHubId: string;
    accHubName: string;
    accProjectId: string;
    accProjectName: string;
  }
): Promise<void> {
  const dbUrl = process.env.TA_TDD_DATABASE_URL;
  if (!dbUrl) {
    throw new Error('TA_TDD_DATABASE_URL not set');
  }

  const url = new URL(dbUrl);
  const connection = await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    ssl: { rejectUnauthorized: true },
  });

  try {
    const tableName = getTableName(projectId, 'acc_project_mapping');
    await connection.execute(
      `INSERT INTO \`${tableName}\` (acc_hub_id, acc_hub_name, acc_project_id, acc_project_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, NOW(), NOW())`,
      [mapping.accHubId, mapping.accHubName, mapping.accProjectId, mapping.accProjectName]
    );

    console.log(`[TaTddIntegration] Stored ACC mapping for project ${projectId}`);
  } catch (error) {
    console.error(`[TaTddIntegration] Failed to store ACC mapping:`, error);
    throw error;
  } finally {
    await connection.end();
  }
}

/**
 * Store ACC credentials in TA/TDD per-project table
 */
export async function storeAccCredentials(
  projectId: number,
  credentials: {
    accessToken: string;
    refreshToken?: string;
    expiresAt: Date;
  }
): Promise<void> {
  const dbUrl = process.env.TA_TDD_DATABASE_URL;
  if (!dbUrl) {
    throw new Error('TA_TDD_DATABASE_URL not set');
  }

  const url = new URL(dbUrl);
  const connection = await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    ssl: { rejectUnauthorized: true },
  });

  try {
    const tableName = getTableName(projectId, 'acc_credentials');
    await connection.execute(
      `INSERT INTO \`${tableName}\` (access_token, refresh_token, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, NOW(), NOW())`,
      [credentials.accessToken, credentials.refreshToken || null, credentials.expiresAt]
    );

    console.log(`[TaTddIntegration] Stored ACC credentials for project ${projectId}`);
  } catch (error) {
    console.error(`[TaTddIntegration] Failed to store ACC credentials:`, error);
    throw error;
  } finally {
    await connection.end();
  }
}

/**
 * Archive a TA/TDD engine project (set status to Archived)
 */
export async function archiveTaTddProject(projectId: number): Promise<void> {
  const connection = await getTaTddDbConnection();

  try {
    await connection.execute(
      `UPDATE projects SET status = 'Archived', updatedAt = NOW() WHERE id = ?`,
      [projectId]
    );

    console.log(`[TaTddIntegration] Archived TA/TDD project ${projectId}`);
  } catch (error) {
    console.error(`[TaTddIntegration] Failed to archive TA/TDD project:`, error);
    throw error;
  } finally {
    await connection.end();
  }
}
