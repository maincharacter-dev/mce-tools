
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
