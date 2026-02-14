# Document Intelligence Platform: Database Schema Design

## 1. Central OE Database (Existing)
Manages projects, users, and global configuration.

### Extended `projects` Table
```sql
CREATE TABLE projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  db_name VARCHAR(255) NOT NULL UNIQUE,  -- Dynamic project DB name
  db_host VARCHAR(255) DEFAULT 'localhost',
  db_port INT DEFAULT 3306,
  db_user VARCHAR(255),
  db_password VARCHAR(255),
  status ENUM('Active', 'Archived', 'Deleted') DEFAULT 'Active',
  created_by_user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);
```

### `knowledge_base_config` Table
```sql
CREATE TABLE knowledge_base_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  db_name VARCHAR(255) NOT NULL UNIQUE,
  db_host VARCHAR(255) DEFAULT 'localhost',
  db_port INT DEFAULT 3306,
  db_user VARCHAR(255),
  db_password VARCHAR(255),
  status ENUM('Active', 'Inactive') DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 2. Per-Project Database Schema (Dynamic)
Created for each project, stores all project-specific data.

### `documents` Table
```sql
CREATE TABLE documents (
  id CHAR(36) PRIMARY KEY,  -- UUID
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(512) NOT NULL,  -- Local file path
  file_size_bytes INT,
  file_hash VARCHAR(255),  -- SHA256 for deduplication
  document_type ENUM('IM', 'DD_Pack', 'Contract', 'Grid_Study', 'Planning', 'Design', 'Other') NOT NULL,
  upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('Uploaded', 'Processing', 'Processed', 'Error') DEFAULT 'Uploaded',
  processing_error TEXT,
  extracted_text LONGTEXT,  -- Full text after OCR/extraction
  page_count INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_document_type (document_type)
);
```

### `facts` Table (Project Fact Base)
```sql
CREATE TABLE facts (
  id CHAR(36) PRIMARY KEY,  -- UUID
  category ENUM('Technology', 'Assumption', 'Parameter', 'Dependency', 'Other') NOT NULL,
  key VARCHAR(255) NOT NULL,  -- Canonical key (e.g., 'pv_module_manufacturer')
  value LONGTEXT NOT NULL,
  data_type ENUM('String', 'Number', 'Date', 'Boolean', 'JSON') DEFAULT 'String',
  confidence DECIMAL(5, 2) NOT NULL,  -- 0.00 to 1.00
  source_document_id CHAR(36) NOT NULL,
  source_location VARCHAR(255),  -- Page/Section/Coordinate
  extraction_method ENUM('Deterministic_Regex', 'Ollama_LLM', 'Manual_Input') NOT NULL,
  extraction_model VARCHAR(255),  -- e.g., 'ollama:llama2'
  verified BOOLEAN DEFAULT FALSE,
  verified_by_user_id INT,
  verified_at TIMESTAMP,
  verification_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (source_document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (verified_by_user_id) REFERENCES users(id),
  INDEX idx_category (category),
  INDEX idx_key (key),
  INDEX idx_verified (verified),
  INDEX idx_confidence (confidence),
  FULLTEXT INDEX ft_value (value)
);
```

### `red_flags` Table
```sql
CREATE TABLE red_flags (
  id CHAR(36) PRIMARY KEY,  -- UUID
  category ENUM('Planning', 'Grid', 'Geotech', 'Performance', 'Scope', 'Commercial', 'Other') NOT NULL,
  title VARCHAR(255) NOT NULL,
  description LONGTEXT NOT NULL,
  severity ENUM('High', 'Medium', 'Low') NOT NULL,
  trigger_fact_id CHAR(36),  -- Fact that triggered the red flag
  evidence_gaps JSON,  -- Array of missing evidence
  downstream_consequences TEXT,
  mitigated BOOLEAN DEFAULT FALSE,
  mitigation_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (trigger_fact_id) REFERENCES facts(id) ON DELETE SET NULL,
  INDEX idx_category (category),
  INDEX idx_severity (severity),
  INDEX idx_mitigated (mitigated)
);
```

### `fact_verification_queue` Table
```sql
CREATE TABLE fact_verification_queue (
  id CHAR(36) PRIMARY KEY,  -- UUID
  fact_id CHAR(36) NOT NULL UNIQUE,
  status ENUM('Pending', 'Approved', 'Rejected', 'Needs_Review') DEFAULT 'Pending',
  assigned_to_user_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (fact_id) REFERENCES facts(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to_user_id) REFERENCES users(id),
  INDEX idx_status (status)
);
```

### `processing_logs` Table
```sql
CREATE TABLE processing_logs (
  id CHAR(36) PRIMARY KEY,  -- UUID
  document_id CHAR(36),
  step ENUM('Upload', 'Text_Extraction', 'Deterministic_Extraction', 'LLM_Extraction', 'Consolidation', 'Red_Flag_Detection', 'Complete') NOT NULL,
  status ENUM('Started', 'In_Progress', 'Completed', 'Failed') NOT NULL,
  message TEXT,
  duration_ms INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  INDEX idx_document_id (document_id),
  INDEX idx_step (step)
);
```

---

## 3. Knowledge Database Schema (Central)
Stores de-identified, aggregated data for learning and benchmarking.

### `deidentified_facts` Table
```sql
CREATE TABLE deidentified_facts (
  id CHAR(36) PRIMARY KEY,  -- UUID
  project_type ENUM('Solar', 'Wind', 'BESS', 'Hybrid', 'Other') NOT NULL,
  region VARCHAR(50),  -- De-identified region
  category ENUM('Technology', 'Assumption', 'Parameter', 'Dependency', 'Other') NOT NULL,
  key VARCHAR(255) NOT NULL,
  value LONGTEXT NOT NULL,
  confidence_avg DECIMAL(5, 2),
  verification_rate DECIMAL(5, 2),  -- % of facts verified by users
  count INT DEFAULT 1,  -- Number of projects contributing
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_project_type (project_type),
  INDEX idx_category (category),
  INDEX idx_key (key)
);
```

### `risk_archetypes` Table
```sql
CREATE TABLE risk_archetypes (
  id CHAR(36) PRIMARY KEY,  -- UUID
  archetype_name VARCHAR(255) NOT NULL UNIQUE,
  category ENUM('Planning', 'Grid', 'Geotech', 'Performance', 'Scope', 'Commercial') NOT NULL,
  trigger_facts JSON,  -- Array of fact keys that trigger this risk
  mitigation_strategies LONGTEXT,
  frequency INT DEFAULT 0,  -- Count across all projects
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_category (category)
);
```

---

## 4. File Storage Structure (Local)
```
/data/projects/
├── proj_<uuid>/
│   ├── documents/
│   │   ├── <doc_id>_original.<ext>
│   │   ├── <doc_id>_extracted_text.txt
│   │   └── <doc_id>_metadata.json
│   ├── exports/
│   │   ├── PDR_<timestamp>.pdf
│   │   ├── PDR_<timestamp>.docx
│   │   └── Facts_<timestamp>.xlsx
│   └── logs/
│       └── processing_<timestamp>.log
```

---

## 5. Ollama Integration Configuration
```json
{
  "ollama_config": {
    "base_url": "http://localhost:11434",
    "model": "llama2",
    "extraction_prompt": "Extract structured facts from the following text...",
    "temperature": 0.3,
    "top_p": 0.9,
    "timeout_seconds": 60
  }
}
```

---

## 6. Migration Strategy
1. **Central DB:** Use existing Drizzle ORM schema
2. **Per-Project DB:** Deploy schema dynamically when project is created
3. **Knowledge DB:** Deploy once during platform initialization
4. **Versioning:** Track schema versions for future migrations
