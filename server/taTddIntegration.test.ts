/**
 * Tests for TA/TDD Engine Integration
 */

import { describe, it, expect } from 'vitest';
import { getTablePrefix, getTableName } from './taTddIntegration';

describe('TA/TDD Integration Helper Functions', () => {
  describe('getTablePrefix', () => {
    it('should generate correct table prefix for project ID', () => {
      expect(getTablePrefix(1)).toBe('proj_1_');
      expect(getTablePrefix(42)).toBe('proj_42_');
      expect(getTablePrefix(12345)).toBe('proj_12345_');
    });
  });

  describe('getTableName', () => {
    it('should generate correct full table name with prefix', () => {
      expect(getTableName(1, 'documents')).toBe('proj_1_documents');
      expect(getTableName(42, 'extracted_facts')).toBe('proj_42_extracted_facts');
      expect(getTableName(100, 'acc_credentials')).toBe('proj_100_acc_credentials');
    });

    it('should handle different table names correctly', () => {
      const projectId = 5;
      expect(getTableName(projectId, 'documents')).toBe('proj_5_documents');
      expect(getTableName(projectId, 'extracted_facts')).toBe('proj_5_extracted_facts');
      expect(getTableName(projectId, 'acc_credentials')).toBe('proj_5_acc_credentials');
      expect(getTableName(projectId, 'acc_project_mapping')).toBe('proj_5_acc_project_mapping');
      expect(getTableName(projectId, 'processing_jobs')).toBe('proj_5_processing_jobs');
    });
  });
});

/**
 * Note: Integration tests for createTaTddProject, storeAccMapping, and storeAccCredentials
 * require a live database connection and are not included here to avoid test environment setup.
 * 
 * These functions should be tested manually or in an integration test environment with:
 * - Valid TA_TDD_DATABASE_URL environment variable
 * - Access to the shared TA/TDD database
 * - Proper cleanup after tests
 */
