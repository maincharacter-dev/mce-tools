# OE Toolkit

**Main Character Energy - Project Management System**

OE Toolkit integrates three systems for consulting operations:
- **OE Toolkit** (Frontend/Coordination)
- **TA/TDD Engine** (Document Processing/Data Extraction)  
- **Autodesk Construction Cloud** (Document Storage/Collaboration)

---

## Features

### Project Management
- Create TA/TDD (Technical Advisory/Due Diligence) or OE (Owner's Engineer) projects
- Automatic integration with TA/TDD engine and ACC
- Archive/filter projects (All/Active/Archived)
- Transition TA/TDD projects to full OE scope

### ACC Integration
- OAuth authentication with Autodesk Platform Services
- Automated ACC project creation with ISO 19650-inspired folder structures
- Project admin assignment
- Folder structure management

### TA/TDD Engine Integration
- Shared database with table-prefix architecture (`proj_{id}_*`)
- Automatic table provisioning for each project
- Document storage and processing pipeline
- Extracted facts tracking

---

## ACC Folder Structures

### TA/TDD Projects
```
Project Files/
├── 01_PM
├── 02_Data_Incoming/
│   ├── Information_Memorandum
│   ├── Due_Diligence_Pack
│   ├── Contracts
│   ├── Grid_Studies
│   ├── Concept_Design
│   └── Other_Documents
└── 03_Deliverables
```

### OE Projects
```
Project Files/
├── 01_PM
├── 02_Data_Incoming
├── 03_Design_Review
├── 04_Construction_Monitoring
├── 05_Quality_Documentation_Review
├── 06_Project_Completion
└── 07_Deliverables
```

---

## Database Architecture

### Shared Tables
- `projects` - Master project list
- `users` - User accounts
- `accCredentials` - ACC OAuth tokens per user

### Per-Project Tables (with `proj_{id}_` prefix)
- `proj_{id}_documents` - Document metadata
- `proj_{id}_extracted_facts` - LLM-extracted data
- `proj_{id}_acc_credentials` - ACC tokens per project
- `proj_{id}_acc_project_mapping` - ACC project linkage
- `proj_{id}_processing_jobs` - Processing job tracking

---

## Tech Stack

**Frontend**
- React 19, TypeScript, Vite
- Tailwind CSS 4, shadcn/ui
- tRPC with React Query

**Backend**
- Node.js, Express 4
- tRPC 11 with superjson
- Drizzle ORM with MySQL/TiDB

**Integrations**
- Manus OAuth
- Autodesk Platform Services (APS)
- TA/TDD Engine (shared database)

---

## Setup

### Prerequisites
- Node.js 22+
- pnpm
- MySQL/TiDB database
- Autodesk Platform Services credentials
- Manus OAuth credentials

### Environment Variables
```env
DATABASE_URL=mysql://...
TA_TDD_DATABASE_URL=mysql://...
JWT_SECRET=...
VITE_APP_ID=...
OAUTH_SERVER_URL=...
VITE_OAUTH_PORTAL_URL=...
APS_CLIENT_ID=...
APS_CLIENT_SECRET=...
```

### Installation
```bash
pnpm install
pnpm db:push  # Apply database migrations
pnpm dev      # Start development server
```

---

## API Endpoints (tRPC)

### Auth
- `auth.me` - Get current user
- `auth.logout` - Logout

### Projects
- `projects.list` - List all projects
- `projects.create` - Create project (OE Toolkit + TA/TDD)
- `projects.archive` - Archive project
- `projects.transitionToOE` - Add OE folders to TA/TDD project

### ACC
- `acc.getAuthUrl` - Get OAuth URL
- `acc.handleCallback` - Exchange OAuth code
- `acc.listHubs` - List ACC hubs
- `acc.listProjects` - List ACC projects
- `acc.createProject` - Create ACC project with folders

---

## Known Limitations

1. **ACC API** - Cannot update project name/status (only BIM 360 supports this)
2. **Manual ACC Archiving** - Users must manually archive ACC projects
3. **No Document Upload** - Document upload feature not yet implemented

---

## Future Enhancements

- Document upload and ACC sync
- Document processing pipeline with LLM extraction
- Extracted facts viewer and verification UI
- Project dashboard with ACC status
- Bulk operations and search/export

---

## License

Proprietary - Main Character Energy © 2026
