#!/usr/bin/env node
/**
 * Migration script to update existing project databases
 * Renames 'facts' table to 'extracted_facts' and updates column names
 */

import mysql from 'mysql2/promise';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '../.env') });

async function migrateProjectDatabase(dbName) {
  console.log(`\n[Migration] Starting migration for database: ${dbName}`);
  
  const url = new URL(process.env.DATABASE_URL);
  const connection = await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: url.username,
    password: url.password,
    database: dbName,
    multipleStatements: true,
    ssl: {
      rejectUnauthorized: true,
    },
  });

  try {
    // Check if facts table exists
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'facts'"
    );

    if (tables.length === 0) {
      console.log(`[Migration] No 'facts' table found in ${dbName}, checking for extracted_facts...`);
      const [extractedFactsTables] = await connection.execute(
        "SHOW TABLES LIKE 'extracted_facts'"
      );
      if (extractedFactsTables.length > 0) {
        console.log(`[Migration] Database ${dbName} already has extracted_facts table, skipping.`);
        return;
      }
      console.log(`[Migration] No facts or extracted_facts table in ${dbName}, creating extracted_facts...`);
      
      // Create extracted_facts table from scratch
      await connection.execute(`
        CREATE TABLE extracted_facts (
          id VARCHAR(36) PRIMARY KEY,
          project_id INT NOT NULL,
          category VARCHAR(100) NOT NULL,
          \`key\` VARCHAR(255) NOT NULL,
          value TEXT NOT NULL,
          data_type VARCHAR(50),
          confidence VARCHAR(10),
          source_document_id VARCHAR(36),
          source_location TEXT,
          extraction_method VARCHAR(50),
          extraction_model VARCHAR(100),
          verified INT DEFAULT 0,
          verification_status VARCHAR(20) DEFAULT 'pending',
          deleted_at TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_category (category),
          INDEX idx_key (\`key\`),
          INDEX idx_verified (verified),
          INDEX idx_confidence (confidence)
        )
      `);
      console.log(`[Migration] Created extracted_facts table in ${dbName}`);
      return;
    }

    console.log(`[Migration] Found 'facts' table in ${dbName}, migrating to extracted_facts...`);

    // Drop foreign key constraints that reference facts table
    console.log(`[Migration] Dropping foreign key constraints...`);
    await connection.execute(`
      ALTER TABLE redFlags DROP FOREIGN KEY IF EXISTS redFlags_ibfk_1
    `).catch(() => console.log('[Migration] No FK constraint redFlags_ibfk_1 to drop'));
    
    await connection.execute(`
      ALTER TABLE factVerificationQueue DROP FOREIGN KEY IF EXISTS factVerificationQueue_ibfk_1
    `).catch(() => console.log('[Migration] No FK constraint factVerificationQueue_ibfk_1 to drop'));

    // Rename facts table to extracted_facts
    console.log(`[Migration] Renaming facts table to extracted_facts...`);
    await connection.execute(`
      RENAME TABLE facts TO extracted_facts
    `);

    // Alter column names to match new schema (snake_case)
    console.log(`[Migration] Updating column names...`);
    await connection.execute(`
      ALTER TABLE extracted_facts
        ADD COLUMN project_id INT NOT NULL DEFAULT 1 AFTER id,
        CHANGE COLUMN dataType data_type VARCHAR(50),
        CHANGE COLUMN sourceDocumentId source_document_id VARCHAR(36),
        CHANGE COLUMN sourceLocation source_location TEXT,
        CHANGE COLUMN extractionMethod extraction_method VARCHAR(50),
        CHANGE COLUMN extractionModel extraction_model VARCHAR(100),
        CHANGE COLUMN createdAt created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN verification_status VARCHAR(20) DEFAULT 'pending' AFTER verified,
        ADD COLUMN deleted_at TIMESTAMP NULL AFTER verification_status,
        DROP COLUMN verifiedByUserId,
        DROP COLUMN verifiedAt,
        DROP COLUMN verificationNotes,
        DROP COLUMN updatedAt
    `);

    // Re-add foreign key constraints
    console.log(`[Migration] Re-adding foreign key constraints...`);
    await connection.execute(`
      ALTER TABLE redFlags
        ADD CONSTRAINT redFlags_ibfk_1
        FOREIGN KEY (triggerFactId) REFERENCES extracted_facts(id) ON DELETE SET NULL
    `).catch((err) => console.log(`[Migration] Could not add FK constraint to redFlags: ${err.message}`));

    await connection.execute(`
      ALTER TABLE factVerificationQueue
        ADD CONSTRAINT factVerificationQueue_ibfk_1
        FOREIGN KEY (factId) REFERENCES extracted_facts(id) ON DELETE CASCADE
    `).catch((err) => console.log(`[Migration] Could not add FK constraint to factVerificationQueue: ${err.message}`));

    console.log(`[Migration] Successfully migrated database: ${dbName}`);
  } catch (error) {
    console.error(`[Migration] Error migrating database ${dbName}:`, error);
    throw error;
  } finally {
    await connection.end();
  }
}

async function main() {
  console.log('[Migration] Starting project database migration...');
  
  if (!process.env.DATABASE_URL) {
    console.error('[Migration] DATABASE_URL not set');
    process.exit(1);
  }

  // Connect to main database to get list of projects
  const url = new URL(process.env.DATABASE_URL);
  const mainConnection = await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: url.username,
    password: url.password,
    database: url.pathname.substring(1), // Remove leading slash
    ssl: {
      rejectUnauthorized: true,
    },
  });

  try {
    // Get all project databases
    const [projects] = await mainConnection.execute(
      'SELECT id, dbName FROM projects WHERE status = "active"'
    );

    console.log(`[Migration] Found ${projects.length} active projects`);

    for (const project of projects) {
      await migrateProjectDatabase(project.dbName);
    }

    console.log('\n[Migration] All project databases migrated successfully!');
  } catch (error) {
    console.error('[Migration] Error:', error);
    process.exit(1);
  } finally {
    await mainConnection.end();
  }
}

main();
