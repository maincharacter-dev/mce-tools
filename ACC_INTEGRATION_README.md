# ACC Integration for OE Toolkit

## Overview

OE Toolkit now supports creating projects in Autodesk Construction Cloud (ACC) with proper ISO 19650 folder structures. This integration allows you to:

1. Create projects in OE Toolkit
2. Connect to ACC via OAuth 2.0
3. Automatically create ACC projects with the correct folder structure
4. Manage project lifecycle through different phases

## Architecture

### Database Schema

**projects table:**
- `id`: Auto-increment primary key
- `projectName`: Human-readable project name
- `projectCode`: Short project identifier (e.g., "SFP-001")
- `projectType`: Either "TA_TDD" or "OE"
- `phase`: Current project phase (e.g., "Initiation", "Development")
- `accProjectId`: ACC project ID (null until ACC project created)
- `accHubId`: ACC hub ID (null until ACC project created)
- `createdByUserId`: User who created the project
- `createdAt`, `updatedAt`: Timestamps

**accCredentials table:**
- `id`: Auto-increment primary key
- `projectId`: Foreign key to projects table
- `accessToken`: APS OAuth access token
- `refreshToken`: APS OAuth refresh token
- `expiresAt`: Token expiration timestamp
- `createdAt`, `updatedAt`: Timestamps

### Backend Components

**server/aps.ts:**
- APS (Autodesk Platform Services) API client
- Functions for OAuth, project creation, folder management
- Key functions:
  - `getAPSAuthUrl()`: Get OAuth authorization URL
  - `exchangeCodeForToken()`: Exchange auth code for tokens
  - `createACCProject()`: Create ACC project
  - `createFolder()`: Create folder in ACC project

**server/accRouter.ts:**
- tRPC router for ACC integration
- Endpoints:
  - `acc.getAuthUrl`: Get OAuth URL
  - `acc.exchangeCode`: Exchange OAuth code for tokens
  - `acc.getStoredCredentials`: Get stored ACC credentials
  - `acc.disconnect`: Remove ACC credentials
  - `acc.listHubs`: List accessible ACC hubs
  - `acc.listProjects`: List projects in a hub
  - `acc.createProject`: Create ACC project with folder structure

**server/routers.ts:**
- Main tRPC router
- Project management endpoints:
  - `projects.create`: Create new project
  - `projects.list`: List all projects
  - `projects.get`: Get project by ID
  - `projects.updatePhase`: Update project phase

### Frontend Components

**client/src/pages/Projects.tsx:**
- Projects list page
- Project creation dialog
- Displays project cards with status

## ISO 19650 Folder Structures

### TA/TDD Projects

```
Project Files/
├── 01_PM/
├── 02_Data_Incoming/
│   ├── Information_Memorandum/
│   ├── Due_Diligence_Pack/
│   ├── Contracts/
│   ├── Grid_Studies/
│   ├── Concept_Design/
│   └── Other_Documents/
└── 03_Deliverables/
```

### OE Projects

```
Project Files/
├── 01_PM/
├── 02_Data_Incoming/
├── 03_Design_Review/
├── 04_Construction_Monitoring/
├── 05_Quality_Documentation_Review/
├── 06_Project_Completion/
└── 07_Deliverables/
```

### Transition from TA/TDD to OE

When a TA/TDD project transitions to OE:
1. Keep existing folders (01_PM, 02_Data_Incoming)
2. Rename 03_Deliverables to 07_Deliverables
3. Add new OE folders (03-06)

## Usage Workflow

### 1. Create Project in OE Toolkit

```typescript
// User creates project via UI
const project = await trpc.projects.create.mutate({
  projectName: "Solar Farm Alpha",
  projectCode: "SFA-001",
  projectType: "TA_TDD",
});
```

### 2. Connect to ACC (OAuth)

```typescript
// Get OAuth URL
const { authUrl } = await trpc.acc.getAuthUrl.query({
  redirectUri: "https://your-app.com/callback",
  projectId: project.id,
});

// Redirect user to authUrl
// After OAuth callback, exchange code for tokens
await trpc.acc.exchangeCode.mutate({
  code: authCode,
  redirectUri: "https://your-app.com/callback",
  projectId: project.id,
});
```

### 3. Create ACC Project

```typescript
// List available hubs
const hubs = await trpc.acc.listHubs.query({ projectId: project.id });

// Create ACC project with folder structure
await trpc.acc.createProject.mutate({
  projectId: project.id,
  hubId: hubs[0].id,
  projectName: "Solar Farm Alpha",
  projectType: "TA_TDD",
});
```

## Environment Variables

Required environment variables (already configured in Manus):

- `APS_CLIENT_ID`: Autodesk Platform Services client ID
- `APS_CLIENT_SECRET`: Autodesk Platform Services client secret
- `DATABASE_URL`: MySQL/TiDB connection string

## Testing

Unit tests are located in `server/projects.test.ts`:

```bash
pnpm test
```

Tests cover:
- Project creation (TA/TDD and OE)
- Project listing
- Project retrieval
- Phase updates
- Input validation

## Next Steps

To complete the ACC integration:

1. **Implement OAuth Callback Page:**
   - Create `/callback` route
   - Handle OAuth code exchange
   - Redirect back to project page

2. **Add ACC Project Creation UI:**
   - Add "Connect to ACC" button on project detail page
   - Show ACC hub selection
   - Trigger ACC project creation

3. **Implement Project Detail Page:**
   - Show project information
   - Display ACC connection status
   - Allow phase transitions

4. **Add TA/TDD → OE Transition:**
   - Detect when TA/TDD project reaches financial close
   - Offer option to transition to OE
   - Extend ACC folder structure accordingly

5. **Integrate with TA/TDD Engine and OE Engine:**
   - Add REST endpoints to both engines
   - Call engine APIs when creating projects
   - Link OE Toolkit projects to engine projects

## Security Considerations

- ACC credentials are stored encrypted in the database
- OAuth tokens are automatically refreshed when expired
- All ACC operations require authentication
- Tokens are project-specific (not shared across projects)

## Troubleshooting

### "No ACC credentials found"
- User needs to complete OAuth flow first
- Check `accCredentials` table for stored tokens

### "Failed to create ACC project"
- Verify APS_CLIENT_ID and APS_CLIENT_SECRET are correct
- Ensure user has permission to create projects in the selected hub
- Check ACC API rate limits

### "Token expired"
- Tokens are automatically refreshed
- If refresh fails, user needs to re-authenticate

## API Reference

See `server/accRouter.ts` and `server/routers.ts` for complete API documentation.

## License

Internal use only - Main Character Energy Consulting
