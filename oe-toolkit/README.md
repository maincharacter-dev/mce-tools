# OE Toolkit - ACC Project Management

Owner's Engineer toolkit for managing Autodesk Construction Cloud (ACC) projects with automated ISO 19650 folder structure creation.

## Features

- **ACC OAuth Integration**: Secure authentication with Autodesk Construction Cloud
- **Automated Project Creation**: Create ACC projects with one click
- **Project Activation Polling**: Waits for ACC to fully provision projects before proceeding
- **Automatic User Assignment**: Creator is automatically added as project administrator
- **ISO 19650 Folder Structure**: Automated creation of TA/TDD phase folders
  - 01_PM (Project Management)
  - 02_Data_Incoming (with subfolders: IM, DDP, Contracts, Grid Studies, Concept Design, Other Documents)
  - 03_Deliverables
- **Database Integration**: Tracks projects, credentials, and folder structures
- **Dashboard Visibility**: Projects appear in user's ACC dashboard immediately

## Tech Stack

- **Frontend**: React 19 + Tailwind CSS 4 + Wouter
- **Backend**: Express + tRPC 11
- **Database**: MySQL/TiDB with Drizzle ORM
- **Auth**: Manus OAuth + Autodesk OAuth
- **API**: Autodesk Platform Services (APS) / ACC Admin API

## Getting Started

See the main MCE-tools repository README for setup instructions.

## Project Structure

```
oe-toolkit/
├── client/          # React frontend
├── server/          # Express + tRPC backend
│   ├── _core/      # Framework code (OAuth, tRPC setup)
│   ├── aps.ts      # Autodesk API integration
│   ├── accRouter.ts # ACC project management endpoints
│   └── routers.ts  # Main tRPC router
├── drizzle/         # Database schema and migrations
└── shared/          # Shared types and constants
```

## Key Implementation Details

### Project Creation Flow

1. User connects ACC account via OAuth
2. User creates new OE Toolkit project
3. System creates ACC project via Admin API
4. **Activation polling**: Waits for project status to reach "active" (~30-60s)
5. **User assignment**: Assigns creator as project administrator
6. **Folder provisioning**: Waits for ACC to provision folder structure
7. **Folder creation**: Creates ISO 19650 folder hierarchy
8. **Database update**: Records ACC project ID and hub ID

### API Quirks & Solutions

**Project Activation**: ACC projects go through an asynchronous activation process. The system polls `GET /construction/admin/v1/projects/:projectId` until both the project status and "docs" product status are "active".

**User Assignment**: The `POST /construction/admin/v2/projects/:projectId/users:import` endpoint requires **email only** (not userId), despite contradictory error messages.

**Folder Polling**: After project creation, ACC takes time to provision the folder structure. The system retries folder listing up to 10 times with exponential backoff.

## Future Enhancements

- [ ] "Transition to OE" feature to add construction monitoring folders (04-06)
- [ ] Project member management UI
- [ ] Progress indicators showing activation/folder creation status
- [ ] Project health check/repair tool for incomplete projects
- [ ] Bulk project operations

## License

Proprietary - Main Character Energy Consulting
