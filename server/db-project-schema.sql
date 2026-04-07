-- Per-Project Database Schema
-- This schema is deployed to each project's dedicated database

-- Processing jobs table: tracks document processing status
CREATE TABLE processing_jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  document_id CHAR(36) NOT NULL,
  status ENUM('queued', 'processing', 'completed', 'failed') DEFAULT 'queued',
  stage VARCHAR(100) NOT NULL,
  progress_percent INT DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  estimated_completion TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_document_id (document_id)
);

-- Consolidation jobs table: tracks async project consolidation jobs
CREATE TABLE consolidation_jobs (
  id VARCHAR(100) PRIMARY KEY,
  project_id INT NOT NULL,
  status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
  stage VARCHAR(100) DEFAULT 'starting',
  progress_percent INT DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_project (project_id),
  INDEX idx_status (status)
);

-- Documents table: stores uploaded project documents
CREATE TABLE documents (
  id CHAR(36) PRIMARY KEY,
  fileName VARCHAR(255) NOT NULL,
  filePath VARCHAR(512) NOT NULL,
  fileSizeBytes INT,
  fileHash VARCHAR(255),
  documentType ENUM('IM', 'DD_PACK', 'CONTRACT', 'GRID_STUDY', 'CONCEPT_DESIGN', 'WEATHER_FILE', 'OTHER') NOT NULL,
  uploadDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('Uploaded', 'Processing', 'Processed', 'Error') DEFAULT 'Uploaded',
  processingError TEXT,
  extractedText LONGTEXT,
  pageCount INT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_documentType (documentType),
  INDEX idx_uploadDate (uploadDate)
);

-- Extracted facts table: extracted structured and unstructured facts from documents
CREATE TABLE extracted_facts (
  id VARCHAR(36) PRIMARY KEY,
  project_id INT NOT NULL,
  category VARCHAR(100) NOT NULL,
  `key` VARCHAR(255) NOT NULL,
  value TEXT NOT NULL,
  data_type VARCHAR(50),
  confidence VARCHAR(10),
  source_document_id VARCHAR(36),
  source_documents JSON COMMENT 'Array of document IDs that contributed to this insight',
  source_location TEXT,
  extraction_method VARCHAR(50),
  extraction_model VARCHAR(100),
  verified INT DEFAULT 0,
  verification_status VARCHAR(20) DEFAULT 'pending',
  enrichment_count INT DEFAULT 1 COMMENT 'Number of documents that enriched this insight',
  conflict_with VARCHAR(36) NULL COMMENT 'ID of conflicting insight if any',
  merged_from JSON COMMENT 'Array of insight IDs that were merged into this one',
  last_enriched_at TIMESTAMP NULL COMMENT 'Last time this insight was enriched',
  deleted_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_category (category),
  INDEX idx_key (`key`),
  INDEX idx_verified (verified),
  INDEX idx_confidence (confidence),
  INDEX idx_conflict_with (conflict_with)
);

-- Insight conflicts table: tracks conflicting insights from different documents
CREATE TABLE insight_conflicts (
  id VARCHAR(36) PRIMARY KEY,
  project_id INT NOT NULL,
  insight_a_id VARCHAR(36) NOT NULL,
  insight_b_id VARCHAR(36) NOT NULL,
  conflict_type ENUM('value_mismatch', 'date_mismatch', 'numerical_mismatch') NOT NULL,
  resolution_status ENUM('pending', 'resolved', 'ignored') DEFAULT 'pending',
  resolved_by INT NULL,
  resolved_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (insight_a_id) REFERENCES extracted_facts(id) ON DELETE CASCADE,
  FOREIGN KEY (insight_b_id) REFERENCES extracted_facts(id) ON DELETE CASCADE,
  INDEX idx_resolution_status (resolution_status),
  INDEX idx_project_id (project_id)
);

-- Red flags table: detected risks and issues
CREATE TABLE redFlags (
  id CHAR(36) PRIMARY KEY,
  category ENUM('Planning', 'Grid', 'Geotech', 'Performance', 'Scope', 'Commercial', 'Other') NOT NULL,
  title VARCHAR(255) NOT NULL,
  description LONGTEXT NOT NULL,
  severity ENUM('High', 'Medium', 'Low') NOT NULL,
  triggerFactId VARCHAR(36),
  evidenceGaps JSON,
  downstreamConsequences TEXT,
  mitigated BOOLEAN DEFAULT FALSE,
  mitigationNotes TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (triggerFactId) REFERENCES extracted_facts(id) ON DELETE SET NULL,
  INDEX idx_category (category),
  INDEX idx_severity (severity),
  INDEX idx_mitigated (mitigated)
);

-- Fact verification queue
CREATE TABLE factVerificationQueue (
  id CHAR(36) PRIMARY KEY,
  factId VARCHAR(36) NOT NULL UNIQUE,
  status ENUM('Pending', 'Approved', 'Rejected', 'Needs_Review') DEFAULT 'Pending',
  assignedToUserId INT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (factId) REFERENCES extracted_facts(id) ON DELETE CASCADE,
  INDEX idx_status (status)
);

-- Processing logs: track document processing pipeline
CREATE TABLE processingLogs (
  id CHAR(36) PRIMARY KEY,
  documentId CHAR(36),
  step ENUM('Upload', 'Text_Extraction', 'Deterministic_Extraction', 'LLM_Extraction', 'Consolidation', 'Red_Flag_Detection', 'Complete') NOT NULL,
  status ENUM('Started', 'In_Progress', 'Completed', 'Failed') NOT NULL,
  message TEXT,
  durationMs INT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (documentId) REFERENCES documents(id) ON DELETE CASCADE,
  INDEX idx_documentId (documentId),
  INDEX idx_step (step)
);

-- Project metadata
CREATE TABLE projectMetadata (
  id INT AUTO_INCREMENT PRIMARY KEY,
  projectName VARCHAR(255) NOT NULL,
  projectDescription TEXT,
  projectType ENUM('Solar', 'Wind', 'BESS', 'Hybrid', 'Other') DEFAULT 'Other',
  location VARCHAR(255),
  capacity DECIMAL(10, 2),
  capacityUnit VARCHAR(50),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Performance parameters: extracted technical specifications for performance validation
CREATE TABLE performance_parameters (
  id VARCHAR(36) PRIMARY KEY,
  project_id INT NOT NULL,
  dc_capacity_mw VARCHAR(20),
  ac_capacity_mw VARCHAR(20),
  module_model VARCHAR(255),
  module_power_watts VARCHAR(20),
  module_count INT,
  inverter_model VARCHAR(255),
  inverter_power_kw VARCHAR(20),
  inverter_count INT,
  tracking_type VARCHAR(50),
  tilt_angle_degrees VARCHAR(20),
  azimuth_degrees VARCHAR(20),
  latitude VARCHAR(20),
  longitude VARCHAR(20),
  site_name VARCHAR(255),
  elevation_m VARCHAR(20),
  timezone VARCHAR(50),
  system_losses_percent VARCHAR(20),
  degradation_rate_percent VARCHAR(20),
  availability_percent VARCHAR(20),
  soiling_loss_percent VARCHAR(20),
  weather_file_url VARCHAR(500),
  ghi_annual_kwh_m2 VARCHAR(20),
  dni_annual_kwh_m2 VARCHAR(20),
  temperature_ambient_c VARCHAR(20),
  p50_generation_gwh VARCHAR(20),
  p90_generation_gwh VARCHAR(20),
  capacity_factor_percent VARCHAR(20),
  specific_yield_kwh_kwp VARCHAR(20),
  source_document_id VARCHAR(36),
  confidence VARCHAR(20),
  extraction_method VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_project_id (project_id),
  INDEX idx_source_document (source_document_id)
);

-- Financial data: extracted CapEx/OpEx figures for benchmarking
CREATE TABLE financial_data (
  id VARCHAR(36) PRIMARY KEY,
  project_id INT NOT NULL,
  total_capex_usd VARCHAR(20),
  modules_usd VARCHAR(20),
  inverters_usd VARCHAR(20),
  trackers_usd VARCHAR(20),
  civil_works_usd VARCHAR(20),
  grid_connection_usd VARCHAR(20),
  development_costs_usd VARCHAR(20),
  other_capex_usd VARCHAR(20),
  total_opex_annual_usd VARCHAR(20),
  om_usd VARCHAR(20),
  insurance_usd VARCHAR(20),
  land_lease_usd VARCHAR(20),
  asset_management_usd VARCHAR(20),
  other_opex_usd VARCHAR(20),
  capex_per_watt_usd VARCHAR(20),
  opex_per_mwh_usd VARCHAR(20),
  original_currency VARCHAR(10),
  exchange_rate_to_usd VARCHAR(20),
  cost_year INT,
  escalation_rate_percent VARCHAR(20),
  source_document_id VARCHAR(36),
  confidence VARCHAR(20),
  extraction_method VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_project_id (project_id),
  INDEX idx_source_document (source_document_id)
);

-- Performance validations: results from Solar Analyzer API
CREATE TABLE performance_validations (
  id VARCHAR(36) PRIMARY KEY,
  project_id INT NOT NULL,
  calculation_id VARCHAR(100) NOT NULL,
  annual_generation_gwh VARCHAR(20),
  capacity_factor_percent VARCHAR(20),
  performance_ratio_percent VARCHAR(20),
  specific_yield_kwh_kwp VARCHAR(20),
  contractor_claim_gwh VARCHAR(20),
  variance_percent VARCHAR(20),
  variance_gwh VARCHAR(20),
  flag_triggered INT DEFAULT 0,
  confidence_level VARCHAR(20),
  dc_capacity_mw VARCHAR(20),
  ac_capacity_mw VARCHAR(20),
  module_model VARCHAR(255),
  inverter_model VARCHAR(255),
  tracking_type VARCHAR(50),
  total_system_losses_percent VARCHAR(20),
  parameters_extracted_count INT,
  parameters_assumed_count INT,
  confidence_score VARCHAR(20),
  weather_data_source VARCHAR(255),
  ghi_annual_kwh_m2 VARCHAR(20),
  poa_annual_kwh_m2 VARCHAR(20),
  monthly_profile TEXT,
  model_used VARCHAR(50),
  pysam_version VARCHAR(20),
  calculation_time_seconds VARCHAR(20),
  warnings TEXT,
  assumptions TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_project_id (project_id),
  INDEX idx_calculation_id (calculation_id)
);

-- Weather files for performance validation
CREATE TABLE IF NOT EXISTS weather_files (
  id VARCHAR(36) PRIMARY KEY,
  project_id INT NOT NULL,
  file_key VARCHAR(500) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size_bytes INT NOT NULL,
  source_type VARCHAR(50) NOT NULL,
  source_document_id VARCHAR(36),
  extracted_url VARCHAR(500),
  original_format VARCHAR(50),
  converted_format VARCHAR(50) DEFAULT 'sam_csv',
  converted_file_key VARCHAR(500),
  latitude VARCHAR(20),
  longitude VARCHAR(20),
  elevation VARCHAR(20),
  timezone VARCHAR(20),
  location_name VARCHAR(255),
  quality_score VARCHAR(20),
  record_count INT,
  missing_hours INT,
  outlier_count INT,
  validation_warnings TEXT,
  monthly_irradiance JSON DEFAULT NULL,
  annual_summary JSON DEFAULT NULL,
  parsed_location JSON DEFAULT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  processing_error TEXT,
  used_in_validation_id VARCHAR(36),
  is_active INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Section narratives for consolidation
CREATE TABLE IF NOT EXISTS section_narratives (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  section_key VARCHAR(255) NOT NULL,
  narrative TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_project_id (project_id),
  INDEX idx_section_key (section_key)
);

-- ACC Integration: OAuth credentials per project
CREATE TABLE IF NOT EXISTS acc_credentials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  user_email VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ACC Integration: Project mapping to ACC hub/project
CREATE TABLE IF NOT EXISTS acc_project_mapping (
  id INT AUTO_INCREMENT PRIMARY KEY,
  acc_hub_id VARCHAR(255) NOT NULL,
  acc_hub_name VARCHAR(255),
  acc_project_id VARCHAR(255) NOT NULL,
  acc_project_name VARCHAR(255),
  root_folder_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ACC Integration: Upload tracking
CREATE TABLE IF NOT EXISTS acc_uploads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  document_id VARCHAR(36) NOT NULL,
  acc_item_id VARCHAR(255) NOT NULL,
  acc_version_id VARCHAR(255),
  acc_folder_path VARCHAR(500),
  acc_file_name VARCHAR(500),
  acc_web_view_url VARCHAR(500),
  upload_status ENUM('pending', 'uploading', 'completed', 'failed') DEFAULT 'pending',
  upload_error TEXT,
  uploaded_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_document_id (document_id),
  INDEX idx_acc_item_id (acc_item_id)
);
