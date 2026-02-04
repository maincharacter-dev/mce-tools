# Autodesk Construction Cloud (ACC) Integration

This document provides comprehensive documentation of the ACC integration implemented in the MCE Project Intake & Ingestion Engine. The integration enables bidirectional synchronization between the local document management system and Autodesk Construction Cloud (BIM 360/ACC).

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Authentication Flow](#authentication-flow)
4. [API Endpoints](#api-endpoints)
5. [Folder Structure & ISO 19650 Compliance](#folder-structure--iso-19650-compliance)
6. [File Upload Workflow](#file-upload-workflow)
7. [Key Implementation Files](#key-implementation-files)
8. [Database Schema](#database-schema)
9. [Error Handling](#error-handling)
10. [Future Considerations](#future-considerations)

---

## Overview

The ACC integration provides the following capabilities:

| Feature | Description |
|---------|-------------|
| **OAuth Authentication** | Secure 3-legged OAuth 2.0 flow with Autodesk Platform Services (APS) |
| **Hub & Project Discovery** | Browse ACC hubs and projects to establish project mappings |
| **Folder Navigation** | Navigate ACC folder structure with type-aware folder creation |
| **Document Sync (Inbound)** | Pull documents from ACC into the local system |
| **Document Sync (Outbound)** | Push processed documents to ACC with ISO 19650 folder structure |
| **Batch Operations** | Sync multiple documents simultaneously with progress tracking |
| **Sync Status Tracking** | Track which documents have been synced with ACC links |

---

## Architecture

The ACC integration follows a layered architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                          │
│  - Documents.tsx (sync UI, batch selection, status badges)       │
│  - ACC Inspector (folder structure debugging tool)               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    tRPC Router (accRouter.ts)                    │
│  - Authentication endpoints (getAuthUrl, exchangeCode)           │
│  - Project mapping (saveProjectMapping, getProjectMapping)       │
│  - Folder operations (listFolderContents, inspectFolderStructure)│
│  - Sync operations (syncFiles, batchSync, getSyncStatus)         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Service Layer                                 │
│  - accUploadService.ts (orchestrates upload workflow)            │
│  - accUpload.ts (low-level APS API calls)                        │
│  - accFolderMapping.ts (document type → folder path mapping)     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Autodesk Platform Services (APS) APIs               │
│  - Data Management API (folders, items, versions)                │
│  - OSS API (Object Storage Service for file bytes)               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Authentication Flow

The integration uses Autodesk's 3-legged OAuth 2.0 flow for user authentication.

### Environment Variables

| Variable | Description |
|----------|-------------|
| `APS_CLIENT_ID` | Autodesk application client ID |
| `APS_CLIENT_SECRET` | Autodesk application client secret |

### OAuth Flow Steps

1. **Initiate Auth**: Frontend calls `trpc.acc.getAuthUrl` to get the Autodesk login URL
2. **User Login**: User is redirected to Autodesk login page
3. **Callback**: Autodesk redirects back with authorization code
4. **Token Exchange**: Backend calls `trpc.acc.exchangeCode` to exchange code for tokens
5. **Token Storage**: Access and refresh tokens are stored in `acc_credentials` table (per-project)
6. **Token Refresh**: Tokens are automatically refreshed when expired

### Token Storage Schema

```sql
CREATE TABLE acc_credentials (
  id INT PRIMARY KEY AUTO_INCREMENT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Implementation Details

The OAuth implementation is in `server/accRouter.ts`:

```typescript
// Generate authorization URL
getAuthUrl: publicProcedure.query(async () => {
  const authUrl = `https://developer.api.autodesk.com/authentication/v2/authorize?` +
    `response_type=code&` +
    `client_id=${APS_CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `scope=${encodeURIComponent(scopes)}`;
  return { authUrl };
});

// Exchange authorization code for tokens
exchangeCode: publicProcedure.mutation(async ({ input }) => {
  const tokenResponse = await fetch(
    'https://developer.api.autodesk.com/authentication/v2/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: input.code,
        client_id: APS_CLIENT_ID,
        client_secret: APS_CLIENT_SECRET,
        redirect_uri: redirectUri,
      }),
    }
  );
  // Store tokens in database...
});
```

---

## API Endpoints

### Authentication Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `acc.getAuthUrl` | Query | Get Autodesk OAuth authorization URL |
| `acc.exchangeCode` | Mutation | Exchange auth code for access tokens |
| `acc.getStoredCredentials` | Query | Retrieve stored credentials for a project |
| `acc.disconnect` | Mutation | Remove ACC connection for a project |

### Project & Folder Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `acc.listHubs` | Query | List all accessible ACC hubs |
| `acc.listProjects` | Query | List projects within a hub |
| `acc.listProjectFolders` | Query | List root folders in a project |
| `acc.listFolderContents` | Query | List contents of a specific folder |
| `acc.inspectFolderStructure` | Query | Debug tool to inspect folder types and allowed types |

### Sync Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `acc.syncFiles` | Mutation | Sync files from ACC to local system |
| `acc.batchSync` | Mutation | Upload multiple documents to ACC |
| `acc.getSyncStatus` | Query | Get sync status for documents |
| `acc.saveProjectMapping` | Mutation | Save ACC project mapping for local project |
| `acc.getProjectMapping` | Query | Get ACC project mapping for local project |

---

## Folder Structure & ISO 19650 Compliance

The integration implements an ISO 19650-compliant folder structure for organizing documents in ACC.

### Folder Hierarchy

```
Project Root
└── Project Files (ACC system folder)
    ├── 01_PM (Project Management)
    ├── 02_Data_Incoming (Client documents)
    │   ├── Information_Memorandum
    │   ├── Due_Diligence_Pack
    │   ├── Contracts
    │   ├── Grid_Studies
    │   ├── Concept_Design
    │   └── Other_Documents
    └── 03_Deliverables (MCE outputs)
        ├── Data_Extraction
        ├── Technical_Advisory
        ├── Commercial_Advisory
        ├── Due_Diligence
        └── Procurement_Support
```

### Document Type Classification

Documents are automatically classified based on filename patterns:

| Document Type | Folder | Filename Patterns |
|---------------|--------|-------------------|
| `IM` | Information_Memorandum | "information memorandum", "im_" |
| `DD_PACK` | Due_Diligence_Pack | "due diligence", "dd_pack", "data room" |
| `CONTRACT` | Contracts | "contract", "agreement", "ppa", "lease" |
| `GRID_STUDY` | Grid_Studies | "grid", "connection", "nscas", "dnsp", "tnsp" |
| `CONCEPT_DESIGN` | Concept_Design | "concept", "design", "layout", "preliminary" |
| `OTHER` | Other_Documents | Default fallback |

### Implementation

The folder mapping logic is in `server/accFolderMapping.ts`:

```typescript
export function getInputDocumentFolderPath(documentType: DocumentType): string[] {
  const category = DATA_INCOMING_CATEGORIES[documentType] || DATA_INCOMING_CATEGORIES.OTHER;
  return [ACC_FOLDER_STRUCTURE.DATA_INCOMING, category];
}

export function classifyDocumentType(fileName: string): DocumentType {
  const lowerFileName = fileName.toLowerCase();
  
  if (lowerFileName.includes("information memorandum") || lowerFileName.includes("im_")) {
    return "IM";
  }
  // ... other classifications
  
  return "OTHER"; // Default fallback
}
```

---

## File Upload Workflow

The file upload process involves multiple steps to comply with Autodesk's API requirements.

### Upload Sequence Diagram

```
┌─────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────┐
│ Client  │     │ accUpload   │     │ APS Data    │     │ APS OSS │
│         │     │ Service     │     │ Management  │     │         │
└────┬────┘     └──────┬──────┘     └──────┬──────┘     └────┬────┘
     │                 │                   │                  │
     │ Sync to ACC     │                   │                  │
     │────────────────>│                   │                  │
     │                 │                   │                  │
     │                 │ Get Project Files │                  │
     │                 │ Folder ID         │                  │
     │                 │──────────────────>│                  │
     │                 │<──────────────────│                  │
     │                 │                   │                  │
     │                 │ Create/Get Folder │                  │
     │                 │ (02_Data_Incoming)│                  │
     │                 │──────────────────>│                  │
     │                 │<──────────────────│                  │
     │                 │                   │                  │
     │                 │ Create Storage    │                  │
     │                 │ Location          │                  │
     │                 │──────────────────>│                  │
     │                 │<──────────────────│                  │
     │                 │                   │                  │
     │                 │ Get Signed S3 URL │                  │
     │                 │─────────────────────────────────────>│
     │                 │<─────────────────────────────────────│
     │                 │                   │                  │
     │                 │ Upload to S3      │                  │
     │                 │─────────────────────────────────────>│
     │                 │<─────────────────────────────────────│
     │                 │                   │                  │
     │                 │ Complete Upload   │                  │
     │                 │─────────────────────────────────────>│
     │                 │<─────────────────────────────────────│
     │                 │                   │                  │
     │                 │ Create Item       │                  │
     │                 │──────────────────>│                  │
     │                 │<──────────────────│                  │
     │                 │                   │                  │
     │ Success + URL   │                   │                  │
     │<────────────────│                   │                  │
```

### Critical Implementation Details

#### 1. BIM360/ACC Folder Types

ACC uses specific folder and item types that differ from standard Autodesk types:

```typescript
// WRONG - Will cause FOLDER_VIOLATION error
const folderType = "folders:autodesk.core:Folder";

// CORRECT - BIM360/ACC specific type
const folderType = "folders:autodesk.bim360:Folder";
```

The same applies to items:

```typescript
// CORRECT types for BIM360/ACC
const itemType = "items:autodesk.bim360:File";
const versionType = "versions:autodesk.bim360:File";
```

#### 2. Signed S3 Upload (Required)

The legacy OSS upload endpoint is deprecated. Files must be uploaded using signed S3 URLs:

```typescript
// Step 1: Get signed URL
const signedUrlResponse = await fetch(
  `${APS_DATA_URL}/oss/v2/buckets/${bucket}/objects/${objectKey}/signeds3upload`,
  {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  }
);
const { urls, uploadKey } = await signedUrlResponse.json();

// Step 2: Upload to S3 (NO Authorization header)
await fetch(urls[0], {
  method: 'PUT',
  headers: { 'Content-Type': 'application/octet-stream' },
  body: fileBuffer,
});

// Step 3: Complete the upload (REQUIRED)
await fetch(
  `${APS_DATA_URL}/oss/v2/buckets/${bucket}/objects/${objectKey}/signeds3upload`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uploadKey }),
  }
);
```

#### 3. Project Files Folder Requirement

In ACC, custom folders cannot be created directly under the project root. They must be created under "Project Files":

```typescript
// Get the "Project Files" folder first
const projectFilesFolderId = await getProjectFilesFolderId(accessToken, projectId);

// Then create custom folders under it
const customFolder = await createFolder(
  accessToken,
  projectId,
  projectFilesFolderId,  // Parent must be "Project Files"
  "02_Data_Incoming"
);
```

---

## Key Implementation Files

| File | Purpose |
|------|---------|
| `server/accRouter.ts` | tRPC router with all ACC-related endpoints |
| `server/accUpload.ts` | Low-level APS API functions (createFolder, uploadToOSS, createItem) |
| `server/accUploadService.ts` | High-level upload orchestration and document classification |
| `server/accFolderMapping.ts` | Document type to folder path mapping (ISO 19650) |
| `drizzle/schema.ts` | Database schema including `acc_credentials`, `acc_uploads`, `acc_project_mapping` |
| `client/src/pages/Documents.tsx` | Frontend UI for sync operations and status display |
| `client/src/pages/ACCInspector.tsx` | Debug tool for inspecting ACC folder structure |

---

## Database Schema

### acc_credentials

Stores OAuth tokens per project:

```sql
CREATE TABLE acc_credentials (
  id INT PRIMARY KEY AUTO_INCREMENT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### acc_project_mapping

Maps local projects to ACC projects:

```sql
CREATE TABLE acc_project_mapping (
  id INT PRIMARY KEY AUTO_INCREMENT,
  project_id INT NOT NULL,
  acc_hub_id VARCHAR(100) NOT NULL,
  acc_project_id VARCHAR(100) NOT NULL,
  acc_project_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### acc_uploads

Tracks document sync status:

```sql
CREATE TABLE acc_uploads (
  id INT PRIMARY KEY AUTO_INCREMENT,
  document_id VARCHAR(36) NOT NULL,
  acc_item_id VARCHAR(255) NOT NULL,
  acc_folder_path VARCHAR(500),
  acc_file_name VARCHAR(255),
  upload_status ENUM('pending', 'success', 'failed') DEFAULT 'pending',
  upload_error TEXT,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Error Handling

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `FOLDER_VIOLATION: Type 'folders:autodesk.core:Folder' is not allowed` | Using wrong folder type for BIM360/ACC | Use `folders:autodesk.bim360:Folder` |
| `Legacy endpoint is deprecated` | Using old OSS upload endpoint | Use signed S3 URL workflow |
| `ERR_INVALID_STORAGE_URN` | Upload not completed before creating item | Call POST signeds3upload to complete upload |
| `Required properties are missing: name` | Empty folder name | Ensure document type classification returns valid category |
| `Unknown column 'file_name'` | Wrong column name case | Use camelCase (`fileName`) for project database queries |

### Error Logging

All ACC operations include detailed logging:

```typescript
console.log(`[ACC Upload Service] Starting upload for document ${documentId} (${fileName})`);
console.log(`[ACC Upload Service] Classified document type: ${finalDocType}`);
console.log(`[ACC Upload Service] Target folder path: ${folderPath}`);
console.log(`[ACC Upload Service] Upload completed successfully`);
```

---

## Future Considerations

### Document Classification Improvements

The current classification logic is based on simple filename pattern matching. Future improvements could include:

1. **Content-based classification**: Analyze document content using NLP/LLM to determine document type
2. **User-defined mappings**: Allow users to define custom classification rules
3. **Machine learning**: Train a classifier on historical document categorizations

### Additional Features

1. **Version management**: Track and manage document versions in ACC
2. **Superseded documents**: Move old versions to `_SS` (superseded) folders
3. **Deliverables export**: Push MCE-generated reports to `03_Deliverables` folder
4. **Webhook integration**: Receive notifications when documents are added/modified in ACC
5. **Two-way sync**: Automatically sync changes from ACC back to local system

---

## References

- [Autodesk Platform Services Documentation](https://aps.autodesk.com/en/docs/data/v2/overview/)
- [Data Management API Reference](https://aps.autodesk.com/en/docs/data/v2/reference/http/)
- [BIM 360 Folder Types](https://aps.autodesk.com/en/docs/bim360/v1/tutorials/document-management/)
- [ISO 19650 Information Management](https://www.iso.org/standard/68078.html)
