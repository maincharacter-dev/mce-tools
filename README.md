# MCE Project Intake & Ingestion Engine

**Stage 1 of the Technical Advisory (TA/TDD) Workflow**

A document intelligence platform designed for renewable energy project due diligence. This system ingests project documents, extracts structured insights using hybrid parsing (deterministic + LLM), and maintains data sovereignty with per-project databases while enabling seamless integration with Autodesk Construction Cloud (ACC).

## Table of Contents

1. [Overview](#overview)
2. [Key Features](#key-features)
3. [Architecture](#architecture)
4. [Technology Stack](#technology-stack)
5. [Getting Started](#getting-started)
6. [Project Structure](#project-structure)
7. [Core Workflows](#core-workflows)
8. [ACC Integration](#acc-integration)
9. [Database Schema](#database-schema)
10. [API Reference](#api-reference)
11. [Configuration](#configuration)
12. [Development](#development)
13. [Documentation](#documentation)

---

## Overview

The MCE Project Intake & Ingestion Engine serves as the foundational data processing layer for Technical Advisory and Technical Due Diligence workflows. It processes Information Memorandums (IMs), Due Diligence packs, concept designs, grid studies, and other project documentation to build a structured Project Intelligence Base.

### Problem Statement

Renewable energy project due diligence involves processing hundreds of documents across multiple categories. Manual extraction is time-consuming, error-prone, and doesn't scale. This platform automates document ingestion, classification, and fact extraction while maintaining audit trails and enabling collaboration through ACC integration.

### Solution

The platform provides an end-to-end document processing pipeline that classifies documents automatically based on ISO 19650 standards, extracts key facts and metrics using hybrid AI techniques, synchronizes bidirectionally with Autodesk Construction Cloud, and maintains per-project data isolation for confidentiality.

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Document Upload** | Drag-and-drop upload with automatic file type detection and processing queue |
| **Hybrid Extraction** | Combines deterministic parsing (tables, headers) with LLM-based semantic extraction |
| **Document Classification** | Automatic categorization into ISO 19650-compliant folder structures |
| **Fact Extraction** | Extracts key metrics (capacity, coordinates, financial terms) into structured database |
| **ACC Integration** | Full bidirectional sync with Autodesk Construction Cloud (BIM 360/ACC) |
| **Batch Operations** | Process and sync multiple documents simultaneously with progress tracking |
| **Per-Project Databases** | Data sovereignty through isolated project databases |
| **Sync Status Tracking** | Visual indicators showing which documents are synced to ACC with direct links |

---

## Architecture

The system follows a layered architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (React 19)                          │
│  Tailwind CSS 4 │ shadcn/ui │ tRPC Client │ React Query              │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API Layer (tRPC + Express)                      │
│  Type-safe RPC │ Authentication │ File Upload │ WebSocket            │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
┌─────────────────────┐ ┌─────────────────┐ ┌─────────────────────────┐
│   Document Service  │ │   ACC Service   │ │   Extraction Service    │
│  Upload, Storage,   │ │  OAuth, Sync,   │ │  LLM, Parsing,          │
│  Classification     │ │  Folder Mgmt    │ │  Fact Extraction        │
└─────────────────────┘ └─────────────────┘ └─────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Data Layer (TiDB/MySQL)                       │
│  Drizzle ORM │ Per-Project Tables │ Migration Management             │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
┌─────────────────────┐ ┌─────────────────┐ ┌─────────────────────────┐
│    S3 Storage       │ │   APS APIs      │ │   OpenAI API            │
│  Document Files     │ │  ACC/BIM 360    │ │  LLM Extraction         │
└─────────────────────┘ └─────────────────┘ └─────────────────────────┘
```

---

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.x | UI framework |
| Tailwind CSS | 4.x | Styling |
| shadcn/ui | Latest | Component library |
| tRPC Client | 11.x | Type-safe API calls |
| TanStack Query | 5.x | Data fetching & caching |
| Wouter | 3.x | Routing |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 22.x | Runtime |
| Express | 4.x | HTTP server |
| tRPC | 11.x | Type-safe RPC |
| Drizzle ORM | Latest | Database ORM |
| Zod | 3.x | Schema validation |

### Infrastructure

| Technology | Purpose |
|------------|---------|
| TiDB/MySQL | Primary database |
| AWS S3 | Document storage |
| Autodesk APS | ACC integration |
| OpenAI API | LLM extraction |

---

## Getting Started

### Prerequisites

The system requires Node.js 22 or higher, pnpm package manager, a MySQL/TiDB database, AWS S3 bucket for file storage, Autodesk Platform Services credentials, and an OpenAI API key.

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/robachamilton-afk/mce-tools.git
cd mce-tools
pnpm install
```

### Environment Variables

Create a `.env` file with the required configuration:

```env
# Database
DATABASE_URL=mysql://user:password@host:port/database

# Authentication
JWT_SECRET=your-jwt-secret

# Autodesk Platform Services
APS_CLIENT_ID=your-aps-client-id
APS_CLIENT_SECRET=your-aps-client-secret

# OpenAI
OPENAI_API_KEY=your-openai-api-key

# S3 Storage
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_S3_BUCKET=your-bucket-name
```

### Running the Application

Start the development server:

```bash
pnpm dev
```

The application will be available at `http://localhost:3000`.

---

## Project Structure

```
project-ingestion-engine/
├── client/                    # Frontend React application
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── contexts/          # React contexts
│   │   ├── hooks/             # Custom hooks
│   │   ├── lib/               # Utilities and tRPC client
│   │   ├── pages/             # Page components
│   │   ├── App.tsx            # Main app with routing
│   │   └── index.css          # Global styles
│   └── public/                # Static assets
├── server/                    # Backend services
│   ├── _core/                 # Framework infrastructure
│   ├── accRouter.ts           # ACC integration endpoints
│   ├── accUpload.ts           # Low-level APS API calls
│   ├── accUploadService.ts    # Upload orchestration
│   ├── accFolderMapping.ts    # Document classification
│   ├── db.ts                  # Database helpers
│   └── routers.ts             # Main tRPC router
├── drizzle/                   # Database schema & migrations
│   ├── schema.ts              # Table definitions
│   └── *.sql                  # Migration files
├── shared/                    # Shared types & constants
├── storage/                   # S3 helpers
├── docs/                      # Documentation
│   └── ACC_INTEGRATION.md     # ACC integration guide
└── package.json
```

---

## Core Workflows

### Document Upload & Processing

The document upload workflow begins when users upload documents via drag-and-drop or file picker. The system then classifies documents based on filename patterns and content, queues documents for processing, extracts text and metadata using hybrid parsing, identifies and stores key facts in the database, and updates document status to "processed".

### ACC Synchronization

The ACC sync workflow authenticates with Autodesk using 3-legged OAuth, maps local projects to ACC projects, creates ISO 19650-compliant folder structure, uploads documents to appropriate folders, tracks sync status with ACC item IDs and web URLs, and enables batch operations for multiple documents.

---

## ACC Integration

The ACC integration is a core feature enabling seamless collaboration with Autodesk Construction Cloud. For comprehensive documentation, see [docs/ACC_INTEGRATION.md](docs/ACC_INTEGRATION.md).

### Quick Reference

| Operation | Endpoint | Description |
|-----------|----------|-------------|
| Connect | `acc.getAuthUrl` | Initiate OAuth flow |
| List Hubs | `acc.listHubs` | Get accessible hubs |
| List Projects | `acc.listProjects` | Get projects in hub |
| Sync Document | `acc.syncFiles` | Upload single document |
| Batch Sync | `acc.batchSync` | Upload multiple documents |
| Get Status | `acc.getSyncStatus` | Check sync status |

### Key Implementation Notes

The integration uses BIM360-specific types (`folders:autodesk.bim360:Folder`, `items:autodesk.bim360:File`) rather than core Autodesk types. File uploads require the signed S3 URL workflow with a mandatory completion step. Custom folders must be created under "Project Files", not the project root.

---

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `users` | User accounts and authentication |
| `projects` | Project metadata and settings |
| `documents` | Document records with processing status |
| `facts` | Extracted facts and metrics |
| `acc_credentials` | OAuth tokens for ACC |
| `acc_project_mapping` | Local to ACC project mapping |
| `acc_uploads` | Document sync status tracking |

### Per-Project Tables

Documents and facts are stored in project-specific tables using a prefix pattern (`proj_{projectId}_documents`, `proj_{projectId}_facts`) to ensure data isolation.

---

## API Reference

### Document Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `documents.list` | Query | List documents for a project |
| `documents.upload` | Mutation | Upload new document |
| `documents.process` | Mutation | Trigger document processing |
| `documents.delete` | Mutation | Delete a document |

### Project Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `projects.list` | Query | List user's projects |
| `projects.create` | Mutation | Create new project |
| `projects.update` | Mutation | Update project settings |

### ACC Endpoints

See [ACC Integration](#acc-integration) section for complete endpoint reference.

---

## Configuration

### Document Classification

Document types are configured in `server/accFolderMapping.ts`. The system supports Information Memorandums, Due Diligence Packs, Contracts, Grid Studies, Concept Designs, and Other Documents categories.

### Folder Structure

The ISO 19650-compliant folder structure is defined in `server/accFolderMapping.ts`:

```typescript
export const ACC_FOLDER_STRUCTURE = {
  PROJECT_MANAGEMENT: "01_PM",
  DATA_INCOMING: "02_Data_Incoming",
  DELIVERABLES: "03_Deliverables",
};
```

---

## Development

### Running Tests

```bash
pnpm test
```

### Database Migrations

Generate migration after schema changes:

```bash
pnpm drizzle-kit generate
```

Apply migrations using the `webdev_execute_sql` tool or database client.

### Code Style

The project uses TypeScript with strict mode, ESLint for linting, and Prettier for formatting.

---

## Documentation

| Document | Description |
|----------|-------------|
| [ACC Integration](docs/ACC_INTEGRATION.md) | Comprehensive ACC integration guide |
| [API Reference](docs/API.md) | Full API documentation (coming soon) |
| [Deployment Guide](docs/DEPLOYMENT.md) | Production deployment instructions (coming soon) |

---

## License

Proprietary - MCE Tools

## Contact

For questions or support, contact the MCE development team.
