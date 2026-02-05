# MCE Knowledge Engine

**Cross-Platform Intelligence & Project Learning Capture**

A continuously learning system that captures de-identified learnings from renewable energy projects and provides cross-platform intelligence for better risk identification, benchmarking, and design review.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Getting Started](#getting-started)
4. [API Reference](#api-reference)
5. [Data Model](#data-model)
6. [Intelligence Types](#intelligence-types)
7. [Development](#development)

---

## Overview

The MCE Knowledge Engine is the intelligence layer of the MCE Tools suite. Unlike traditional benchmarking systems that cite historical data, the Knowledge Engine **embeds learning into its operations**, becoming progressively more intelligent with each project.

### Core Vision

Build institutional knowledge about how to design, deliver, and operate renewable energy projects better—knowledge that gets smarter and more valuable with every project.

### Key Features

| Feature | Description |
|---------|-------------|
| **Risk Intelligence** | Smarter risk identification based on historical outcomes |
| **Benchmarking** | Better cost/schedule estimates with confidence scores |
| **Design Review** | Insights based on standard usage patterns |
| **Site Assessment** | Risk assessment based on ground/hydrology/climate |
| **Equipment Data** | Recommendations based on reliability data |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    OE Toolkit (Orchestrator)                │
│  • Project creation & workflow routing                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Specialized Tools (TA/TDD, OE, etc.)           │
│  • Technical Advisory Engine (port 3000)                    │
│  • OE Design Review Engine                                  │
│  • Solar Analyzer (port 3003)                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│         Knowledge Engine (FastAPI - port 3005)              │
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

### Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Application | FastAPI (Python) | Single codebase, easy to manage |
| Primary DB | PostgreSQL | Structured data, JSONB flexibility |
| Vector DB | Pinecone (Cloud) | Managed semantic search |
| Storage | S3 | Document storage |
| Scheduling | APScheduler | Automated learning tasks |
| LLM | OpenAI API | Analysis & insight generation |

---

## Getting Started

### Prerequisites

- Python 3.11+
- PostgreSQL 14+
- Pinecone account
- OpenAI API key
- AWS S3 bucket

### Installation

```bash
# Navigate to knowledge-engine directory
cd knowledge-engine

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
alembic upgrade head

# Start the server
python -m app.main
```

The API will be available at `http://localhost:3005`.

### Quick Start with Docker (Coming Soon)

```bash
docker-compose up -d
```

---

## API Reference

### Intelligence Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/intelligence/risks/similar` | POST | Find similar historical risks |
| `/api/intelligence/risks/by-category` | POST | Get aggregated risk data by category |
| `/api/intelligence/risks/validate` | POST | Validate a risk matrix |
| `/api/intelligence/benchmarks/estimate` | POST | Get cost/schedule estimates |
| `/api/intelligence/benchmarks/compare` | POST | Compare project to benchmarks |
| `/api/intelligence/benchmarks/drivers` | GET | Get typical cost/schedule drivers |
| `/api/intelligence/design/standards` | POST | Get typical design standards |
| `/api/intelligence/design/review` | POST | Review design specifications |
| `/api/intelligence/design/equipment` | POST | Get equipment performance data |
| `/api/intelligence/site-conditions/risks` | POST | Get site condition risks |
| `/api/intelligence/site-conditions/similar` | POST | Find similar sites |
| `/api/intelligence/status` | GET | Get system status |
| `/api/intelligence/gaps` | GET | Identify knowledge gaps |

### Ingestion Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ingestion/ingest` | POST | Generic data ingestion |
| `/api/ingestion/tatdd` | POST | Ingest from TA/TDD Engine |
| `/api/ingestion/oe-design` | POST | Ingest from OE Design Review |
| `/api/ingestion/solar-analyzer` | POST | Ingest from Solar Analyzer |
| `/api/ingestion/operations` | POST | Ingest from Operations |
| `/api/ingestion/project-completion` | POST | Ingest project completion data |

---

## Data Model

### Core Tables

| Table | Purpose |
|-------|---------|
| `knowledge_projects` | De-identified project metadata |
| `knowledge_risks` | Risk intelligence with materialization tracking |
| `knowledge_site_conditions` | Ground/hydrology/climate issues |
| `knowledge_project_outcomes` | Cost, schedule, performance data |
| `knowledge_design_standards` | Standards used, deviations, outcomes |
| `knowledge_equipment_performance` | Equipment reliability data |
| `knowledge_benchmarks` | Aggregated benchmarking data |

### De-Identification Strategy

All data is de-identified before storage:

| Original | De-identified |
|----------|---------------|
| Client names | Hashed IDs |
| Project names | Generic codes (SOL-001, WIND-002) |
| Specific locations | Region/State only |
| Company names | Industry/Sector only |
| Personal names | Removed entirely |
| Commercial info | Aggregated/Anonymized |

---

## Intelligence Types

### 1. Risk Intelligence

- Input: Historical risks, outcomes, mitigations
- Output: Smarter risk identification
- Example: "Ground conditions + hydrology issues → specific risk combinations"

### 2. Benchmarking Intelligence

- Input: Project costs, schedules, outcomes
- Output: Better estimates for new projects
- Example: "Based on 47 similar projects, 300 MW solar typically costs..."

### 3. Design Standard Intelligence

- Input: Standards used, deviations, outcomes
- Output: Better design review insights
- Example: "Projects deviating from standard X usually experience..."

### 4. Site Condition Intelligence

- Input: Ground conditions, hydrology, outcomes
- Output: Better site risk assessment
- Example: "Soft ground + high water table → these specific risks"

### 5. Equipment Intelligence

- Input: Equipment types, performance, failures
- Output: Better equipment recommendations
- Example: "Inverter model X has 3% failure rate after 5 years"

---

## Development

### Project Structure

```
knowledge-engine/
├── app/
│   ├── api/                 # FastAPI routers
│   │   ├── intelligence/    # Intelligence endpoints
│   │   └── ingestion/       # Data ingestion endpoints
│   ├── core/                # Config, database, dependencies
│   ├── models/              # SQLAlchemy & Pydantic models
│   ├── services/            # Business logic
│   ├── tasks/               # APScheduler tasks
│   └── main.py              # FastAPI app entry
├── alembic/                 # Database migrations
├── tests/                   # Test files
├── docs/                    # Documentation
├── requirements.txt
├── pyproject.toml
└── README.md
```

### Running Tests

```bash
pytest
```

### Code Style

```bash
# Format code
black app/

# Lint code
ruff check app/

# Type checking
mypy app/
```

### Database Migrations

```bash
# Create a new migration
alembic revision --autogenerate -m "Description"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

---

## Confidence Scoring

Each piece of intelligence includes a confidence score:

| Level | Score | Criteria |
|-------|-------|----------|
| High | 0.8-1.0 | 20+ projects, consistent patterns, recent data |
| Medium | 0.5-0.8 | 5-20 projects, some variation |
| Low | 0-0.5 | <5 projects, high variation |

---

## Scheduled Tasks

### Daily (2 AM)
- Aggregate risks by category
- Update benchmarks
- Identify emerging patterns
- Recalculate confidence scores

### Weekly (Sunday 3 AM)
- Analyze design deviations
- Review equipment trends
- Update risk matrices

### Monthly (1st of month, 4 AM)
- Generate intelligence reports
- Discover new risk categories
- Refine benchmarking models

---

## License

Proprietary - MCE Tools

## Contact

For questions or support, contact the MCE development team.
