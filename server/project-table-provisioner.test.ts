/**
 * Tests for project table provisioning with standard schema
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mysql from 'mysql2/promise';
import { provisionProjectTables, deleteProjectTables, getTableName } from './project-table-provisioner';

describe('Project Table Provisioner', () => {
  const testProjectId = 999999; // Use a high ID to avoid conflicts
  let connection: mysql.Connection;

  beforeAll(async () => {
    // Connect to local MySQL
    connection = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '',
      database: 'ingestion_engine_main',
    });

    // Clean up any existing test tables
    try {
      await deleteProjectTables({
        projectId: testProjectId,
        dbHost: 'localhost',
        dbPort: 3306,
        dbUser: 'root',
        dbPassword: '',
        database: 'ingestion_engine_main',
      });
    } catch (error) {
      // Ignore if tables don't exist
    }
  });

  afterAll(async () => {
    // Clean up test tables
    try {
      await deleteProjectTables({
        projectId: testProjectId,
        dbHost: 'localhost',
        dbPort: 3306,
        dbUser: 'root',
        dbPassword: '',
        database: 'ingestion_engine_main',
      });
    } catch (error) {
      console.error('Cleanup error:', error);
    }

    await connection.end();
  });

  it('should provision tables with correct prefix', async () => {
    await provisionProjectTables({
      projectId: testProjectId,
      dbHost: 'localhost',
      dbPort: 3306,
      dbUser: 'root',
      dbPassword: '',
      database: 'ingestion_engine_main',
    });

    // Check that tables were created with correct prefix
    const [tables]: any = await connection.execute(
      `SELECT table_name FROM information_schema.tables 
       WHERE table_schema = ? AND table_name LIKE ?`,
      ['ingestion_engine_main', `proj_${testProjectId}_%`]
    );

    expect(tables.length).toBeGreaterThan(0);
    
    // Check for specific required tables
    const tableNames = tables.map((t: any) => t.table_name || t.TABLE_NAME);
    expect(tableNames).toContain(getTableName(testProjectId, 'documents'));
    expect(tableNames).toContain(getTableName(testProjectId, 'processing_jobs'));
    expect(tableNames).toContain(getTableName(testProjectId, 'extracted_facts'));
  });

  it('should create documents table with correct schema', async () => {
    // Check documents table columns
    const [columns]: any = await connection.execute(
      `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_DEFAULT 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      ['ingestion_engine_main', getTableName(testProjectId, 'documents')]
    );

    const columnMap = new Map(
      columns.map((col: any) => [col.COLUMN_NAME, col])
    );

    // Check for camelCase column names
    expect(columnMap.has('fileName')).toBe(true);
    expect(columnMap.has('filePath')).toBe(true);
    expect(columnMap.has('uploadDate')).toBe(true);
    expect(columnMap.has('fileSizeBytes')).toBe(true);

    // Check uploadDate has DEFAULT CURRENT_TIMESTAMP
    const uploadDateCol = columnMap.get('uploadDate');
    expect(uploadDateCol.COLUMN_DEFAULT).toContain('CURRENT_TIMESTAMP');
  });

  it('should create processing_jobs table with stage column', async () => {
    // Check processing_jobs table columns
    const [columns]: any = await connection.execute(
      `SELECT COLUMN_NAME, DATA_TYPE 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      ['ingestion_engine_main', getTableName(testProjectId, 'processing_jobs')]
    );

    const columnNames = columns.map((col: any) => col.COLUMN_NAME);

    // Check for required columns
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('document_id');
    expect(columnNames).toContain('status');
    expect(columnNames).toContain('stage'); // This is the key fix
    expect(columnNames).toContain('progress_percent');
  });

  it('should create ACC integration tables', async () => {
    const [tables]: any = await connection.execute(
      `SELECT table_name FROM information_schema.tables 
       WHERE table_schema = ? AND table_name LIKE ?`,
      ['ingestion_engine_main', `proj_${testProjectId}_%`]
    );

    const tableNames = tables.map((t: any) => t.table_name || t.TABLE_NAME);

    // Check for ACC integration tables
    expect(tableNames).toContain(getTableName(testProjectId, 'acc_credentials'));
    expect(tableNames).toContain(getTableName(testProjectId, 'acc_project_mapping'));
    expect(tableNames).toContain(getTableName(testProjectId, 'acc_uploads'));
  });

  it('should delete all project tables', async () => {
    // Delete tables
    await deleteProjectTables({
      projectId: testProjectId,
      dbHost: 'localhost',
      dbPort: 3306,
      dbUser: 'root',
      dbPassword: '',
      database: 'ingestion_engine_main',
    });

    // Verify tables are deleted
    const [tables]: any = await connection.execute(
      `SELECT table_name FROM information_schema.tables 
       WHERE table_schema = ? AND table_name LIKE ?`,
      ['ingestion_engine_main', `proj_${testProjectId}_%`]
    );

    expect(tables.length).toBe(0);
  });
});
