# MCE Knowledge Engine & Cross-Platform Intelligence Masterplan

**Version:** 1.0  
**Date:** February 5, 2026  
**Status:** STRATEGIC VISION  
**Focus:** Cross-Platform Intelligence & Project Learning Capture

---

## Executive Summary

The MCE Knowledge Engine is a **continuously learning system** that captures de-identified learnings from renewable energy projects as they progress through Technical Advisory/Technical Design Development (TA/TDD), Operational Excellence (OE) Design Review, and Operations phases. 

Unlike traditional benchmarking systems that cite historical data, the Knowledge Engine **embeds learning into its operations**, becoming progressively more intelligent and perceptive with each project.

**Core Vision:** Build institutional knowledge about how to design, deliver, and operate renewable energy projects better—knowledge that gets smarter and more valuable with every project.

---

## Phase 1: Cross-Platform Intelligence & Project Learning Capture

### 1.1 Scope

**What We're Building (Phase 1):**
- Capture de-identified learnings from projects running on MCE platforms
- Build a knowledge database of project outcomes, risks, and mitigations
- Create intelligence that improves risk identification, benchmarking, and design review
- Enable cross-platform data sharing and learning

**What We're NOT Doing Yet:**
- Historical document ingestion (Phase 2)
- Public data source integration (Phase 3)
- Email/communication ingestion (Phase 3)
- Advanced pattern detection across massive datasets (Phase 3+)

**Why This Order:**
- Phase 1 establishes the foundation and proves the concept
- We control the data quality (our projects, our systems)
- We can iterate quickly and refine the schema
- We build the infrastructure once, then scale it

---

## 2. Architecture Overview

### 2.1 Simplified, Solo-Manageable Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    OE Toolkit (Orchestrator)                │
│  • Project creation & workflow routing                      │
│  • Template system for TA/TDD, OE, etc.                    │
│  • ACC integration & folder structure setup                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Specialized Tools (TA/TDD, OE, etc.)           │
│  • Technical Advisory Engine                                │
│  • OE Design Review Engine                                  │
│  • Solar Analyzer                                           │
│  • Solar Dashboard                                          │
│  • Operations Monitoring                                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│         Knowledge Engine (Single Python Application)        │
│  • Ingestion from all platforms                            │
│  • Learning & intelligence generation                      │
│  • API for insights & benchmarking                         │
│  • Scheduled learning tasks                                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────┬──────────────────────┬───────────────┐
│   PostgreSQL         │   Pinecone (Cloud)   │   S3 Storage  │
│   (Structured Data)  │   (Embeddings)       │   (Documents) │
└──────────────────────┴──────────────────────┴───────────────┘
```

### 2.2 Technology Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Application** | FastAPI (Python) | Single codebase, easy to manage |
| **Primary DB** | PostgreSQL | Structured data, full-text search, JSONB flexibility |
| **Vector DB** | Pinecone (Cloud) | Managed service, zero ops, semantic search |
| **Storage** | S3 or equivalent | Document versioning, minimal management |
| **Task Scheduling** | APScheduler | Built into Python app, no separate tool |
| **LLM** | OpenAI API or Local Ollama | Analysis & insight generation |
| **Deployment** | Single VPS or Manus | Simple, manageable, scalable |
| **Caching** | Redis (optional) | Can add later if needed |

### 2.3 Infrastructure Requirements

**Deployment:**
- Single VPS ($30-50/month) or Manus platform
- PostgreSQL (managed, $15-50/month)
- Pinecone API (pay-per-use, ~$50-100/month initially)
- S3 storage ($5-20/month)
- LLM API usage ($0-100/month depending on analysis volume)

**Total: $100-300/month** (scales with usage)

**Management Overhead:**
- Code updates: Push to GitHub, redeploy
- Database: Automated backups, minimal intervention
- Monitoring: Simple logging and dashboards
- Maintenance: ~5-10 hours/month once established

---

## 3. Data Model: Knowledge Capture

### 3.1 Core Entities

#### Project Record
```sql
CREATE TABLE knowledge_projects (
    id UUID PRIMARY KEY,
    project_name VARCHAR(255),
    project_code VARCHAR(50),
    project_type VARCHAR(50),  -- 'solar', 'wind', 'battery', 'hybrid'
    capacity_mw NUMERIC,
    location_region VARCHAR(100),
    location_state VARCHAR(50),
    client_id UUID,  -- de-identified
    created_at TIMESTAMP,
    completed_at TIMESTAMP,
    -- Metadata
    metadata JSONB,
    created_by UUID
);
```

#### Risk Intelligence
```sql
CREATE TABLE knowledge_risks (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES knowledge_projects(id),
    risk_category VARCHAR(100),  -- 'ground_conditions', 'hydrology', 'design', 'supply_chain', etc.
    risk_description TEXT,
    identified_phase VARCHAR(50),  -- 'TA', 'TDD', 'Delivery', 'Operations'
    identified_date TIMESTAMP,
    probability_estimated NUMERIC,  -- 0-1
    impact_estimated NUMERIC,  -- 0-1
    materialized BOOLEAN,
    materialized_date TIMESTAMP,
    materialized_impact TEXT,
    mitigation_strategy TEXT,
    mitigation_effectiveness NUMERIC,  -- 0-1 (how well did it work?)
    cost_impact NUMERIC,
    schedule_impact_days INTEGER,
    lessons_learned TEXT,
    confidence_score NUMERIC,  -- 0-1 (data quality)
    metadata JSONB,
    created_at TIMESTAMP
);
```

#### Site Conditions Intelligence
```sql
CREATE TABLE knowledge_site_conditions (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES knowledge_projects(id),
    condition_type VARCHAR(100),  -- 'ground_conditions', 'hydrology', 'climate', 'access', etc.
    condition_description TEXT,
    severity VARCHAR(50),  -- 'low', 'medium', 'high'
    issues_encountered TEXT,
    issues_impact TEXT,
    mitigations_applied TEXT,
    mitigations_effectiveness NUMERIC,
    caused_delays BOOLEAN,
    delay_days INTEGER,
    caused_defects BOOLEAN,
    defect_description TEXT,
    lessons_learned TEXT,
    confidence_score NUMERIC,
    metadata JSONB,
    created_at TIMESTAMP
);
```

#### Cost & Schedule Intelligence
```sql
CREATE TABLE knowledge_project_outcomes (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES knowledge_projects(id),
    -- Budgeted vs Actual
    budget_estimated NUMERIC,
    budget_actual NUMERIC,
    budget_variance NUMERIC,
    budget_variance_pct NUMERIC,
    -- Schedule
    schedule_estimated_days INTEGER,
    schedule_actual_days INTEGER,
    schedule_variance_days INTEGER,
    schedule_variance_pct NUMERIC,
    -- Cost Drivers
    cost_drivers TEXT,  -- JSON array of {category, amount, description}
    schedule_drivers TEXT,  -- JSON array of {category, days, description}
    -- Performance
    performance_vs_design TEXT,  -- How did it perform vs design assumptions?
    performance_metrics JSONB,  -- Project-specific metrics
    -- Lessons
    key_learnings TEXT,
    what_worked_well TEXT,
    what_could_improve TEXT,
    confidence_score NUMERIC,
    metadata JSONB,
    created_at TIMESTAMP
);
```

#### Design Standard Intelligence
```sql
CREATE TABLE knowledge_design_standards (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES knowledge_projects(id),
    standard_name VARCHAR(255),  -- 'IEC 61936', 'AS/NZS 3000', etc.
    standard_version VARCHAR(50),
    design_aspect VARCHAR(255),  -- 'cable_sizing', 'earthing', 'protection', etc.
    standard_requirement TEXT,
    design_approach TEXT,
    deviation_from_standard BOOLEAN,
    deviation_reason TEXT,
    deviation_approved BOOLEAN,
    deviation_impact TEXT,
    lessons_learned TEXT,
    confidence_score NUMERIC,
    metadata JSONB,
    created_at TIMESTAMP
);
```

#### Equipment Performance Intelligence
```sql
CREATE TABLE knowledge_equipment_performance (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES knowledge_projects(id),
    equipment_type VARCHAR(100),  -- 'inverter', 'transformer', 'cable', etc.
    equipment_model VARCHAR(255),
    equipment_quantity INTEGER,
    installation_date TIMESTAMP,
    operational_period_months INTEGER,
    -- Performance
    performance_rating NUMERIC,  -- 0-5 or 0-100
    reliability_issues BOOLEAN,
    reliability_issues_description TEXT,
    failures_count INTEGER,
    failure_modes TEXT,  -- JSON array
    maintenance_requirements TEXT,
    -- Lessons
    would_specify_again BOOLEAN,
    alternative_recommendations TEXT,
    lessons_learned TEXT,
    confidence_score NUMERIC,
    metadata JSONB,
    created_at TIMESTAMP
);
```

#### Benchmarking Data
```sql
CREATE TABLE knowledge_benchmarks (
    id UUID PRIMARY KEY,
    project_type VARCHAR(50),  -- 'solar', 'wind', etc.
    capacity_range_min NUMERIC,
    capacity_range_max NUMERIC,
    region VARCHAR(100),
    -- Aggregated metrics
    avg_cost_per_mw NUMERIC,
    avg_schedule_months NUMERIC,
    cost_variance_pct NUMERIC,
    schedule_variance_pct NUMERIC,
    -- Risk profile
    common_risks TEXT,  -- JSON array
    typical_cost_drivers TEXT,  -- JSON array
    typical_schedule_drivers TEXT,  -- JSON array
    -- Site conditions
    typical_site_conditions TEXT,  -- JSON array
    typical_mitigations TEXT,  -- JSON array
    -- Data quality
    projects_in_dataset INTEGER,
    last_updated TIMESTAMP,
    confidence_score NUMERIC,
    metadata JSONB,
    created_at TIMESTAMP
);
```

### 3.2 De-Identification Strategy

All project data is de-identified before storage:

```
Client Names → Hashed IDs
Project Names → Generic codes (SOL-001, WIND-002, etc.)
Specific Locations → Region/State only
Specific Companies → Industry/Sector only
Personal Names → Removed entirely
Sensitive Commercial Info → Aggregated/Anonymized
```

**Principle:** Data is valuable for patterns, not for identifying specific clients or projects.

---

## 4. Data Ingestion: From Tools to Knowledge Engine

### 4.1 Integration Points

Each MCE tool feeds learning data to the Knowledge Engine:

#### TA/TDD Engine → Knowledge Engine
```
When TA/TDD project completes:
  1. Risk matrices → knowledge_risks
  2. Design standards used → knowledge_design_standards
  3. Benchmarking assumptions → knowledge_benchmarks
  4. Site conditions identified → knowledge_site_conditions
  5. Cost/schedule estimates → knowledge_project_outcomes (estimated)
```

#### OE Design Review Engine → Knowledge Engine
```
When OE Design Review completes:
  1. Design issues identified → knowledge_design_standards
  2. Risk updates → knowledge_risks
  3. Mitigation recommendations → knowledge_risks
  4. Design standard deviations → knowledge_design_standards
```

#### Solar Analyzer → Knowledge Engine
```
When Solar Analyzer analysis completes:
  1. Equipment detected → knowledge_equipment_performance
  2. Performance data → knowledge_project_outcomes
  3. Issues identified → knowledge_site_conditions
```

#### Operations Monitoring → Knowledge Engine
```
Continuously during operations:
  1. Equipment failures → knowledge_equipment_performance
  2. Performance vs design → knowledge_project_outcomes
  3. Maintenance patterns → knowledge_equipment_performance
  4. Operational issues → knowledge_site_conditions
```

#### Project Completion → Knowledge Engine
```
When project completes (Delivery + Operations):
  1. Final cost vs budget → knowledge_project_outcomes
  2. Final schedule vs plan → knowledge_project_outcomes
  3. Risks that materialized → knowledge_risks
  4. Mitigation effectiveness → knowledge_risks
  5. Cost drivers → knowledge_project_outcomes
  6. Schedule drivers → knowledge_project_outcomes
  7. Key learnings → all tables
```

### 4.2 Data Flow

```
Tool A (TA/TDD)
    ↓
  API Call to Knowledge Engine
    ↓
Knowledge Engine receives:
  {
    "project_id": "...",
    "data_type": "risk_matrix",
    "payload": {...}
  }
    ↓
Knowledge Engine processes:
  1. De-identifies data
  2. Validates schema
  3. Generates embeddings
  4. Stores in PostgreSQL
  5. Stores embeddings in Pinecone
  6. Updates benchmarks
    ↓
Data available for:
  • Benchmarking queries
  • Risk identification
  • Design review insights
  • Future project planning
```

---

## 5. Intelligence Generation: How the System Learns

### 5.1 Automated Learning Tasks

**Daily Tasks (via APScheduler):**
```python
# Aggregate new risk data
aggregate_risks_by_category()

# Update benchmarks with new projects
update_benchmarks()

# Identify emerging patterns
identify_emerging_patterns()

# Generate confidence scores
recalculate_confidence_scores()
```

**Weekly Tasks:**
```python
# Analyze design standard deviations
analyze_design_deviations()

# Review equipment performance trends
analyze_equipment_trends()

# Update risk matrices with new learnings
update_risk_matrices()
```

**Monthly Tasks:**
```python
# Generate comprehensive intelligence reports
generate_intelligence_reports()

# Identify new risk categories
discover_new_risk_categories()

# Refine benchmarking models
refine_benchmarks()
```

### 5.2 Intelligence Types

#### 1. Risk Intelligence
```
Input: Historical risks, outcomes, mitigations
Output: Smarter risk identification

Example:
  • Ground conditions + hydrology issues → specific risk combinations
  • Mitigation effectiveness → better recommendations
  • Cost/schedule impact → better prioritization
  
Result: Risk matrices improve over time, become more perceptive
```

#### 2. Benchmarking Intelligence
```
Input: Project costs, schedules, outcomes
Output: Better estimates for new projects

Example:
  • 300 MW solar project → "Based on 47 similar projects..."
  • Regional variations → "NSW projects typically cost 12% more..."
  • Capacity ranges → "Projects in 250-350 MW range..."
  
Result: Benchmarking becomes more accurate and contextual
```

#### 3. Design Standard Intelligence
```
Input: Standards used, deviations, outcomes
Output: Better design review insights

Example:
  • "IEC 61936 cable sizing typically used for..."
  • "Projects deviating from standard X usually..."
  • "Design standard Y misused in these ways..."
  
Result: Design reviews flag issues more intelligently
```

#### 4. Site Condition Intelligence
```
Input: Ground conditions, hydrology, outcomes
Output: Better site risk assessment

Example:
  • "Soft ground + high water table → these specific risks"
  • "Mitigation strategy X worked in 85% of cases"
  • "This condition type typically delays by X days"
  
Result: Site assessment becomes more predictive
```

#### 5. Equipment Intelligence
```
Input: Equipment types, performance, failures
Output: Better equipment recommendations

Example:
  • "Inverter model X has 3% failure rate after 5 years"
  • "Transformer brand Y typically needs maintenance every..."
  • "Cable type Z performs better in high-temperature regions"
  
Result: Equipment selection becomes more data-driven
```

### 5.3 Embedding & Semantic Search

All key information is embedded for semantic search:

```
Document: "Project SOL-001 had soft ground conditions with high water table,
           required deep foundations, delayed schedule by 45 days, cost $500K extra"

Embedding captures:
  • Semantic meaning
  • Relationships to other projects
  • Similar conditions/outcomes
  
Query: "What risks come from high water tables?"
  → Finds all similar projects
  → Aggregates learnings
  → Returns intelligent summary
```

---

## 6. API: How Tools Access Intelligence

### 6.1 Core Endpoints

#### Risk Intelligence
```
GET /api/intelligence/risks/similar
  Query: project_type, capacity, region, conditions
  Returns: Similar historical risks, mitigation strategies, effectiveness

GET /api/intelligence/risks/by-category
  Query: risk_category, project_type
  Returns: Aggregated risk data, trends, emerging patterns

POST /api/intelligence/risks/validate
  Body: Proposed risk matrix
  Returns: Comparison to historical data, suggestions
```

#### Benchmarking
```
GET /api/intelligence/benchmarks/estimate
  Query: project_type, capacity, region
  Returns: Cost/schedule estimates with confidence, ranges, drivers

GET /api/intelligence/benchmarks/compare
  Query: project_id, metric
  Returns: How project compares to benchmarks, percentiles

GET /api/intelligence/benchmarks/drivers
  Query: project_type
  Returns: What actually drives cost and schedule
```

#### Design Review
```
GET /api/intelligence/design/standards
  Query: project_type, design_aspect
  Returns: Typical standards used, deviations, outcomes

GET /api/intelligence/design/review
  Body: Design specifications
  Returns: Flags potential issues based on historical patterns

GET /api/intelligence/design/equipment
  Query: equipment_type, project_type
  Returns: Equipment performance data, recommendations
```

#### Site Conditions
```
GET /api/intelligence/site-conditions/risks
  Query: condition_type, severity
  Returns: Typical risks, mitigations, effectiveness

GET /api/intelligence/site-conditions/similar
  Query: site_conditions
  Returns: Similar historical sites, outcomes, lessons
```

#### Learning Status
```
GET /api/intelligence/status
  Returns: Data quality metrics, confidence scores, coverage

GET /api/intelligence/gaps
  Returns: Where we need more data, what we're uncertain about
```

### 6.2 Integration with OE Toolkit

OE Toolkit uses intelligence to:

1. **Inform TA/TDD Recommendations**
   - "Based on similar projects, consider these risks..."
   - "Typical cost for this type: $X-Y million"

2. **Enhance Design Review**
   - "This design deviates from standard in these ways..."
   - "Similar projects used this approach instead..."

3. **Improve Risk Assessment**
   - "This site condition typically causes..."
   - "Effective mitigations: ..."

4. **Guide Project Planning**
   - "Projects like this typically take X months"
   - "Key cost drivers to watch: ..."

---

## 7. Data Quality & Confidence

### 7.1 Confidence Scoring

Each piece of intelligence has a confidence score (0-1):

```
High Confidence (0.8-1.0):
  • Based on 20+ similar projects
  • Consistent patterns
  • Recent data
  • Validated outcomes

Medium Confidence (0.5-0.8):
  • Based on 5-20 projects
  • Some variation
  • Mix of recent and older data
  • Partially validated

Low Confidence (0-0.5):
  • Based on <5 projects
  • High variation
  • Older data
  • Unvalidated
```

### 7.2 Data Validation

```
Ingestion Validation:
  1. Schema validation
  2. Range checks
  3. Consistency checks
  4. De-identification verification

Processing Validation:
  1. Outlier detection
  2. Conflict resolution
  3. Confidence scoring
  4. Embedding quality checks

Output Validation:
  1. Sanity checks on recommendations
  2. Comparison to domain knowledge
  3. Flagging low-confidence data
```

### 7.3 Feedback Loops

Users can provide feedback on intelligence:

```
"This recommendation was helpful / not helpful"
"This estimate was accurate / inaccurate"
"This risk did / didn't materialize"

→ Feeds back into confidence scoring
→ Improves future recommendations
```

---

## 8. Implementation Roadmap

### Phase 1A: Foundation (Weeks 1-4)
- [ ] Design database schema
- [ ] Set up PostgreSQL
- [ ] Set up Pinecone account
- [ ] Create FastAPI application skeleton
- [ ] Implement de-identification logic
- [ ] Create basic ingestion endpoints

### Phase 1B: Core Data Model (Weeks 5-8)
- [ ] Implement knowledge_projects table
- [ ] Implement knowledge_risks table
- [ ] Implement knowledge_project_outcomes table
- [ ] Create ingestion endpoints for TA/TDD engine
- [ ] Create ingestion endpoints for OE engine
- [ ] Test with sample data

### Phase 1C: Intelligence Generation (Weeks 9-12)
- [ ] Implement risk aggregation logic
- [ ] Implement benchmarking calculations
- [ ] Implement confidence scoring
- [ ] Create embedding generation
- [ ] Integrate with Pinecone
- [ ] Create semantic search endpoints

### Phase 1D: API & Integration (Weeks 13-16)
- [ ] Create intelligence API endpoints
- [ ] Integrate with OE Toolkit
- [ ] Create admin dashboard
- [ ] Implement monitoring/logging
- [ ] Performance optimization
- [ ] Documentation

### Phase 1E: Refinement (Weeks 17-20)
- [ ] User testing with real projects
- [ ] Schema refinements based on feedback
- [ ] Intelligence quality improvements
- [ ] Confidence scoring calibration
- [ ] Deployment to production

### Phase 2: Extended Data Model (Future)
- [ ] Site conditions intelligence
- [ ] Design standards intelligence
- [ ] Equipment performance intelligence
- [ ] Operations data integration

### Phase 3: Advanced Learning (Future)
- [ ] Historical document ingestion
- [ ] Email/communication analysis
- [ ] Public data source integration
- [ ] Advanced pattern detection

---

## 9. Success Metrics

### Phase 1 Success Criteria

1. **Data Capture**
   - ✅ Capturing data from TA/TDD projects
   - ✅ De-identification working correctly
   - ✅ Data quality >95%

2. **Intelligence Generation**
   - ✅ Risk recommendations improving with each project
   - ✅ Benchmarking estimates within 20% of actual
   - ✅ Confidence scores calibrated correctly

3. **Integration**
   - ✅ OE Toolkit using intelligence in recommendations
   - ✅ Users finding insights valuable
   - ✅ No performance degradation

4. **Operational**
   - ✅ Solo management overhead <5 hours/week
   - ✅ System uptime >99%
   - ✅ Data backups automated

---

## 10. Future Considerations

### 10.1 Schema Evolution

As you learn what matters, the schema will evolve:

```
Year 1: Basic risk, cost, schedule data
Year 2: Add site conditions, equipment performance
Year 3: Add design standards, detailed cost drivers
Year 4+: Discover new patterns, add new data types
```

**Approach:**
- Use JSONB for flexible metadata
- Version schema changes
- Migrate data gradually
- Never delete old data

### 10.2 Privacy & De-Identification

- Regular audits to ensure de-identification
- Compliance with data protection regulations
- Clear data governance policies
- Client consent for data usage

### 10.3 Competitive Advantage

This system becomes your **moat**:
- Better risk identification
- Better cost/schedule estimates
- Better design reviews
- Better project outcomes

The more projects you run through it, the better it gets.

---

## 11. Getting Started

### Immediate Next Steps

1. **Finalize Data Model**
   - Review schema with team
   - Identify any missing data types
   - Plan for evolution

2. **Set Up Infrastructure**
   - Deploy PostgreSQL
   - Create Pinecone account
   - Set up S3 bucket
   - Deploy FastAPI application

3. **Integrate First Tool**
   - Start with TA/TDD engine
   - Create ingestion endpoint
   - Test with sample project data
   - Refine based on learnings

4. **Build First Intelligence**
   - Implement risk aggregation
   - Implement benchmarking
   - Create basic API endpoints
   - Test with OE Toolkit

5. **Iterate & Refine**
   - Capture feedback
   - Improve intelligence quality
   - Add new data types
   - Scale gradually

---

## 12. Questions & Decisions

**Decisions Needed:**

1. **LLM Choice:** OpenAI API vs Local Ollama?
   - OpenAI: Better quality, costs money, cloud-dependent
   - Ollama: Privacy, free, runs locally, lower quality

2. **Deployment:** Single VPS vs Manus vs Cloud?
   - VPS: Cheapest, most control
   - Manus: Integrated, managed
   - Cloud: Most managed, most expensive

3. **Rollout:** All tools at once vs gradual?
   - Gradual: Lower risk, easier to manage
   - All at once: Faster learning

4. **Public Data:** When to integrate?
   - Phase 2 or Phase 3?
   - What sources? (Industry reports, regulatory data, etc.)

---

**End of Masterplan**

This document captures the strategic vision for the MCE Knowledge Engine. It's designed to be implemented incrementally, managed by one person, and refined continuously as you learn what matters.

The key principle: **Start simple, capture learning from your projects, let the system get smarter over time.**
