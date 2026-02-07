/**
 * TA/TDD Engine Integration
 * 
 * Handles creation and linking of TA/TDD engine projects
 * when creating projects in OE Toolkit
 */

import mysql from 'mysql2/promise';

/**
 * Get TA/TDD engine database connection config
 * Uses TA_TDD_DATABASE_URL environment variable for cross-project database access
 */
function getTaTddDbConfig(): string | mysql.ConnectionOptions {
  const taTddDatabaseUrl = process.env.TA_TDD_DATABASE_URL;
  
  if (taTddDatabaseUrl) {
    // Production: Use TA_TDD_DATABASE_URL directly
    return taTddDatabaseUrl;
  } else {
    // Development: Connect to local TA/TDD engine database
    return {
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: '',
      database: 'ingestion_engine_main',
    };
  }
}

/**
 * Get per-project database connection config
 * Uses TA_TDD_DATABASE_URL to build per-project database URLs
 */
function getProjectDbConfig(dbName: string): string | mysql.ConnectionOptions {
  const taTddDatabaseUrl = process.env.TA_TDD_DATABASE_URL;
  
  if (taTddDatabaseUrl) {
    // Production: Parse TA_TDD_DATABASE_URL and replace database name
    const urlObj = new URL(taTddDatabaseUrl);
    urlObj.pathname = `/${dbName}`;
    return urlObj.toString();
  } else {
    // Development: Connect to local per-project database
    return {
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: '',
      database: dbName,
    };
  }
}

/**
 * Create a TA/TDD engine project
 * Returns the project ID and per-project database name
 */
export async function createTaTddProject(params: {
  name: string;
  description?: string;
  createdByUserId: number;
}): Promise<{ projectId: number; dbName: string }> {
  const connection = await mysql.createConnection(getTaTddDbConfig() as any);
  
  try {
    // Generate unique database name for per-project database
    const timestamp = Date.now();
    const dbName = `project_${timestamp}`;
    
    // Insert project into TA/TDD engine main database
    const [result] = await connection.execute(
      `INSERT INTO projects (name, description, dbName, dbHost, dbPort, createdByUserId, status, createdAt, updatedAt) 
       VALUES (?, ?, ?, 'localhost', 3306, ?, 'Active', NOW(), NOW())`,
      [params.name, params.description || '', dbName, params.createdByUserId]
    ) as any;
    
    const projectId = result.insertId;
    
    console.log(`[TA/TDD Integration] Created TA/TDD project ${projectId} with database ${dbName}`);
    
    // Create per-project database
    await createProjectDatabase(dbName);
    
    return { projectId, dbName };
  } finally {
    await connection.end();
  }
}

/**
 * Create per-project database with schema
 */
async function createProjectDatabase(dbName: string) {
  const connection = await mysql.createConnection(getTaTddDbConfig() as any);
  
  try {
    // Create database
    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`[TA/TDD Integration] Created database ${dbName}`);
  } finally {
    await connection.end();
  }
  
  // Connect to the new database and create schema
  const projectConnection = await mysql.createConnection(getProjectDbConfig(dbName) as any);
  
  try {
    // Create acc_project_mapping table
    await projectConnection.execute(`
      CREATE TABLE IF NOT EXISTS acc_project_mapping (
        id INT AUTO_INCREMENT PRIMARY KEY,
        acc_hub_id VARCHAR(100) NOT NULL,
        acc_hub_name VARCHAR(255),
        acc_project_id VARCHAR(100) NOT NULL,
        acc_project_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create acc_credentials table
    await projectConnection.execute(`
      CREATE TABLE IF NOT EXISTS acc_credentials (
        id INT AUTO_INCREMENT PRIMARY KEY,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // Create documents table (basic version - TA/TDD engine will add more fields as needed)
    await projectConnection.execute(`
      CREATE TABLE IF NOT EXISTS documents (
        id VARCHAR(36) PRIMARY KEY,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size_bytes INT NOT NULL,
        file_hash VARCHAR(64),
        document_type VARCHAR(50),
        upload_date TIMESTAMP NOT NULL,
        status VARCHAR(20) DEFAULT 'uploaded',
        extracted_text TEXT,
        page_count INT,
        acc_project_id VARCHAR(100),
        acc_folder_id VARCHAR(100),
        acc_file_urn VARCHAR(500),
        acc_version_urn VARCHAR(500),
        last_synced_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log(`[TA/TDD Integration] Created schema for database ${dbName}`);
  } finally {
    await projectConnection.end();
  }
}

/**
 * Store ACC project mapping in per-project database
 */
export async function storeAccMapping(params: {
  dbName: string;
  accHubId: string;
  accHubName: string;
  accProjectId: string;
  accProjectName: string;
}) {
  const connection = await mysql.createConnection(getProjectDbConfig(params.dbName) as any);
  
  try {
    // Delete any existing mapping
    await connection.execute(`DELETE FROM acc_project_mapping`);
    
    // Insert new mapping
    await connection.execute(
      `INSERT INTO acc_project_mapping (acc_hub_id, acc_hub_name, acc_project_id, acc_project_name) 
       VALUES (?, ?, ?, ?)`,
      [params.accHubId, params.accHubName, params.accProjectId, params.accProjectName]
    );
    
    console.log(`[TA/TDD Integration] Stored ACC mapping in ${params.dbName}`);
  } finally {
    await connection.end();
  }
}

/**
 * Store ACC credentials in per-project database
 */
export async function storeAccCredentials(params: {
  dbName: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
}) {
  const connection = await mysql.createConnection(getProjectDbConfig(params.dbName) as any);
  
  try {
    // Delete any existing credentials
    await connection.execute(`DELETE FROM acc_credentials`);
    
    // Insert new credentials
    await connection.execute(
      `INSERT INTO acc_credentials (access_token, refresh_token, expires_at) 
       VALUES (?, ?, ?)`,
      [params.accessToken, params.refreshToken || null, params.expiresAt]
    );
    
    console.log(`[TA/TDD Integration] Stored ACC credentials in ${params.dbName}`);
  } finally {
    await connection.end();
  }
}
