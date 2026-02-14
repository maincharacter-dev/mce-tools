import { getDb } from "./db";

/**
 * Get the prefixed table name for a project
 * @param dbName - The project database name (e.g., "proj_1_1769069300488")
 * @param tableName - The base table name (e.g., "documents", "extracted_facts")
 * @returns The prefixed table name (e.g., "proj_1_1769069300488_documents")
 */
export function getTableName(dbName: string, tableName: string): string {
  return `${dbName}_${tableName}`;
}

/**
 * Create all project tables with the given prefix in the main database
 * @param dbName - The project database name to use as prefix
 * @returns true if successful, false otherwise
 */
export async function createProjectTables(dbName: string): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    console.error("[TablePrefix] Database not available");
    return false;
  }

  try {
    // Create documents table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS \`${getTableName(dbName, "documents")}\` (
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
      )
    `);

    // Create extracted_facts table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS \`${getTableName(dbName, "extracted_facts")}\` (
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
        INDEX idx_confidence (confidence),
        INDEX idx_verification_status (verification_status),
        INDEX idx_source_document (source_document_id)
      )
    `);

    // Create red_flags table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS \`${getTableName(dbName, "red_flags")}\` (
        id VARCHAR(255) PRIMARY KEY,
        project_id INT NOT NULL,
        flag_type VARCHAR(100) NOT NULL,
        severity VARCHAR(50) NOT NULL,
        title VARCHAR(500) NOT NULL,
        description TEXT NOT NULL,
        evidence_fact_ids JSON,
        status VARCHAR(50) DEFAULT 'active',
        resolved_at DATETIME,
        resolved_by_user_id INT,
        resolution_notes TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at DATETIME NULL,
        INDEX idx_flag_type (flag_type),
        INDEX idx_severity (severity),
        INDEX idx_status (status)
      )
    `);

    // Create processing_jobs table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS \`${getTableName(dbName, "processing_jobs")}\` (
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
        INDEX idx_status (status),
        INDEX idx_job_type (job_type)
      )
    `);

    console.log(`[TablePrefix] Created project tables with prefix: ${dbName}`);
    return true;
  } catch (error) {
    console.error(`[TablePrefix] Failed to create project tables:`, error);
    return false;
  }
}

/**
 * Drop all project tables with the given prefix
 * @param dbName - The project database name used as prefix
 * @returns true if successful, false otherwise
 */
export async function dropProjectTables(dbName: string): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    console.error("[TablePrefix] Database not available");
    return false;
  }

  try {
    const tables = ["processing_jobs", "red_flags", "extracted_facts", "documents"];
    
    for (const table of tables) {
      await db.execute(`DROP TABLE IF EXISTS \`${getTableName(dbName, table)}\``);
    }

    console.log(`[TablePrefix] Dropped project tables with prefix: ${dbName}`);
    return true;
  } catch (error) {
    console.error(`[TablePrefix] Failed to drop project tables:`, error);
    return false;
  }
}
