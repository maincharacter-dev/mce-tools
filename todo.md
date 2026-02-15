
## Phase 2: OAuth Callback and Project Detail Pages

- [x] Create OAuth callback page (/callback route)
- [x] Handle OAuth code exchange in callback page
- [x] Display success/error messages after OAuth
- [x] Redirect back to project page after successful auth
- [x] Create project detail page (/projects/:id route)
- [x] Display project information (name, code, type, phase)
- [x] Show ACC connection status
- [x] Add "Connect to ACC" button for unconnected projects
- [x] Show ACC hub selection dialog
- [x] Trigger ACC project creation with folder structure
- [x] Display ACC project link after creation

## Phase 3: Project Transition

- [x] Add transition button for TA/TDD projects with ACC
- [x] Create transition confirmation dialog
- [x] Implement backend logic to extend folder structure
- [x] Update project type from TA_TDD to OE
- [x] Preserve existing folders and add new OE folders
- [x] Test transition workflow end-to-end

## Navigation Fix

- [x] Investigate why Projects and Tools links are not visible to user
- [x] Fix navigation header visibility/styling
- [x] Ensure navigation works on all pages
- [x] Test project creation flow from home page

## Mobile Navigation Fix

- [x] Add Projects link to mobile hamburger menu
- [x] Add Tools link to mobile hamburger menu  
- [x] Test mobile navigation on actual device
- [x] Ensure menu closes after clicking link

## Database Cleanup for ACC Testing

- [ ] Clear test projects from database
- [ ] Clear test ACC credentials from database
- [ ] Verify fresh project creation works
- [ ] Test ACC OAuth connection flow

## ACC Connection Status Fix

- [x] Fix hasAccCredentials check to verify actual user credentials exist
- [x] Update ProjectDetail page to show correct connection status
- [x] Test OAuth flow shows "Connect to ACC" when not connected
- [x] Test shows "Connected" only after successful OAuth

## Refactor ACC Credentials to User-Level

- [x] Update accCredentials schema to use userId instead of projectId
- [x] Add migration to handle existing data
- [x] Update getStoredCredentials to query by userId
- [x] Update exchangeCode to store credentials by userId
- [x] Update all ACC API calls to use user credentials
- [x] Update ProjectDetail UI to show user-level auth status
- [x] Test OAuth flow with user-level credentials

## Fix OAuth Consent Screen Issue

- [x] Investigate getAuthUrl implementation in ACC router
- [x] Check OAuth URL parameters (response_type, scope, prompt)
- [x] Verify APS application settings (OAuth flow type)
- [x] Fix OAuth URL to show consent screen instead of login (removed prompt: "login")
- [ ] Test OAuth flow shows "Allow OE Toolkit to access..." screen

## Compare OAuth with TA/TDD Engine

- [x] Find TA/TDD engine OAuth implementation (mce-tools)
- [x] Compare OAuth URL parameters
- [x] Compare OAuth flow (popup vs redirect)
- [x] Identify why consent screen isn't showing (need popup window)
- [x] Implement popup window OAuth flow like mce-tools
- [x] Update callback to use postMessage
- [x] Update ProjectDetail to open popup and listen for postMessage

## Fix ACC Project Creation Error

- [x] Check createACCProject API endpoint and request format
- [x] Compare with mce-tools implementation  
- [x] Fix endpoint URL (use ACC Admin API not Data Management API)
- [x] Add account:write OAuth scope
- [ ] Test project creation successfully creates ACC project
- [ ] Verify folder structure is created correctly

## Debug HTML Response from ACC API

- [ ] Check server logs for actual response content
- [ ] Verify endpoint URL is correct
- [ ] Check if authentication is working properly
- [ ] Test with different request format
- [ ] Compare with working mce-tools implementation if available

## Fix Project ID Format Mismatch

- [x] Check what ID format ACC Admin API returns (UUID)
- [x] Check what ID format Data Management API expects (b.{UUID})
- [x] Add logging to see the actual project ID returned
- [x] Map between ACC Admin project ID and Data Management project ID (add b. prefix)
- [ ] Test folder creation with correct ID format

## Add Retry Logic for Project Provisioning

- [x] Add sleep/delay function after project creation
- [x] Implement retry logic for listProjectFolders with exponential backoff (2s, 4s, 8s, 16s)
- [x] Add maximum retry attempts (5 times)
- [x] Log retry attempts for debugging
- [ ] Test that folder creation succeeds after retry

## ACC Project Cleanup Features

- [x] Add listACCProjects endpoint to list all projects in hub
- [x] Add deleteACCProject endpoint to delete projects by ID
- [x] Build ACC Projects management page/dialog
- [x] Show list of all ACC projects with delete buttons
- [x] Add confirmation dialog before deletion
- [x] Fix project creation to properly handle 409 errors
- [x] Stop execution when project creation fails
- [x] Show user-friendly error message for duplicate names

## Fix listACCProjects Response Parsing

- [x] Add logging to see actual API response structure
- [x] Fix response parsing to extract projects array correctly (use data.results)
- [ ] Test that projects list shows actual ACC projects

## Fix ACC Project Visibility - Implement Activation Polling

- [x] Add pollProjectActivation function in aps.ts to check project status
- [x] Poll GET /construction/admin/v1/projects/:projectId until status is "active"
- [x] Check products array - ensure "docs" product is "active"
- [x] Implement exponential backoff (2s, 4s, 8s, 16s, 32s)
- [x] Add maximum retry attempts (10 times, ~2 minutes total)
- [x] Update createACCProject in accRouter to call pollProjectActivation before folder creation
- [x] Add logging for activation status checks
- [ ] Test that projects appear in ACC web interface after activation
- [ ] Verify folder creation only happens after full activation

## Add Automatic Project Admin Assignment

- [x] Get user's Autodesk user ID from access token or API
- [x] Add assignProjectAdmin function in aps.ts to call POST projects/:projectId/users:import
- [x] Update createACCProject mutation to assign current user as project admin after activation
- [ ] Test that user appears as project member in ACC
- [ ] Verify project appears in user's ACC dashboard (not just Account Admin)

## Fix User Assignment and Folder Polling Issues

- [x] Fix assignProjectAdmin to send only userId (not both email and userId)
- [x] Increase folder polling max retries from 5 to 10
- [ ] Increase folder polling timeout or add longer delays
- [ ] Test complete flow: project creation → activation → user assignment → folder creation

## Fix User Assignment API - Use Email Instead of UserId

- [x] Change assignProjectAdmin to send only email field (not userId)
- [x] API requires email as mandatory field despite contradictory error messages
- [x] Test complete flow with email-based assignment

## Fix Folder Structure to Match Agreed ISO 19650 Design

- [x] Review the agreed folder structure from earlier conversation
- [x] Update folder creation code in accRouter.ts to match correct structure
- [x] Test folder creation with new structure
- [x] Verify folders appear correctly in ACC

## Fix UI Error Message Despite Successful ACC Creation

- [ ] Investigate why UI shows error when ACC project is created successfully
- [ ] Check if database update is failing after folder creation
- [ ] Add try-catch around database update with better error handling
- [ ] Test that UI shows success message when project is created


## Integrate with TA/TDD Engine

- [x] Add ACC integration fields to OE Toolkit projects table (taTddProjectId, taTddDbName)
- [x] Create TA/TDD database connection helper (taTddIntegration.ts)
- [x] Update OE Toolkit project creation to also create TA/TDD engine project
- [x] Link OE Toolkit project ID with TA/TDD engine project ID
- [x] Store ACC mapping in TA/TDD per-project database
- [x] Store ACC credentials in TA/TDD per-project database
- [ ] Test end-to-end project creation (OE Toolkit → TA/TDD → ACC)
- [ ] Verify TA/TDD engine can sync documents to ACC using stored credentials


## Configure TA/TDD Database Access

- [x] Add TA_TDD_DATABASE_URL environment variable
- [x] Update taTddIntegration.ts to use TA_TDD_DATABASE_URL instead of hardcoded connection
- [ ] Test project creation with shared database access (blocked by sandbox file descriptor limit)
- [x] Document database credentials setup in README


## Disable File Watching to Fix Dev Server

- [x] Update package.json dev script to use tsx without --watch flag
- [x] Restart dev server and verify it starts successfully
- [x] Document that manual restart is needed after code changes


## Fix TA/TDD Integration - Use Table Prefix Architecture

- [ ] Read TA/TDD table-prefix-helper.ts and project-table-provisioner.ts
- [ ] Understand how TA/TDD creates per-project tables with prefixes
- [ ] Rewrite taTddIntegration.ts to create prefixed tables instead of databases
- [ ] Update createTaTddProject to use table provisioning logic
- [ ] Test project creation with table prefix architecture

## Archive Feature
- [x] Add archive button to project list and detail pages
- [x] Implement ACC project rename API call (add "[Archived]" suffix)
- [x] Implement ACC project archive API call
- [x] Create archiveProject tRPC mutation
- [x] Update project status to "Archived" in OE Toolkit database
- [x] Update project status to "Archived" in TA/TDD database
- [x] Add confirmation dialog before archiving
- [ ] Test archive workflow end-to-end

## Fix ACC Archive + Add Tabs
- [x] Add debug logging to archive mutation to see why ACC operations skipped
- [x] Research correct ACC API endpoints for updating project name and status
- [x] Confirmed ACC API doesn't support updating project properties
- [x] Remove ACC rename/archive operations from archive mutation
- [x] Add All/Active/Archived filter tabs to Projects page
- [x] Filter projects based on selected tab

## Fix Duplicate Key Error on Project Creation
- [x] Investigate why taTddProjectId constraint is failing
- [x] Check if taTddProjectId should be unique or allow duplicates
- [x] Fix schema or project creation logic to handle archived projects
- [x] Removed unique constraint from projectCode
- [ ] Test creating new project after archiving

## AI Agent Integration (Clean Redo)
- [x] Save safety checkpoint before any changes (06f183e1)
- [x] Install @oe-ecosystem/ai-agent from GitHub
- [x] Verify existing site still works after install
- [x] Verified agent tables already exist in TA/TDD database (no migration needed)
- [x] Dropped mistaken agent tables from Manus DB
- [x] Create agentRouter.ts wrapper (server/routers/agent.ts) connecting to TA/TDD DB
- [x] Mount agent router in routers.ts
- [x] Create agent-trpc.ts typed helper for frontend
- [x] Create Knowledge Base page (CRUD, search, filter, seed)
- [x] Create Agent Chat page (conversation sidebar, message history, project context)
- [x] Create Agent Stats page (knowledge stats, conversation stats, tools list)
- [x] Add routes in App.tsx (/agent, /agent/knowledge, /agent/stats)
- [x] Add navigation links (header nav, mobile menu, tools grid)
- [x] Add AI Agent tool card on home page
- [x] Write agent integration tests (3 passing)
- [x] Test full integration

## Fix Agent Chat Project Selection
- [x] Fix chat mutation to properly omit projectId when "none" is selected
- [x] Populate project dropdown with real projects from database
- [x] Test agent chat works without project selection
- [x] Test agent chat works with project selection

## Fix Agent Chat ProjectId Validation and TA/TDD Projects
- [x] Check agent router input schema and make projectId truly optional (fixed in ai-agent commit cfd45ea)
- [x] Updated @oe-ecosystem/ai-agent package to commit cfd45ea
- [x] Create tRPC endpoint to fetch projects from TA/TDD shared database (taTddProjects.list)
- [x] Update AgentChat dropdown to query TA/TDD projects instead of local projects
- [x] Test agent chat without project selection (no validation error)
- [x] Test agent chat with TA/TDD project selection

## Fix Agent Conversation Creation with Null ProjectId
- [x] Reported issue to ai-agent dev team (projectId undefined becomes empty string instead of NULL)
- [x] Updated @oe-ecosystem/ai-agent to commit 15ff04f (fixes null handling)
- [x] Tested agent chat without project selection (conversation creation works)
