# Project Intake & Ingestion Engine - TODO

## Phase 1: Foundation & Database Design
- [x] Design central OE database schema (projects, users, knowledge base)
- [x] Design per-project database schema (documents, facts, red flags, verification)
- [x] Design knowledge database schema (deidentified facts, risk archetypes)
- [x] Document local file storage strategy and directory structure
- [x] Design Ollama integration for LLM processing

## Phase 2: Project Management & Database Provisioning
- [x] Implement project creation endpoint with per-project DB provisioning
- [x] Implement project database schema deployment (auto-migration)
- [x] Implement project listing and detail views
- [ ] Implement project deletion with data cleanup
- [x] Create project management dashboard

## Phase 3: Document Upload Interface
- [x] Build document upload page with drag-and-drop support
- [x] Implement file validation (PDF, DOCX, XLSX, etc.)
- [x] Implement local file storage (create project-specific directories)
- [x] Add document type classification (IM, DD Pack, Contract, Grid Study, etc.)
- [ ] Create placeholder UI for Google Drive integration
- [ ] Create placeholder UI for SharePoint integration
- [ ] Create placeholder UI for ACC integration

## Phase 4: Hybrid Document Processing Pipeline
- [ ] Implement PDF text extraction (pdf2pic, tesseract for OCR)
- [ ] Implement DOCX text extraction
- [ ] Implement XLSX text extraction
- [x] Implement deterministic fact extraction (regex patterns for dates, numbers, document numbers)
- [x] Integrate Ollama for LLM-based extraction
- [x] Implement fact consolidation and deduplication
- [x] Implement confidence scoring for extracted facts
- [ ] Create processing status tracking and progress UI

## Phase 5: Project Fact Base & Verification
- [ ] Implement facts table and queries
- [ ] Build fact verification interface
- [ ] Implement user approval workflow for facts
- [ ] Create fact search and filtering
- [ ] Implement fact history and audit trail
- [ ] Build fact categorization (Technology, Assumption, Parameter, Dependency)

## Phase 6: Red-Flag Detection Engine
- [ ] Define red-flag rules and archetypes
- [ ] Implement red-flag trigger logic
- [ ] Create red-flag severity classification
- [ ] Build red-flag dashboard and alerts
- [ ] Implement evidence gap tracking
- [ ] Create red-flag mitigation workflow

## Phase 7: Project Dashboard & Status Tracking
- [ ] Build main dashboard with project overview
- [ ] Implement ingestion status tracking
- [ ] Create fact extraction progress visualization
- [ ] Build red-flag summary and alerts
- [ ] Implement document processing queue
- [ ] Create project statistics and metrics

## Phase 8: Export Functionality
- [ ] Implement PDF export for Project Definition Reports (PDR)
- [ ] Implement Word/DOCX export for PDR
- [ ] Implement Excel/XLSX export for fact data
- [ ] Create PDR template with standard sections
- [ ] Implement export scheduling and background jobs

## Phase 9: De-identification & Knowledge Database
- [ ] Implement de-identification pipeline
- [ ] Create knowledge database schema
- [ ] Implement fact aggregation and anonymization
- [ ] Build benchmarking and precedent database
- [ ] Create knowledge base UI for browsing precedents

## Phase 10: Testing & Deployment
- [ ] Write unit tests for document processing
- [ ] Write integration tests for database provisioning
- [ ] Write tests for red-flag detection logic
- [ ] Set up CI/CD pipeline
- [ ] Create deployment documentation
- [ ] Test with sample project documents

## Future Enhancements
- [ ] Google Drive API integration (rclone-based)
- [ ] SharePoint integration (rclone-based)
- [ ] ACC (Autodesk Construction Cloud) integration
- [ ] Real-time collaboration features
- [ ] Advanced analytics and reporting
- [ ] Machine learning model training on precedent data

## UI Alignment with OE Toolkit
- [x] Analyze OE Toolkit Home.tsx design and layout
- [x] Implement matching navigation and header structure
- [x] Create landing page with tool cards matching OE Toolkit style
- [x] Update color scheme and gradients to match OE Toolkit
- [x] Implement card hover effects and animations from OE Toolkit
- [x] Update typography and spacing to match OE Toolkit
- [x] Ensure consistent iconography with OE Toolkit

## Document Text Extraction Implementation
- [x] Analyze Solar Analyzer document extraction patterns
- [x] Install PDF parsing libraries (pdf-parse, pdf2json)
- [x] Install DOCX parsing libraries (mammoth)
- [x] Install XLSX parsing libraries (xlsx)
- [x] Implement PDF text extraction service
- [x] Implement DOCX text extraction service
- [x] Implement XLSX text extraction service
- [x] Add OCR support for scanned PDFs (tesseract.js)
- [ ] Create document processing queue system
- [ ] Implement extraction progress tracking
- [ ] Add extracted text storage to project database

## Ollama Integration
- [ ] Review Solar Analyzer Ollama implementation
- [ ] Create Ollama configuration table in central DB
- [ ] Implement Ollama connection service
- [ ] Create admin interface for Ollama settings
- [ ] Implement LLM model selection
- [ ] Create extraction prompt templates
- [ ] Implement fact extraction via Ollama
- [ ] Add confidence scoring logic
- [ ] Implement source tracking for extracted facts

## Fact Verification Dashboard
- [ ] Design fact verification UI (similar to Solar Analyzer)
- [ ] Create fact listing page with filters
- [ ] Implement fact detail view with source references
- [ ] Add approve/reject actions
- [ ] Implement bulk approval workflow
- [ ] Add confidence score visualization
- [ ] Create fact editing interface
- [ ] Implement fact history tracking

## OE Toolkit Restructuring
- [x] Analyze current 19 tool structure and identify workflow groupings
- [x] Design integrated workflow presentation (TA/TDD, OE Delivery, Performance)
- [x] Create better names and descriptions for workflow stages
- [x] Update OE Toolkit Home.tsx with workflow-based layout
- [x] Update Project Ingestion Engine branding to reflect its role
- [x] Ensure consistency between OE Toolkit and individual tool branding

## Document Processing Integration
- [x] Create tRPC endpoint for document upload
- [x] Integrate document-extractor into upload flow
- [x] Integrate document-processor-v2 for fact extraction
- [ ] Add processing queue and status tracking
- [ ] Implement error handling and retry logic
- [ ] Add processing progress indicators in UI

## Fact Verification Dashboard
- [x] Create fact verification page route
- [x] Build fact list view with filtering and sorting
- [ ] Implement fact detail view with source context
- [x] Add approve/reject/edit actions for facts
- [x] Create confidence score visualization
- [ ] Implement bulk actions (approve all, reject all)
- [ ] Add fact history and audit trail
- [ ] Create export functionality for verified facts

## Ollama Configuration UI
- [x] Create Ollama configuration page route
- [x] Build Ollama server connection settings form (URL, API key)
- [x] Implement model selection dropdown (fetch available models from Ollama)
- [ ] Add extraction prompt templates for different document types
- [x] Create test connection functionality
- [x] Implement configuration save/update endpoints
- [x] Add configuration validation and error handling

## Document Processing Status Tracking
- [ ] Create processing_jobs table in per-project database
- [ ] Implement job status tracking (queued, processing, completed, failed)
- [ ] Add real-time progress updates using polling or websockets
- [ ] Build processing status UI component with progress bars
- [ ] Implement estimated completion time calculation
- [ ] Add retry functionality for failed jobs
- [ ] Create processing history view

## Red-Flag Detection Engine
- [ ] Design red-flag rules schema (category, condition, severity)
- [ ] Implement planning gap detection rules
- [ ] Implement grid integration risk detection rules
- [ ] Implement geotech issue detection rules
- [ ] Create red-flag evaluation engine
- [ ] Add red-flag storage to per-project database
- [ ] Implement red-flag severity scoring (critical, high, medium, low)
- [ ] Create red-flag alert notifications

## Red-Flag Dashboard
- [ ] Create red-flag dashboard page route
- [ ] Build red-flag list view with filtering by severity and category
- [ ] Implement red-flag detail view with source facts
- [ ] Add red-flag resolution workflow (acknowledge, resolve, dismiss)
- [ ] Create red-flag summary cards and statistics
- [ ] Implement red-flag export functionality
- [ ] Add red-flag trend analysis over time

## Export Functionality
- [ ] Install PDF generation libraries (pdfkit, jspdf)
- [ ] Install Word generation libraries (docxtemplater, officegen)
- [ ] Implement PDR PDF export with template
- [ ] Implement PDR Word export with template
- [ ] Implement fact base Excel export
- [ ] Add export buttons to fact verification and red-flag dashboards
- [ ] Implement export history tracking

## Dummy Data Workflow
- [x] Create dummy data generation service with realistic renewable energy project data
- [x] Generate sample documents (IM, DD Pack, Grid Study, Contract)
- [x] Generate sample extracted facts with various confidence scores
- [x] Generate sample red flags (planning gaps, grid risks, geotech issues)
- [x] Generate sample processing jobs with different statuses
- [x] Create simulation button in ProjectDashboard
- [x] Implement workflow orchestration (create project → upload docs → process → extract facts → detect red flags)
- [ ] Add progress indicators during simulation
- [ ] Test complete workflow end-to-end

## Demo Button Bug Fix
- [ ] Fix SQL INSERT statements in demo router to use proper parameter binding instead of string interpolation
- [ ] Test demo button with actual project
- [ ] Verify all dummy data is inserted correctly (documents, facts, red flags, processing jobs)

## TA/TDD/Pre-FC Brief Alignment
- [ ] Fix demo button to use multi-tenant Drizzle ORM inserts
- [ ] Analyze current implementation against 7-stage TA workflow
- [ ] Create capability map showing what exists vs what's needed
- [ ] Identify which tools can be reused vs need modification
- [ ] List new tools that must be built
- [ ] Create phased implementation plan (Day-1, Short-term, Later)
- [ ] Document human gates and judgement-assisting vs automated features
- [ ] Ensure PDR generator supports required sections
- [ ] Implement red-flag trigger logic with evidence links
- [ ] Build risk register framework with cause-event-impact structure
- [ ] Implement FC readiness signals (not scores)
- [ ] Add contract parsing and risk coverage mapping (if in scope)

## Demo Button Bug Fix (Completed)
- [x] Fix Drizzle ORM insert syntax in demo router - parameters being flattened instead of passed as array of objects
- [x] Test demo button after fix and verify all data inserts correctly
- [x] Root cause: TiDB Serverless HTTP driver parameter binding bug - used sql.raw() to bypass
- [x] Added DELETE statements before INSERT to handle duplicate keys

## Project Context Routing Bug (Completed)
- [x] Fix project card button navigation - clicking Upload/Facts/Processing Status shows "no project loaded"
- [x] Investigate how project ID should be passed from ProjectList to detail pages
- [x] Ensure project context is properly loaded on Upload, Facts, and Processing Status pages
- [x] Root cause: wouter's useLocation() returns only pathname, not query params - fixed by using window.location.search
- [x] Updated Facts and Processing Status pages to fetch project details first, then use dbName for queries

## Table Name Mismatch Bug (Completed)
- [x] Fix Facts page query - looking for extracted_facts table but demo data creates facts table
- [x] Check schema definition and ensure consistent table naming
- [x] Verify demo data inserts into correct table
- [x] Root cause: db-project-schema.sql created 'facts' table but code references 'extracted_facts'
- [x] Updated db-project-schema.sql to use 'extracted_facts' with correct column names
- [x] Added projects.resetDatabase endpoint to recreate project databases with updated schema
- [x] Added Reset DB button to project cards for easy database reset

## Column Name Mismatch Bug (Completed)
- [x] Fix Facts query - using confidence_score but schema defines confidence column
- [x] Find all SQL queries that reference confidence_score and update to confidence
- [x] Verify Facts page loads correctly after fix
- [x] Updated routers.ts line 231 to use confidence instead of confidence_score

## SSL Connection Error in Reset DB (Completed - Feature Removed)
- [x] Fix resetDatabase endpoint - TiDB requires SSL but connection config missing ssl option
- [x] Add SSL configuration to database connection in resetDatabase mutation
- [x] Discovered TiDB Serverless doesn't allow DROP DATABASE - removed Reset DB feature
- [x] Users can create new projects instead of resetting existing ones

## MySQL Server Setup for Local Development (Current Issue)
- [ ] Install and configure local MySQL server in sandbox
- [ ] Update DATABASE_URL to point to local MySQL instead of TiDB Serverless
- [ ] Run Drizzle migrations to create main database schema
- [ ] Test project creation with separate database provisioning
- [ ] Test demo data loading with local MySQL
- [ ] Verify separate database per project architecture works correctly

## Per-Project Database Table Creation Bug (FIXED)
- [x] Verify project-db-provisioner.ts creates tables after creating database
- [x] Check if db-project-schema.sql is being executed during provisioning
- [x] Fix demo data INSERT to match actual schema column names
- [x] Test demo button loads all data successfully
- [x] Fixed DATABASE_URL override issue (was using TiDB Serverless instead of local MySQL)
- [x] Fixed SQL statement parsing in provisioner (removed comment filtering bug)
- [x] Fixed demo router to use raw mysql2 connection instead of Drizzle
- [x] Fixed table names (red_flags → redFlags) and severity capitalization
- [x] Verify Facts page displays demo data correctly
- [x] Fixed Processing Status page query (fileName column name)
- [x] All demo data loading and displaying correctly!

## Document Upload Functionality (COMPLETED)
- [x] Create backend upload endpoint with base64 file data support
- [x] Implement file validation (PDF, DOCX, XLSX, max size 50MB)
- [x] Store uploaded files in local filesystem with project-specific directories
- [x] Save document metadata to per-project database (documents table)
- [x] Build frontend upload UI with drag-and-drop zone
- [x] Add file type selection dropdown (IM, DD_PACK, CONTRACT, GRID_STUDY, CONCEPT_DESIGN, OTHER)
- [x] Implement upload progress indicator
- [x] Add file list display showing uploaded documents
- [x] Test upload with sample PDF files
- [x] Verify documents appear in database and filesystem
- [x] Fixed DATA_DIR path to use writable location (/home/ubuntu/project-ingestion-engine/data/projects)
- [x] Fixed documentType enum values to match backend (all uppercase)
- [x] Fixed projectId handling (numeric ID vs "proj_" prefix)
- [x] Fixed database connection to query dbName from projects table
- [x] Fixed SQL parameterized queries to prevent SQL injection

## Documents List View (COMPLETED)
- [x] Create backend endpoint to list documents for a project
- [x] Build Documents page UI with cards showing fileName, documentType, status, uploadDate, fileSize
- [x] Add Documents navigation button to project cards
- [x] Add route for /project/:id/documents
- [x] Fixed SQL query parameter binding in documents.list endpoint
- [ ] Implement document download action (UI ready, backend TODO)
- [ ] Implement document delete action (UI ready, backend TODO)
- [x] Show document processing status (Uploaded, Processing, Processed, Error)

## Document Processing Pipeline (COMPLETED)
- [x] Enable processDocument call in upload endpoint (routers.ts line 111)
- [x] Update processDocument to accept string UUID documentId
- [x] Test document text extraction with uploaded PDF
- [x] Processing pipeline working (text extraction via OCR, deterministic patterns)
- [x] Ollama LLM extraction requires separate Ollama installation
- [ ] Install and configure Ollama for LLM-based fact extraction (optional)
- [ ] Verify extracted facts appear in Facts page (requires Ollama)
- [ ] Test processing status tracking
- [x] Handle processing errors gracefully

## AI Document Type Detection & Upload Improvements (Current)
- [ ] Switch upload endpoint from base64 JSON to multipart/form-data for large files (75MB+)
- [ ] Update frontend to use FormData for file uploads instead of base64 encoding
- [ ] Implement AI document type detection using LLM (analyze title and first page)
- [ ] Add document type editing UI on Documents page
- [ ] Create backend endpoint to update document type
- [ ] Test upload with 75MB+ files
- [ ] Test AI categorization accuracy with sample documents
- [ ] Add loading indicator during AI categorization

## AI Document Type Detection & Upload Improvements (COMPLETED)
- [x] Increase JSON payload limit to 100MB for larger file uploads
- [x] Implement AI document type detection using LLM
- [x] Add "Auto-detect (AI)" option to upload form (default selection)
- [x] Update upload endpoint to call AI detection when type is AUTO
- [x] Test AI categorization with sample IM document
- [x] Verified AI correctly identifies document types from filename and content
- [x] AI detection working: analyzed "test_IM_document.pdf" and correctly detected as "IM"
- [x] Edit document type functionality working (can change category after upload)
- [x] Reverted from multipart/form-data to base64 upload (simpler, more reliable)
- [ ] Test large file upload (50MB+) - requires actual large file

## Document Processing Pipeline Review & Improvements (Current)
- [ ] Analyze current document-processor-v2.ts implementation
- [ ] Check text extraction errors (pdf-parse issues in logs)
- [ ] Review fact extraction logic (deterministic + Ollama)
- [ ] Verify extracted facts are being stored in database
- [ ] Check processing status updates in processing_jobs table
- [ ] Test with uploaded documents and verify Facts page shows results
- [ ] Fix any errors preventing successful processing
- [ ] Add better error handling and logging
- [ ] Improve extraction quality for different document types

## Document Processing Pipeline Review (COMPLETED)
- [x] Fixed PDF extraction (pdf-parse import issue - switched to PDFParse class)
- [x] Fixed fact storage to database (schema column names: source_document_id, key, value, extraction_method)
- [x] Verified deterministic fact extraction working (capacity, voltage, technology)
- [x] Verified facts display on Facts page (15 total facts showing correctly)
- [x] Processing pipeline fully functional: upload → extract text → extract facts → save to DB
- [x] Confirmed 5 facts extracted and saved from test document (150 MW, 120 MW, 1000 MW, 132 kV, solar)
- [ ] Fix "NaN" average confidence display (confidence stored as string not number)
- [ ] Fix Facts table display (Key column showing empty, values in wrong columns)

## Intelligent LLM-Powered Fact Extraction (Current)
- [ ] Design extraction architecture with multi-pass strategy
- [ ] Implement LLM-powered structured extraction with JSON schema output
- [ ] Create fact category definitions (Project_Identity, Technical_Specifications, Grid_Connection, Site_Characteristics, Timeline, Energy_Performance, Regulatory, Risks, Financial, Dependencies)
- [ ] Implement First Pass: Structured data extraction (key-value pairs with categories)
- [ ] Implement Second Pass: Relationship extraction (dependencies, constraints)
- [ ] Implement Third Pass: Risk identification (red flags, challenges, gaps)
- [ ] Implement Fourth Pass: Assumption extraction (design parameters, estimates)
- [ ] Add document-type-specific extraction strategies (IM vs Grid Study vs DD Pack)
- [ ] Test with Marsa Solar Feasibility PDF (should extract 40+ facts vs current 5)
- [ ] Verify facts include ownership structure, site relocation history, study schedules, etc.

## Intelligent LLM-Powered Fact Extraction (COMPLETED - Jan 23, 2026)

- [x] Implement multi-pass LLM extraction system with structured JSON output
- [x] Pass 1: Extract structured data (project identity, technical specs, grid connection, site details, timeline)
- [x] Pass 2: Extract relationships and dependencies between facts
- [x] Pass 3: Extract risks and red flags
- [x] Pass 4: Extract assumptions and design parameters
- [x] Integrate intelligent extractor into document processor
- [x] Test with Marsa Solar Feasibility PDF (1.2 MB, 9 pages)
- [x] Results: 89 total facts extracted (79 LLM + 13 deterministic, deduplicated)
  - Pass 1: 44 structured facts
  - Pass 2: 8 relationship facts
  - Pass 3: 10 risk facts
  - Pass 4: 17 assumption facts
- [x] Extraction time: 29.6 seconds for comprehensive analysis
- [x] 18x improvement over basic extraction (89 facts vs 5 facts)
- [x] Facts displayed correctly in Facts page (114 total including demo data)
- [x] Categories include: Project_Identity, Technical_Specifications, Grid_Connection, Site_Characteristics, Timeline, Dependencies, Risks, Financial, Regulatory, Technology_Choice, Design_Parameters, Performance_Estimate, Engineering_Assumption

**Key Achievements:**
- Comprehensive fact extraction covering all document aspects
- Structured output with proper categorization
- Risk and dependency identification
- Timeline and milestone extraction
- Technical specification capture
- Financial and regulatory information extraction

## Structured Contextual Fact Extraction (Current - Jan 23, 2026)

**Problem**: Current extraction produces disconnected data points without context (e.g., "7 Aug 2025" under Timeline, "51%" under Financial)

**Solution**: Restructure extraction to produce meaningful, contextual information organized into coherent sections

- [ ] Redesign extraction prompts to produce full sentences with context
  - Instead of: "Timeline: 7 Aug 2025"
  - Produce: "ESIA Scoping completion scheduled for 7 Aug 2025"
- [ ] Implement hierarchical fact relationships (parent-child structure)
  - Example: "Grid Connection" → "Primary: 132kV LILO at Clare Substation" → "Future: 400kV line 4km away"
- [ ] Create section-based organization
  - Project Overview (name, location, partners, ownership)
  - Technical Design (capacity, technology, configuration)
  - Timeline & Milestones (key dates with descriptions)
  - Financial Structure (ownership %, investment, revenue model)
  - Grid Connection (voltage levels, distances, connection points)
  - Site Characteristics (area, topography, access, constraints)
  - Risks & Issues (identified risks with severity and mitigation)
  - Regulatory & Approvals (permits, studies, compliance)
  - Dependencies & Assumptions (critical dependencies, design assumptions)
- [ ] Update database schema to support hierarchical facts
  - Add parent_fact_id column for fact relationships
  - Add section column for grouping
  - Add statement column for full contextual sentence
- [ ] Update Facts page UI to display hierarchical structure
  - Group facts by section
  - Show parent-child relationships
  - Display full contextual statements instead of key-value pairs
- [ ] Test with Marsa Solar PDF and verify structured output
- [ ] Generate Project Summary document from structured facts

## Structured Contextual Fact Extraction (COMPLETED)
- [x] Redesign extraction prompts to produce complete sentences with full context
- [x] Replace disconnected key-value pairs with self-contained statements
- [x] Organize facts into meaningful sections (Project_Overview, Financial_Structure, Technical_Design, etc.)
- [x] Test with Marsa Solar PDF - 72 contextual facts extracted
- [x] Verified facts read like structured brief instead of database dump
- [x] Example improvements:
  * OLD: "51%" → NEW: "OQAE holds a 51% stake in the Marsa Solar Project joint venture"
  * OLD: "14/05/2025" → NEW: Facts now include milestone context
  * OLD: "300 MW" → NEW: Capacity facts include DC/AC distinction and purpose

## Structured Facts Page UI Redesign (Current)
- [ ] Group facts by section (Project_Overview, Financial_Structure, Technical_Design, etc.)
- [ ] Implement collapsible section panels with expand/collapse all
- [ ] Display full contextual statements instead of key-value table
- [ ] Add section summaries (fact count, avg confidence, pending vs approved)
- [ ] Show confidence scores with visual indicators (badges, progress bars)
- [ ] Add section-level filtering (show/hide specific sections)
- [ ] Implement search across all fact statements
- [ ] Add verification status badges (Pending, Approved, Rejected)
- [ ] Show extraction method and source document for each fact
- [ ] Test with Marsa Solar facts (72 facts across 10+ sections)

## Facts Page UI Redesign (Completed 2026-01-23)
- [x] Replace flat table view with structured section grouping
- [x] Implement collapsible panels for each category/section
- [x] Display complete contextual statements prominently (not key-value pairs)
- [x] Add section summaries showing fact count and average confidence per section
- [x] Implement search functionality filtering by fact statement text
- [x] Implement status filter dropdown (All Statuses / Pending / Approved / Rejected)
- [x] Add Expand All / Collapse All controls
- [x] Show verification status badges (pending/approved/rejected) per fact
- [x] Display confidence badges with color coding (green/yellow/orange/red)
- [x] Add approve/reject buttons for individual facts
- [x] Test with Marsa Solar facts (186 facts across 44 sections)
- [ ] Add bulk approve/reject actions per section
- [ ] Implement section name normalization to consolidate similar categories
- [ ] Add document source linking (click fact to see source document)
- [ ] Add export functionality (export facts to Excel/PDF)

## Section Name Normalization & Red Flags Dashboard (Completed 2026-01-23)
- [x] Implement section name normalization mapping to consolidate similar categories
- [x] Map variations to canonical names (e.g., "Risks"/"Risk"/"Risks And Issues" → "Risks_And_Issues")
- [x] Update Facts page to use normalized section names
- [x] Create Red Flags dashboard page route
- [x] Build Red Flags list view with severity classification
- [x] Implement risk filtering by severity (Critical/High/Medium/Low)
- [x] Add risk category grouping (Planning/Grid/Geotech/Timeline/etc)
- [x] Display risk statements with source document links
- [x] Add risk resolution workflow (Acknowledge/Dismiss)
- [x] Create risk summary statistics cards
- [x] Test with Marsa Solar risk facts (18 risks: 7 critical, 2 high, 8 medium, 1 low)
- [x] Add Red Flags button to project cards
- [x] Consolidate 44 fragmented sections into 6 canonical categories
- [x] Add section descriptions and display names to Facts page

## UX Improvements - Processing Status & Facts Presentation (Partially Complete)
- [x] Enhanced Processing Status Dashboard
  - [x] Show document name being processed
  - [x] Display current processing stage (text_extraction → deterministic_extraction → llm_extraction → saving_facts → completed)
  - [x] Add progress percentage indicator (0% → 10% → 30% → 50% → 80% → 90% → 100%)
  - [x] Show timestamps (started, estimated completion)
  - [x] Display processing errors with details
  - [x] Create processing_jobs record on document upload
  - [x] Update job status with progress callbacks
  - [x] Handle failed jobs with error messages
- [ ] Dual-mode Facts Presentation (In Progress)
  - [x] Add section-level presentation mode configuration (narrative vs itemized)
  - [x] Create narrative synthesis endpoint in backend (facts.synthesizeNarrative)
  - [ ] Implement narrative mode UI for overview sections (Project Overview, Financial Structure, Technical Design)
  - [ ] Use LLM to synthesize facts into flowing paragraphs on section expand
  - [ ] Keep itemized mode for actionable sections (Risks & Issues, Dependencies, Engineering Assumptions)
  - [ ] Add "View Details" toggle to switch between narrative and itemized view
- [x] Improved Fact Editing UX
  - [x] Replace single-line input with multi-line textarea
  - [x] Add proper height for long contextual statements (min-h-[120px])
  - [x] Add character count indicator
  - [ ] Consider markdown support for formatted text (future enhancement)
- [ ] Enhanced Approval Workflow
  - [x] Better visual feedback for approve/reject actions (existing badges work well)
  - [x] Show approval status badges (Pending/Approved/Rejected)
  - [ ] Display who approved and when (requires schema change)
  - [ ] Add bulk approval buttons per section
  - [ ] Add approval history/audit trail (requires new table)

## Rebranding & Narrative Synthesis UI (Completed 2026-01-23)
- [x] Rebrand "Facts" to "Insights" throughout application
  - [x] Update page titles and headers ("Project Insights", "Total Insights", etc.)
  - [x] Update navigation labels ("Insights" button in project cards)
  - [x] Update database table/column references in UI (kept backend table names unchanged)
  - [x] Update button labels and tooltips ("Edit Insight", "Search Insights", etc.)
  - [x] Update route names and URLs (/facts → /insights)
  - [x] Update Home page descriptions ("Project Intelligence Base")
- [x] Complete narrative synthesis UI
  - [x] Add mutation hook for facts.synthesizeNarrative
  - [x] Implement unified narrative rendering for all narrative-mode sections (Project Overview, Financial Structure, Technical Design)
  - [x] Add loading state while synthesizing narrative ("Synthesizing narrative from X insights...")
  - [x] Add "View Details" toggle to switch between narrative and itemized view
  - [x] Cache synthesized narratives in component state to avoid re-generating
  - [x] Automatic synthesis on section expand for narrative-mode sections
  - [x] Fallback to itemized view if synthesis fails

## Narrative Synthesis Bug Fix (In Progress)
- [ ] Debug why narrative synthesis hangs when expanding sections
- [ ] Check browser console for errors
- [ ] Verify backend synthesizeNarrative endpoint receives requests
- [ ] Check if LLM invocation is working correctly
- [ ] Test with actual project data
- [ ] Fix identified issues

## Narrative Pre-generation & Toggle UX Fix (Completed 2026-01-23)
- [x] Add database schema for storing section narratives
- [x] Create section_narratives table with columns: id, project_db_name, section_name, narrative_text, created_at, updated_at
- [x] Implement narrative pre-generation in document processor
- [x] Add Pass 6 to extraction pipeline: "Generating narratives" (92%)
- [x] Generate narratives for Project Overview, Financial Structure, Technical Design after facts are saved
- [x] Store narratives in section_narratives table
- [x] Update processing progress tracking to show narrative generation stage
- [x] Fix narrative/insights toggle UX
- [x] Remove error message when clicking "View individual insights"
- [x] Show narrative at top with individual insights below when toggled
- [x] Add "Hide individual insights" button to collapse back to narrative-only view
- [x] Load pre-generated narratives from database via facts.getNarratives endpoint
- [x] Replace on-demand synthesis with pre-generated narratives
- [ ] Test complete workflow with document upload

## Delete & Accept Functionality (Completed 2026-01-23)
- [x] Implement project delete functionality
  - [x] Add projects.delete backend endpoint
  - [x] Drop per-project database on delete
  - [x] Delete project record from main database
  - [x] Delete associated narratives from section_narratives table
  - [x] Add delete button to project cards with confirmation dialog
  - [x] Handle delete errors gracefully with toast notifications
  - [x] Styled delete button with red theme to indicate destructive action
- [x] Implement document delete functionality
  - [x] Add documents.delete backend endpoint
  - [x] Delete document file from filesystem
  - [x] Delete document record from project database
  - [x] Delete associated facts (extracted_facts table)
  - [x] Delete associated processing jobs (processing_jobs table)
  - [x] Add delete button to document list (trash icon)
  - [x] Add confirmation dialog for document deletion with warning message
- [x] Verify and enhance insight accept/reject functionality
  - [x] Ensure approve/reject buttons update verification_status correctly (already working)
  - [x] Add visual feedback when status changes (toast notifications)
  - [x] Update section statistics after status change (automatic refetch)
  - [x] Approve/reject buttons styled with green/red themes

## Bug Fixes - SSL & SQL Errors (Completed 2026-01-23)
- [x] Fix SSL certificate error in database connections
  - [x] Set rejectUnauthorized: false in deleteProjectDatabase SSL config
  - [x] Allows connection to databases with self-signed certificates
- [x] Fix SQL parameter binding in getNarratives query
  - [x] Added logic to fetch project dbName before querying section_narratives
  - [x] Fixed parameter mismatch (was using projectId instead of project_db_name)

## Bug Fix - Project Delete SQL Error (Completed 2026-01-23)
- [x] Fix SQL parameter binding in projects.delete endpoint
  - [x] Removed unnecessary parseInt() since input.projectId is already a number
  - [x] Used template literal for SQL query (matching pattern from other queries)

## Bug Fix - NaN Error in getNarratives (Completed 2026-01-23)
- [x] Fix parseInt usage in getNarratives query
  - [x] Discovered frontend passes project_db_name (string like "proj_1_1769157846333") not numeric projectId
  - [x] Removed unnecessary project lookup and parseInt() call
  - [x] Query section_narratives directly using input.projectId as project_db_name

## Parameter Standardization & Performance Optimization (In Progress)
- [ ] Standardize projectId parameter naming
  - [ ] Audit all endpoints using projectId parameter
  - [ ] Rename to projectNumericId when expecting number
  - [ ] Rename to projectDbName when expecting database name string
  - [ ] Update frontend calls to match new parameter names
  - [ ] Add zod validation for correct types
- [x] Debug and optimize narrative generation performance
  - [x] Fixed SQL query to use template literals instead of parameterized queries
  - [x] Added proper string type checking for narrative content
  - [x] Added error logging for narrative save failures
  - [x] Added character count logging to track narrative generation
  - [x] Narrative generation runs asynchronously after fact extraction (doesn't block upload)
  - [ ] TODO: Add retry logic for failed LLM calls
  - [ ] TODO: Add timeout handling for slow LLM responses
- [x] Implement insight reconciliation system (merge, enrich, detect conflicts) - PARTIALLY COMPLETE
  - [x] Design reconciliation algorithm:
    - [x] Exact match → Update confidence (weighted average)
    - [x] Semantic similarity → Merge and enrich with additional details
    - [x] Conflicting values → Flag as conflict, preserve both versions
    - [x] New information → Add as new insight
  - [x] Update database schema:
    - [x] Add source_documents JSON field to track all contributing documents
    - [x] Add conflict_with field to link conflicting insights
    - [x] Add merged_from JSON field to track insight evolution history
    - [x] Add enrichment_count to track how many documents contributed
    - [x] Add last_enriched_at timestamp field
    - [x] Create insight_conflicts table with resolution workflow
  - [x] Implement similarity matching:
    - [x] Use LLM to compute semantic similarity between insight values
    - [x] Set threshold for exact match (>95%), similar (>70%), different (<70%)
    - [x] Created computeSemanticSimilarity() function
  - [x] Implement confidence scoring:
    - [x] Weighted average when multiple documents agree
    - [x] calculateWeightedConfidence() with enrichment count
    - [x] parseConfidence() to normalize confidence formats
  - [x] Implement insight merging:
    - [x] Combine values from similar insights using LLM (mergeInsightValues)
    - [x] Track all source documents that contributed (source_documents JSON array)
    - [x] Update timestamps to show last enrichment (last_enriched_at)
    - [x] enrichInsight() function to update existing insights
  - [x] Implement conflict detection:
    - [x] Create conflict records linking contradictory insights (insight_conflicts table)
    - [x] createConflict() function to link conflicting insights
    - [x] Update both insights with conflict_with field
    - [x] TODO: Add "Conflicts" section/page to Insights UI (Created /conflicts page)
    - [x] TODO: Show side-by-side comparison with source documents (Two-column layout with sources)
    - [x] TODO: Add conflict resolution workflow (Accept A/B, Merge, Ignore) (All 4 actions implemented)
  - [x] Update UI:
    - [x] Show source document count badges on each insight
    - [x] Add "Enriched X times" indicator with blue badge
    - [x] Add conflict warning icons with red badge
    - [ ] TODO: Add insight evolution timeline/history view
    - [ ] TODO: Add "View Sources" button to see all contributing documents
  - [x] Integration:
    - [x] Integrated reconciliation into document upload pipeline
    - [x] Automatic reconciliation on every document upload
    - [x] Logging of reconciliation stats (inserted/enriched/conflicts)
  - [ ] TODO: Migration for existing databases
    - [ ] Create migration script to add new columns to existing project databases
    - [ ] Backfill source_documents for existing insights

## Conflicts Resolution UI (In Progress)
- [ ] Create backend endpoints for conflicts
  - [ ] conflicts.list - Get all pending conflicts for a project
  - [ ] conflicts.resolve - Resolve a conflict (accept_a, accept_b, merge, ignore)
  - [ ] conflicts.getDetails - Get full details of both conflicting insights
- [ ] Build Conflicts page
  - [ ] Create /conflicts route
  - [ ] List all pending conflicts with summary cards
  - [ ] Side-by-side comparison view for each conflict
  - [ ] Show source documents for each insight
  - [ ] Display confidence scores and enrichment history
  - [ ] Highlight differences between conflicting values
- [ ] Implement resolution actions
  - [ ] "Accept A" - Keep first insight, delete second
  - [ ] "Accept B" - Keep second insight, delete first
  - [ ] "Merge" - Combine both insights using LLM, delete originals
  - [ ] "Ignore" - Mark conflict as ignored, keep both insights
  - [ ] Update conflict resolution_status in database
  - [ ] Show confirmation dialog before resolving
- [ ] Add navigation
  - [ ] Add "Conflicts" button to Project Dashboard cards
  - [ ] Add "View Conflicts" link to Insights page header
  - [ ] Show conflict count badge on navigation items
- [ ] Test workflow
  - [ ] Upload two documents with conflicting information
  - [ ] Verify conflicts are detected and listed
  - [ ] Test each resolution action
  - [ ] Verify insights are updated correctly

## Solar Analyzer Integration & Performance Validation
- [x] Document complete Solar Analyzer integration architecture
- [x] Install PySAM library in Solar Analyzer environment
- [x] Build PySAM-based performance estimation API endpoint (weather data integration pending)
- [ ] Design comprehensive input schema with assumption tracking
- [ ] Implement assumption tracking system (value, source, assumption_basis)
- [ ] Implement confidence scoring based on extracted vs assumed parameters
- [ ] Integrate PVGIS weather API for benchmark data
- [ ] Build weather data comparison logic (project vs benchmark)
- [ ] Create Solar Analyzer client in ingestion engine
- [ ] Integrate performance validation into document processing pipeline
- [ ] Build performance validation results UI
- [ ] Test end-to-end performance validation workflow

## Performance Validation UI
- [x] Create performance_validations table in per-project database schema
- [x] Add backend endpoints for storing/retrieving performance validation results (getByProject, getById, create)
- [x] Create Performance Validation page component
- [x] Build performance metrics summary cards (generation, CF, PR)
- [x] Implement contractor claims comparison visualization
- [x] Add variance analysis with red flag indicators
- [x] Create input summary showing extracted vs assumed parameters
- [x] Build monthly generation profile chart (Recharts bar chart with monthly data)
- [x] Add confidence score visualization (HIGH/MEDIUM/LOW badge + percentage)
- [x] Add "Validate Performance" button to project cards
- [x] Add Performance navigation item (/project/:projectId/performance route)
- [x] Test performance validation workflow end-to-end with mock data
- [x] Fixed snake_case field names from MySQL database (annual_generation_gwh, etc.)
- [x] Verified all visualizations render correctly with real data

## Performance Parameter & Financial Data Extraction (Current - Jan 23, 2026)
- [x] Design database schema for performance_parameters table
  - [ ] System design fields (dc_capacity_mw, ac_capacity_mw, module_model, inverter_model, tracking_type)
  - [ ] Location fields (latitude, longitude, site_name, elevation_m)
  - [ ] Performance assumptions (system_losses_percent, degradation_rate_percent, availability_percent)
  - [ ] Weather data references (weather_file_url, ghi_annual_kwh_m2, dni_annual_kwh_m2)
  - [ ] Contractor claims (p50_generation_gwh, p90_generation_gwh, capacity_factor_percent)
  - [ ] Metadata fields (source_document_id, confidence, extraction_method, created_at)
- [x] Design database schema for financial_data table
  - [ ] CapEx breakdown (total_capex_usd, modules_usd, inverters_usd, trackers_usd, civil_works_usd, grid_connection_usd, development_costs_usd, other_capex_usd)
  - [ ] OpEx breakdown (total_opex_annual_usd, om_usd, insurance_usd, land_lease_usd, asset_management_usd, other_opex_usd)
  - [ ] Normalized metrics (capex_per_watt_usd, opex_per_mwh_usd)
  - [ ] Currency and date fields (currency, exchange_rate_to_usd, cost_year, escalation_rate_percent)
  - [ ] Metadata fields (source_document_id, confidence, extraction_method, created_at)
- [x] Generate Drizzle migrations for new tables
- [x] Apply migrations to project database schema
- [x] Extend LLM extraction prompts to identify performance parameters
  - [ ] Add system design parameter extraction (capacity, equipment specs)
  - [ ] Add location data extraction (coordinates, site details)
  - [ ] Add performance assumption extraction (losses, degradation, availability)
  - [ ] Add weather data reference extraction (TMY files, irradiation values)
  - [ ] Add contractor claim extraction (P50/P90 generation estimates)
- [x] Extend LLM extraction prompts to identify financial data
  - [ ] Add CapEx extraction with category breakdown
  - [ ] Add OpEx extraction with category breakdown
  - [ ] Add currency and date extraction for normalization
  - [ ] Add cost escalation and exchange rate extraction
- [x] Update document processor to save performance parameters
  - [ ] Add Pass 7: Performance parameter extraction
  - [ ] Implement parameter validation and normalization
  - [ ] Store extracted parameters in performance_parameters table
  - [ ] Link parameters to source documents
- [x] Update document processor to save financial data
  - [ ] Add Pass 8: Financial data extraction
  - [ ] Implement cost normalization ($/W, $/MWh calculations)
  - [ ] Store extracted financial data in financial_data table
  - [ ] Handle currency conversion using exchange rates
- [x] Create backend endpoints for performance parameters
  - [ ] Add performance.getParameters endpoint (fetch by project)
  - [ ] Add performance.updateParameter endpoint (manual corrections)
- [x] Create backend endpoints for financial data
  - [ ] Add financial.getData endpoint (fetch by project)
  - [ ] Add financial.updateData endpoint (manual corrections)
- [x] Build Performance Parameters UI page
  - [ ] Create /project/:id/performance-params route
  - [ ] Display extracted system design parameters
  - [ ] Show location and site data
  - [ ] Display performance assumptions
  - [ ] Show contractor claims
  - [ ] Add edit functionality for manual corrections
- [x] Build Financial Data UI page
  - [ ] Create /project/:id/financial route
  - [ ] Display CapEx breakdown with category charts
  - [ ] Display OpEx breakdown with category charts
  - [ ] Show normalized metrics ($/W, $/MWh)
  - [ ] Add comparison with benchmark data (placeholder)
  - [ ] Add edit functionality for manual corrections
- [ ] Test extraction with sample documents (pending - needs document upload)
  - [ ] Test with IM containing performance estimates
  - [ ] Test with DD Pack containing equipment specifications
  - [ ] Test with financial model containing CapEx/OpEx breakdown
  - [ ] Verify parameter accuracy and completeness
  - [ ] Verify financial data accuracy and normalization

## Synthetic Data Population (Current - Jan 24, 2026)
- [x] Create synthetic performance parameters data (realistic solar project specs)
- [x] Create synthetic financial data (CapEx/OpEx breakdown)
- [x] Insert synthetic data into project database
- [x] Test Performance Parameters UI with synthetic data
- [x] Test Financial Data UI with synthetic data

## Weather Data Processing for SAM (Current - Jan 24, 2026)
- [x] Research SAM/PySAM weather file format requirements (SAM CSV format)
- [x] Create weather data converter specifications (PVGIS → SAM CSV)
- [x] Build PVGIS CSV parser and validator
- [x] Build SAM CSV weather file generator
- [x] Create weather data caching system (avoid repeated PVGIS API calls)
- [x] Integrate weather converter into Solar Analyzer API
- [x] Update PySAM API endpoint to use converted weather files
- [x] Test with real PVGIS data for Malta location
- [ ] Add error handling for missing/invalid weather data
- [ ] Document weather data processing workflow

## Smart Multi-Format Weather Data Processor (Current - Jan 24, 2026)
- [x] Design architecture for multi-format weather data detection and conversion
- [x] Build format detection engine (identify PVGIS, TMY3, EPW, PVsyst, SolarAnywhere, custom)
- [x] Implement TMY3 format parser and converter
- [x] Implement EPW format parser and converter
- [ ] Implement PVsyst CSV parser and converter (deferred - uncommon format)
- [ ] Implement SolarAnywhere format parser and converter (deferred - uncommon format)
- [x] Add metadata extraction from various header formats
- [x] Build validation engine (check gaps, outliers, required columns)
- [x] Add quality scoring system for weather data
- [x] Implement fallback to PVGIS API when no file provided
- [x] Integrate smart processor into Solar Analyzer API
- [ ] Test with sample files from each format (need sample files)
- [ ] Document supported formats and conversion logic

## Extraction-to-Validation Pipeline Connection (Current - Jan 24, 2026)
- [x] Design dual-pathway weather data architecture (extraction + manual upload)
- [x] Add weather_files table to database schema (28 fields: file_key, source_type, format, quality_score, location, validation metrics)
- [x] Extend LLM extraction prompts to identify weather file references/URLs in documents (WeatherFileExtractor)
- [x] Build weather file downloader for extracted URLs (downloads and uploads to S3)
- [x] Store extracted weather files in S3 with metadata in database (weather_files table)
- [x] Create auto-trigger logic: run validation when parameters + weather data complete (ValidationTrigger)
- [x] Build backend endpoint for manual weather file upload (trpc.weatherFiles.upload)
- [x] Add weather file upload UI component to Performance Validation page (WeatherFileUpload)
- [x] Implement weather file selection (choose between extracted vs manual) - is_active flag
- [ ] Add validation status tracking (pending, running, complete, failed) - schema ready, Solar Analyzer integration pending
- [ ] Test automatic pathway with document containing weather file reference (need sample document)
- [ ] Test manual pathway with TMY3/EPW file upload (need sample file)
- [ ] Document both weather data ingestion pathways

## Extraction Engine Bug Fix & CSV Upload (Current - Jan 24, 2026)
- [x] Diagnose extraction engine breakage (check logs, test document upload)
- [x] Identify what changes broke the extraction pipeline (8000 char limit in IntelligentFactExtractorV2)
- [x] Fix extraction engine issues (increased to 50000 chars across all 4 passes)
- [x] Add CSV file type to document upload validation
- [ ] Test document upload with CSV files
- [ ] Test extraction pipeline with re-uploaded document
- [ ] Verify extraction produces ~70 insights again

## Real-Time Extraction Progress Bar (Current - Jan 24, 2026)
- [x] Design progress tracking system architecture (polling-based, 500ms interval)
- [x] Add processing_progress field to documents table (already exists: processing_jobs table)
- [x] Update document processor to emit progress events at each stage (updateProgress callback already implemented)
- [x] Create backend endpoint to fetch current progress for a document (trpc.documents.getProgress)
- [x] Build ProgressBar UI component with stage indicators (ExtractionProgressBar.tsx)
- [x] Add progress polling to DocumentUpload page (integrated with file upload status)
- [x] Show progress stages: Text Extraction → Deterministic → LLM Pass 1-4 → Performance → Financial → Weather → Complete
- [x] Add estimated time remaining calculation (based on elapsed time and progress percent)
- [ ] Test progress tracking with sample document upload
- [x] Add error state visualization in progress bar (red card with error message)

## Sandbox File Descriptor Limit Fix (Current - Jan 24, 2026)
- [x] Configure Vite to use polling mode instead of native file watching
- [x] Update vite.config.ts with server.watch.usePolling = true
- [x] Add CHOKIDAR_USEPOLLING=true to package.json dev script
- [x] Restart dev server and verify it starts without EMFILE errors (HTTP 200 response)
- [x] Test hot reload functionality with polling mode (server running successfully)
- [x] Document polling mode trade-offs (slower HMR but more reliable)

## tRPC API Error Fix - HTML Instead of JSON (Current - Jan 24, 2026)
- [ ] Check server logs for errors on /projects page load
- [ ] Identify which tRPC endpoint is returning HTML
- [ ] Check if server is crashing or returning error pages
- [ ] Fix the API endpoint or route configuration
- [ ] Test /projects page to verify fix

## Extraction Pipeline Bug Fixes (Current - Jan 24, 2026)
- [x] Fix performance/financial extractor crashes (undefined error accessing response.choices[0])
- [x] Add WEATHER_FILE document type to classification system
- [x] Update document type detector to recognize weather files (TMY, EPW, CSV with irradiance data)
- [ ] Skip fact extraction for WEATHER_FILE documents (process as weather data only)
- [ ] Fix progress bar showing 100% while extraction continues (5-10 min delay)
- [ ] Fix conflict detection - "Insight A" repeating incorrectly for unrelated conflicts
- [ ] Fix validation trigger stuck at 99% "Check validation trigger"
- [ ] Test all fixes with document upload

## Weather File Upload & Progress Bar Fixes (Current - Jan 24, 2026)
- [ ] Fix "data truncated" error when uploading weather files via regular upload
- [ ] Check database schema for documentType column size (needs to fit "WEATHER_FILE")
- [ ] Make weather file uploads from Performance page visible in Documents list
- [ ] Unify weather file upload endpoints (regular upload vs Performance page)
- [ ] Fix progress bar showing 100% while extraction continues (5-10 min delay)
- [ ] Adjust progress percentage calculations to reflect actual completion
- [ ] Ensure progress updates only reach 100% when all extraction steps complete
- [ ] Test weather file upload via both pathways (regular upload + Performance page)
- [ ] Verify weather files appear in Documents list with correct type

## Current Issues to Fix
- [x] Implement two-phase processing: Phase 1 (automatic) = extract raw facts only, Phase 2 (manual) = reconcile + narratives + specialized extraction
- [x] Disable automatic reconciliation and narrative generation on upload
- [x] Create manual 'Process & Consolidate' button and endpoint
- [x] Add weather file status display to Performance page
- [x] Add missing data guidance to Performance, Params, and Finance pages (show what's needed to generate reports)
- [x] Fix Processing Status UI spinning with 0 pending processes
- [x] Add back navigation links to Performance, Performance Parameters, and Financial Data pages

## New Issues Found
- [x] Show raw facts in narrative sections (Project Overview, Financial Structure, Technical Design) before narratives are generated
- [x] Implement narrative generation in consolidation logic
- [x] Fix fact key mapping - use section names (Project_Overview, Technical_Design, etc.) instead of generic keys
- [ ] Implement reconciliation, performance extraction, and financial extraction in consolidation (stubs remain)
- [ ] Add progress modal/indicator for consolidation process so user can see what's happening
- [x] Complete all UI fixes: weather file status, missing data guidance, back navigation links, Processing Status spinner

## Session 4 - New Requirements
- [x] Extend narrative generation to ALL fact sections (dynamically processes all sections with facts)
- [x] Verify conflict detection is actually running (implemented in consolidator - only compares facts from different documents)
- [x] Implement performance extraction with minimum model requirements (location, capacity, config SAT/fixed, weather file)
- [x] Add weather file parsing and monthly irradiance extraction (parseTMYFile function added)
- [x] Implement financial data extraction in consolidator
- [x] Add consolidation progress modal to show real-time progress (simulated stages with progress bar)

## Project Dashboard (Session 5 - Jan 24, 2026)
- [x] Create ProjectDetailDashboard page component (central hub for each project)
- [x] Integrate Google Maps showing project location with marker
- [x] Add key metrics cards:
  - [x] Total insights count with confidence indicator
  - [x] Red flags summary (critical/high/medium/low counts - placeholder)
  - [x] Documents count with processing status
  - [x] Data completeness progress indicator
- [x] Add project overview narrative section (from consolidated insights)
- [x] Build quick actions panel with links to all processes
- [x] Update routing: clicking project card → /project-dashboard?projectId=X
- [x] Add back navigation to Projects list
- [ ] Test dashboard with real project data

## Session 5 Fixes (Jan 24, 2026)
- [x] Audit all dashboard quick action links and fix 404 errors
- [x] Fix performance params page 404 error (changed query params to path params)
- [x] Verify all routes match between dashboard links and App.tsx routing
- [x] Create monthly irradiance chart component (bar chart showing GHI/DNI by month)
- [x] Integrate irradiance chart into Performance page
- [x] Display parsed TMY weather data in chart format

## Session 5 Bug Fixes (Jan 24, 2026)
- [x] Fix "Back to Projects" button - now goes to project dashboard from all sub-pages
- [x] Fix "Document List" link on project dashboard - corrected route
- [x] Fix Documents page to use path params instead of query params
- [x] Fix weather file detection - regular upload now creates weather_files record
- [x] Add monthly_irradiance, annual_summary, parsed_location columns to weather_files schema
- [x] Add columns to db-project-schema.sql for new projects
- [ ] Test irradiance chart displaying after consolidation
- [ ] Verify performance parameter extraction is running during consolidation

## Weather Data & Visualization Improvements
- [x] Fix weather chart bar height display bug (bars sitting at zero despite having data)
- [x] Add free weather API integration (Open-Meteo or NASA POWER) for fallback data
- [x] Implement location-based weather data fetching when no file uploaded
- [x] Add data source indicator badges (Free Data vs Project-Specific Data)
- [x] Add upgrade CTA messaging for premium weather data (PVGIS license)
- [ ] Design future "Purchase Data" workflow UI
- [x] Test chart with both uploaded files and free API data

## TMY Parsing & Chart Improvements
- [x] Analyze TMY file column naming conventions (Gb(n) = DNI, Gd = Diffuse, etc.)
- [x] Update weather file parser to recognize all irradiance column variants
- [x] Store DHI/Diffuse data in monthly_irradiance alongside GHI and DNI
- [x] Add chart toggle between GHI/Diffuse view and DNI view
- [x] Re-process existing weather files with improved parser
- [x] Test chart displays all irradiance data correctly
- [ ] Extract location (lat/lon) from TMY file header and store in weather_files table
- [ ] Use extracted location for map display and free weather data fallback

## Intelligent Location Extraction
- [x] Design project_location table schema (lat, lon, source, confidence, city, country, address)
- [x] Extract location from weather file headers (lat/lon from PVGIS/EPW metadata)
- [x] Extract location from document text using LLM (coordinates, addresses, city names)
- [x] Add geocoding service to convert city/address to coordinates
- [x] Implement location consolidation logic (prioritize: lat/lon > city > region)
- [x] Store consolidated location in project database during consolidation
- [x] Update map component to use extracted location instead of hardcoded coordinates
- [x] Update free weather service to use extracted location for API calls
- [ ] Test location extraction with various input formats (coordinates, cities, addresses)
  * Blocked by: weather_files record creation bug (P0 from audit)
  * Blocked by: LLM quota exhausted (can't test document-based extraction)
  * Architecture complete and ready for testing once blockers resolved

## Bug Fixes
- [x] Fix TypeError in ProjectDetailDashboard: latitude/longitude stored as strings, need parseFloat() before calling toFixed()

## Critical Bug: Insight Parsing Broken
- [ ] Investigate why feasibility study processed too quickly with missing insights
- [ ] Debug why weather file upload stuck at 10%
- [ ] Identify what code changes broke the extraction workflow
- [ ] Fix the broken insight extraction logic
- [ ] Test with feasibility study document to verify all insights are extracted

## LLM API Quota Issue Investigation
- [ ] Check LLM configuration in server/_core/llm.ts
- [ ] Verify BUILT_IN_FORGE_API_KEY and BUILT_IN_FORGE_API_URL are correct
- [ ] Test LLM API call directly to verify credentials work
- [ ] Investigate why API returns quota exhausted despite 12K credits remaining


---

# 🗺️ Feature Roadmap

## 🔴 Immediate Priority Features

### Red Flags Detection System
- [ ] Design risk categories (Technical, Financial, Regulatory, Environmental)
- [ ] Build LLM prompt for risk identification from consolidated insights
- [ ] Create `redFlags` table schema with severity levels (Critical/High/Medium/Low)
- [ ] Implement risk detection during consolidation phase
- [ ] Build Red Flags UI showing risk count by severity
- [ ] Add detailed risk explanations with source document citations
- [ ] Implement risk filtering and sorting in UI

### Performance Model Generation
- [ ] Design performance model architecture (PVWatts algorithm)
- [ ] Extract required inputs: location, capacity, module specs, inverter specs, system losses
- [ ] Integrate weather file data (GHI, DNI, DHI, temperature)
- [ ] Calculate expected energy production (monthly/annual)
- [ ] Calculate capacity factor and specific yield
- [ ] Compare against developer's claimed production figures
- [ ] Flag significant deviations (>5-10%) as red flags
- [ ] Build performance validation UI with charts and comparisons
- [ ] Add sensitivity analysis (weather year variation, degradation)

### Financial Analysis & Validation
- [ ] Extract financial data: CAPEX, OPEX, tariff rates, debt terms, equity returns
- [ ] Build financial model calculator (IRR, NPV, LCOE, DSCR)
- [ ] Create industry benchmark database for comparison
- [ ] Identify optimistic assumptions or missing cost categories
- [ ] Generate financial summary narrative
- [ ] Build financial validation UI with key metrics dashboard
- [ ] Add waterfall charts for cost breakdown
- [ ] Implement sensitivity analysis for financial assumptions

## 🟡 Secondary Features

### Conflict Resolution Workflow
- [ ] Detect conflicts when multiple documents provide different values
- [ ] Create `conflicts` table to track unresolved discrepancies
- [ ] Build conflict resolution UI showing side-by-side comparison
- [ ] Allow user to select correct value or mark "requires clarification"
- [ ] Track resolution history and audit trail
- [ ] Auto-resolve conflicts when one source is clearly more authoritative
- [ ] Generate conflict resolution report

### Document Comparison View
- [ ] Build side-by-side document comparison UI
- [ ] Highlight parameter changes between document versions
- [ ] Track assumption evolution: Feasibility → DD → FID
- [ ] Create timeline view of project data changes
- [ ] Add diff visualization for key metrics
- [ ] Generate change summary report

### Export & Reporting
- [ ] Design PDF technical summary report template
- [ ] Implement PDF generation with charts and tables
- [ ] Add Excel export for insights and financial data
- [ ] Create PowerPoint slide deck generator with key findings
- [ ] Build customizable report templates
- [ ] Add API endpoint for structured data export (JSON/CSV)
- [ ] Implement scheduled report generation

### Multi-Project Portfolio View
- [ ] Design portfolio dashboard UI
- [ ] Build cross-project comparison table
- [ ] Add outlier detection (high CAPEX, low CF, etc.)
- [ ] Implement portfolio-level risk aggregation
- [ ] Add industry benchmark comparisons
- [ ] Create portfolio summary charts (capacity by region, technology mix, etc.)
- [ ] Build portfolio export and reporting

## 🟢 Advanced Features

### Automated Q&A System
- [ ] Design conversational interface for project queries
- [ ] Implement natural language query processing
- [ ] Build LLM-based answer synthesis with source citations
- [ ] Add conversational follow-up question handling
- [ ] Create query history and saved queries
- [ ] Implement multi-turn conversation context
- [ ] Add suggested questions based on project data

### Template-Based Extraction
- [ ] Learn document structures from user feedback
- [ ] Build template library for common document types (IMs, feasibility studies, etc.)
- [ ] Pre-populate expected sections for known document types
- [ ] Suggest missing sections or data points
- [ ] Allow users to create custom extraction templates
- [ ] Implement template matching algorithm
- [ ] Add template versioning and sharing

### Integration with External Data Sources
- [ ] Integrate real-time weather APIs for location validation
- [ ] Connect to regulatory databases for permitting status checks
- [ ] Add equipment specification verification against manufacturer datasheets
- [ ] Integrate land ownership and title records
- [ ] Add electricity market data (spot prices, forecasts)
- [ ] Connect to project financing databases
- [ ] Implement automated data refresh and updates

## 🔵 Future Enhancements

### Machine Learning Improvements
- [ ] Train custom NER model for renewable energy domain
- [ ] Implement active learning from user corrections
- [ ] Add confidence scoring for extracted facts
- [ ] Build anomaly detection for unusual parameter values
- [ ] Implement clustering for similar projects

### Collaboration Features
- [ ] Add user roles and permissions (viewer, analyst, admin)
- [ ] Implement commenting and annotations on insights
- [ ] Add task assignment for conflict resolution
- [ ] Build approval workflow for validated data
- [ ] Add real-time collaboration (multiple users editing)

### Advanced Analytics
- [ ] Build predictive models for project success
- [ ] Add scenario modeling and "what-if" analysis
- [ ] Implement Monte Carlo simulation for risk assessment
- [ ] Create project scoring and ranking system
- [ ] Add market analysis and competitive intelligence

---


## 🔧 Custom OpenAI API Key Implementation
- [x] Add OPENAI_API_KEY to environment configuration
- [x] Update LLM integration to detect and use custom API key
- [x] Add fallback logic: custom key → Manus built-in
- [x] Update API endpoint for OpenAI vs Manus Forge
- [x] Test document processing with OpenAI API key
- [x] Verify all extraction workflows work with new provider


## 🗺️ Location Extraction & Mapbox Integration
- [ ] Add location extraction during document upload/scan (Phase 1)
- [ ] Keep location refinement during consolidation (Phase 2)
- [ ] Switch from Google Maps to Mapbox
- [ ] Add Mapbox public token to environment
- [ ] Set default map view to satellite
- [ ] Fix map to display extracted location from performance_parameters
- [ ] Test location extraction with document upload
- [ ] Verify map displays correct coordinates


## 🐛 Critical Bug Fixes (Session 2026-01-24)
- [x] Fix performance parameters extraction - LLM identifies capacity (300MWp) and grid limit (280MW) in narratives but not storing in performance_parameters table
- [x] Add location extraction during document upload/scan phase (Phase 1 extraction) - extract from document text using LLM
- [x] Fix weather_files record creation bug - uploaded files don't create database records with location data
- [x] Update consolidation to read location from weather_files table (currently hardcoded to 0,0)
- [x] Fix Mapbox map to display extracted location (currently showing 0,0 default)
- [x] Parse weather file header during upload to extract lat/lon/elevation
- [x] Pass location from performance_parameters to MapView component
- [x] Create section_narratives table in project database

## 🐛 Performance Validation Page Fix (Current - Jan 24, 2026)

- [ ] Add performance_validations table to project database schema
- [ ] Create runValidation endpoint in router that uses performance-validator.ts
- [ ] Integrate weather file data (GHI/DNI) into validation calculator
- [ ] Add "Run Validation" button to existing Performance Validation page
- [ ] Keep existing weather graphs and charts intact
- [ ] Display validation results below the weather data section

## 🐛 URGENT: Performance Parameters Not Extracting (Jan 24, 2026)

- [ ] Check consolidation logs to see if performance extractor is being called
- [ ] Verify narratives are being saved to project database
- [ ] Check if performance-financial-extractor.ts is working
- [ ] Move Run Validation button to top of Performance Validation page

## 🐛 CRITICAL BUGS (Jan 24, 2026 - Post GitHub Push)

- [x] Fix performance extraction query - uses 'section' instead of 'section_key'
- [x] Fix weather location extraction - returning 0,0 instead of actual coordinates from TMY header (fixed regex escaping)

## 🐛 Performance Validation UI & Calculation (Jan 24, 2026)

- [ ] Fix UI - validation results replacing page content instead of adding below graphs
- [ ] Fix calculation - generation numbers too low (need to debug PVWatts logic)
- [ ] Preserve navigation links and page structure after validation runs

## Fix Project Creation Schema Standardization
- [x] Read db-project-schema.sql from mce-tools repository
- [x] Copied project-table-provisioner.ts and db-project-schema.sql to OE Toolkit
- [x] Updated createProject in db.ts to use table-prefix provisioner
- [x] Standard schema now includes 'stage' column in processing_jobs
- [x] uploadDate has DEFAULT CURRENT_TIMESTAMP in standard schema
- [x] All column names use camelCase as per standard
- [x] Verified schema with grep - stage and uploadDate DEFAULT confirmed
- [x] Ready for production testing
