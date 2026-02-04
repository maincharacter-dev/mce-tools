# Consolidation System Fixes - February 4, 2026

This document describes the fixes implemented to resolve consolidation issues in the Project Ingestion Engine, specifically addressing serverless timeout constraints and weather file processing.

## Overview

The consolidation system was refactored from a single long-running process to a chunked, step-based architecture that works within serverless 5-minute timeout constraints. Additionally, document classification and weather file processing were fixed to properly detect and process TMY weather files from ACC sync.

## Changes Made

### 1. Chunked Consolidation Architecture

**Problem:** The original consolidation process ran as a single operation that could exceed serverless timeout limits (typically 5 minutes), causing failures on projects with many facts.

**Solution:** Implemented a step-based consolidation job system that breaks the process into discrete steps, each completing within 30 seconds.

**Files Modified:**
- `server/consolidation-job-service.ts` (new file)
- `server/routers.ts` (updated consolidate mutation)
- `client/src/pages/FactVerification.tsx` (updated to use polling)

**Consolidation Steps:**
| Step | Description | Progress |
|------|-------------|----------|
| init | Initialize job, load facts | 5% |
| reconcile | Reconcile conflicting facts | 15% |
| narratives | Generate section narratives (2 sections per call) | 50% |
| performance | Extract performance parameters | 65% |
| financial | Extract financial data | 75% |
| weather | Process weather files | 85% |
| location | Consolidate location data | 90% |
| validation | Validate performance modeling readiness | 95% |
| complete | Mark job complete | 100% |

**Database Table:**
```sql
CREATE TABLE consolidation_jobs (
  id VARCHAR(100) PRIMARY KEY,
  project_id INT NOT NULL,
  status ENUM('pending', 'running', 'completed', 'failed'),
  current_step VARCHAR(50),
  progress INT DEFAULT 0,
  step_data JSON,
  error_message TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  completed_at TIMESTAMP
);
```

### 2. Document Classification Fix

**Problem:** Documents synced from ACC were being classified as "OTHER" regardless of their actual type, because the classification function was not being called.

**Solution:** Updated ACC sync to call `classifyDocumentType()` instead of hardcoding "OTHER".

**Files Modified:**
- `server/accRouter.ts` (line ~438)
- `server/accFolderMapping.ts` (enhanced classification patterns)

**New Document Types Added:**
- `WEATHER_FILE` - TMY CSV files, EPW files
- `FEASIBILITY_STUDY` - Feasibility study documents
- `FINANCIAL_MODEL` - Financial model spreadsheets
- `PLANNING` - Planning documents, permits, land krooki, schedules

**Classification Patterns:**
| Document Type | Detection Patterns |
|--------------|-------------------|
| WEATHER_FILE | `.epw` extension, `tmy_` prefix, `weather` in name, coordinate patterns |
| FEASIBILITY_STUDY | `feasibility` in name (before grid study check) |
| PLANNING | `planning`, `permit`, `approval`, `environmental`, `krooki`, `land`, `schedule` |
| GRID_STUDY | `grid`, `connection`, `interconnection` |
| CONTRACT | `ppa`, `epc`, `contract`, `agreement` |

### 3. Weather File Processing Fix

**Problem:** Weather files classified as WEATHER_FILE in the documents table were not being detected during consolidation because:
1. The query used wrong column names (`file_name` vs `fileName`)
2. The INSERT statement was missing required NOT NULL columns (`file_key`, `source_type`)

**Solution:** 
1. Fixed query to use correct camelCase column names matching the schema
2. Added all required columns to the INSERT statement

**Files Modified:**
- `server/consolidation-job-service.ts` (weather step, lines ~720-790)

**Weather File Detection Query:**
```sql
SELECT id, filePath as file_url, fileName as file_name, fileSizeBytes as file_size_bytes, 'documents' as source_table 
FROM documents 
WHERE documentType = 'WEATHER_FILE'
OR (
  (fileName LIKE '%.csv' OR fileName LIKE '%.epw')
  AND (fileName LIKE '%tmy%' OR fileName LIKE '%weather%' OR fileName LIKE '%meteo%')
)
```

**Weather Files INSERT (Fixed):**
```sql
INSERT INTO weather_files (
  id, project_id, file_key, file_url, file_name, file_size_bytes,
  source_type, source_document_id, original_format,
  monthly_irradiance, annual_summary, parsed_location,
  latitude, longitude, elevation, status, is_active,
  created_at, updated_at
) VALUES (...)
```

### 4. JSON Parsing Fix

**Problem:** The consolidation job service was trying to `JSON.parse()` the `step_data` column, but MySQL's JSON column type already returns parsed objects.

**Solution:** Added type check before parsing:
```typescript
const stepData = job.step_data && typeof job.step_data === 'string' 
  ? JSON.parse(job.step_data) 
  : job.step_data;
```

## Testing

### Unit Tests Added
- `server/accFolderMapping.test.ts` - Tests for document classification patterns

### Manual Testing Performed
- Tested consolidation on project 330004 with 284 facts
- Verified weather file (TMY CSV) is detected and processed
- Verified weather file appears on Performance Validation page
- Verified all consolidation steps complete without timeout

## Migration Notes

For existing projects with documents already synced from ACC:

1. **Re-sync from ACC** to apply new classification logic, OR
2. **Manually update document types** using SQL:
   ```sql
   UPDATE documents SET documentType = 'WEATHER_FILE' 
   WHERE fileName LIKE '%tmy%' OR fileName LIKE '%.epw';
   ```

3. **Clear old consolidation jobs** before re-running:
   ```sql
   DELETE FROM consolidation_jobs WHERE project_id = ?;
   ```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (FactVerification.tsx)               │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │ Click       │───▶│ Poll every  │───▶│ Show        │         │
│  │ Consolidate │    │ 500ms       │    │ Progress    │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (routers.ts)                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ consolidate mutation                                      │   │
│  │  1. createOrGetJob(projectId)                            │   │
│  │  2. processNextStep(job)                                 │   │
│  │  3. Return { done, progress, currentStep }               │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Consolidation Job Service                           │
│  ┌──────┐ ┌───────────┐ ┌────────────┐ ┌─────────────┐        │
│  │ init │▶│ reconcile │▶│ narratives │▶│ performance │        │
│  └──────┘ └───────────┘ └────────────┘ └─────────────┘        │
│                                              │                   │
│  ┌───────────┐ ┌──────────┐ ┌────────────┐  │                   │
│  │ financial │◀│ weather  │◀│  location  │◀─┘                   │
│  └───────────┘ └──────────┘ └────────────┘                      │
│        │                                                         │
│        ▼                                                         │
│  ┌────────────┐ ┌──────────┐                                    │
│  │ validation │▶│ complete │                                    │
│  └────────────┘ └──────────┘                                    │
└─────────────────────────────────────────────────────────────────┘
```

## Related Files

| File | Purpose |
|------|---------|
| `server/consolidation-job-service.ts` | Main consolidation job logic |
| `server/routers.ts` | tRPC endpoints for consolidation |
| `server/accRouter.ts` | ACC sync with document classification |
| `server/accFolderMapping.ts` | Document type classification |
| `server/weather-file-extractor.ts` | TMY/EPW file parsing |
| `client/src/pages/FactVerification.tsx` | Frontend consolidation UI |
| `client/src/pages/PerformanceValidation.tsx` | Weather file display |

## Author

**Manus AI** - February 4, 2026
