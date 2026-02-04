# ACC Integration Setup Guide

This document explains how to set up the Autodesk Construction Cloud (ACC) integration for the Project Ingestion Engine.

## Overview

The ingestion engine integrates with Autodesk Construction Cloud to enable:
- Browsing ACC hubs and projects
- Selecting project folders and files
- Syncing documents from ACC for processing
- (Future) Uploading processed documents back to ACC

## Prerequisites

1. **Autodesk Platform Services (APS) App Registration**
   - Register your app at https://aps.autodesk.com
   - Note your Client ID and Client Secret
   - Set the callback URL to: `https://your-domain.com/api/acc/oauth/callback`

2. **BIM 360 Account Admin Access**
   - You must be an account administrator for the BIM 360/ACC account
   - Access to the BIM 360 Account Admin portal

## Critical Setup Step: Custom Integration

⚠️ **IMPORTANT: This step is REQUIRED for the integration to work.**

Without completing this setup, the ACC integration will fail with empty hub lists and permission errors.

### Why This Is Required

Autodesk Platform Services apps must be explicitly authorized to access BIM 360/ACC data through the "Custom Integrations" feature. Three-legged OAuth authentication alone is **not sufficient** to access BIM 360 hubs and projects.

According to the [official APS documentation](https://aps.autodesk.com/en/docs/bim360/v1/tutorials/getting-started/manage-access-to-docs/):

> An APS app needs to be connected to a specific BIM 360 account before you can start accessing that account using the BIM 360 API.

### Setup Instructions

Follow these steps to add the ingestion engine as a Custom Integration:

1. **Log in to BIM 360 Account Admin**
   - Navigate to https://admin.b360.autodesk.com
   - Select your BIM 360 account

2. **Navigate to Custom Integrations**
   - Click **Settings** in the top navigation
   - Select the **Custom Integrations** tab

3. **Add Custom Integration**
   - Click the **Add Custom Integration** button
   - Select the BIM 360 products you want to enable (e.g., BIM 360 Docs)
   - Click **Next**

4. **Configure Integration**
   - Select **I'm the developer**
   - Click **Next**

5. **Enter App Details**
   - **Forge Client ID**: Enter your APS app's Client ID
     - Example: `JxYfakNn1rsJj2mVehI3GvTXYGkmc3apm2vu8SvB4nrUlgXG`
   - **App Name**: Enter a descriptive name (e.g., "Project Ingestion Engine")
   - **App Description** (optional): Describe the app's purpose
   - **App Logo** (optional): Upload a logo
   - Check **I have saved the Account ID information securely**
   - Click **Save**

6. **Verify Setup**
   - The app should now appear in your Custom Integrations list
   - The status should show as "Active"

### Troubleshooting

**Problem**: Empty hub list or "You don't have permission to access this API" errors

**Solution**: Verify that:
1. The Custom Integration has been added with the correct Client ID
2. The integration status is "Active"
3. You're authenticating with the same Autodesk account that has access to the BIM 360 account
4. The integration has been approved (if added by invitation)

**Problem**: "Custom Integrations" tab is not visible

**Solution**: Not all accounts have automatic access to Custom Integrations. Contact Autodesk support at bim360appsactivations@autodesk.com with:
- BIM 360 Account Name
- Email address of the account admin
- BIM 360 Account ID (found in Settings → View Account ID)

## Environment Variables

Set the following environment variables in your deployment:

```bash
APS_CLIENT_ID=your_client_id_here
APS_CLIENT_SECRET=your_client_secret_here
```

These are automatically injected in the Manus platform. For local development, add them to your `.env` file.

## OAuth Scopes

The integration uses the following OAuth scopes:
- `data:read` - Read project data
- `data:write` - Write project data
- `data:create` - Create new items
- `account:read` - Read account information

## Testing the Integration

1. **Navigate to a project dashboard** in the ingestion engine
2. **Click "Authenticate with Autodesk"** in the ACC Project Browser
3. **Complete the OAuth flow** in the popup window
4. **Select a hub** from the dropdown (should show your BIM 360 account)
5. **Select a project** from the dropdown
6. **Browse folders and files** (when implemented)

If you see hubs and projects, the integration is working correctly!

## API Endpoints Used

The integration uses the following Autodesk APIs:

- **GET /project/v1/hubs** - List accessible hubs
- **GET /project/v1/hubs/:hub_id/projects** - List projects in a hub
- **GET /project/v1/hubs/:hub_id/projects/:project_id** - Get project details
- **GET /data/v1/projects/:project_id/folders/:folder_id/contents** - List folder contents (future)

## Security Considerations

- OAuth tokens are stored client-side and passed to the server for API calls
- Tokens are not persisted in the database
- Each user authenticates with their own Autodesk account
- The app only has access to projects the authenticated user can access

## References

- [Autodesk Platform Services Documentation](https://aps.autodesk.com/)
- [BIM 360 API Documentation](https://aps.autodesk.com/en/docs/bim360/v1/overview/)
- [Manage API Access to BIM 360 Docs](https://aps.autodesk.com/en/docs/bim360/v1/tutorials/getting-started/manage-access-to-docs/)
- [Data Management API Reference](https://aps.autodesk.com/en/docs/data/v2/reference/http/hubs-GET/)

## Support

For issues with:
- **Custom Integration setup**: Contact your BIM 360 account administrator
- **APS app registration**: Visit the [APS Developer Portal](https://aps.autodesk.com/)
- **Integration code**: Check the project repository or contact the development team
