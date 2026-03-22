/**
 * Table Helper - Utilities for working with prefixed tables
 * 
 * Provides helper functions to generate table names with project prefixes
 * and build queries that work with the new table-prefix architecture.
 */

/**
 * Get table name with project prefix
 */
export function t(projectId: number, tableName: string): string {
  return `proj_${projectId}_${tableName}`;
}

/**
 * Build a SQL query with table prefixes
 * Usage: sql(projectId, 'SELECT * FROM {documents} WHERE id = ?')
 * Result: 'SELECT * FROM proj_6_documents WHERE id = ?'
 */
export function sql(projectId: number, query: string): string {
  return query.replace(/\{(\w+)\}/g, (_, tableName) => {
    return t(projectId, tableName);
  });
}

/**
 * Common table names used across the system.
 * IMPORTANT: Every table defined in db-project-schema.sql must be listed here
 * so that ProjectDbConnection.transformQuery() can prefix them correctly.
 */
export const Tables = {
  DOCUMENTS: 'documents',
  EXTRACTED_FACTS: 'extracted_facts',
  INSIGHT_CONFLICTS: 'insight_conflicts',
  RED_FLAGS: 'redFlags',
  SECTION_NARRATIVES: 'section_narratives',
  PERFORMANCE_PARAMETERS: 'performance_parameters',
  PERFORMANCE_VALIDATIONS: 'performance_validations',
  WEATHER_FILES: 'weather_files',
  WEATHER_MONTHLY_DATA: 'weather_monthly_data',
  FINANCIAL_DATA: 'financial_data',
  PROJECT_LOCATION: 'project_location',
  PROCESSING_JOBS: 'processing_jobs',
  PROCESSING_LOGS: 'processingLogs',
  CONSOLIDATION_JOBS: 'consolidation_jobs',
  PROJECT_METADATA: 'projectMetadata',
  // ACC integration tables
  ACC_CREDENTIALS: 'acc_credentials',
  ACC_PROJECT_MAPPING: 'acc_project_mapping',
  ACC_UPLOADS: 'acc_uploads',
} as const;

/**
 * Get all table names for a project
 */
export function getAllTableNames(projectId: number): string[] {
  return Object.values(Tables).map(tableName => t(projectId, tableName));
}
