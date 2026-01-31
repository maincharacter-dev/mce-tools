# ACC Integration Setup - Critical Requirement

## ⚠️ IMPORTANT: Custom Integration Setup Required

**Any application integrating with Autodesk Construction Cloud (ACC) or BIM 360 MUST be added as a Custom Integration in the BIM 360 Account Admin portal before it can access hubs and projects.**

Without this setup, the application will fail with:
- Empty hub lists from the `/project/v1/hubs` API
- 403 "You don't have permission to access this API" errors
- BIM360DM_ERROR responses

## Why This Is Required

Autodesk Platform Services (APS) apps require explicit authorization to access BIM 360/ACC data through the "Custom Integrations" feature. **Three-legged OAuth authentication alone is NOT sufficient** to access BIM 360 hubs and projects.

This is a security measure by Autodesk to ensure account administrators have full control over which applications can access their BIM 360/ACC data.

## Setup Instructions

### Prerequisites
- BIM 360 Account Admin access
- Your APS app's Client ID (from https://aps.autodesk.com)

### Steps

1. **Log in to BIM 360 Account Admin**
   - Navigate to https://admin.b360.autodesk.com
   - Select your BIM 360 account

2. **Navigate to Custom Integrations**
   - Click **Settings** in the top navigation
   - Select the **Custom Integrations** tab

3. **Add Custom Integration**
   - Click **Add Custom Integration**
   - Select BIM 360 products to enable (e.g., BIM 360 Docs)
   - Click **Next**

4. **Configure Integration**
   - Select **I'm the developer**
   - Click **Next**

5. **Enter App Details**
   - **Forge Client ID**: Enter your APS app's Client ID
   - **App Name**: Enter a descriptive name
   - Check **I have saved the Account ID information securely**
   - Click **Save**

6. **Verify**
   - The app should appear in your Custom Integrations list with "Active" status

## Troubleshooting

### Empty Hub List
**Symptom**: The `/project/v1/hubs` API returns an empty `data` array

**Cause**: The app has not been added as a Custom Integration

**Solution**: Follow the setup instructions above

### Permission Errors
**Symptom**: 403 errors with "BIM360DM_ERROR" or "You don't have permission to access this API"

**Cause**: 
- Custom Integration not set up, OR
- Wrong Client ID entered in Custom Integration, OR
- Integration not approved (if added by invitation)

**Solution**: 
- Verify the Custom Integration exists and is active
- Verify the Client ID matches exactly
- Check that the integration has been approved by the account admin

### Custom Integrations Tab Not Visible
**Symptom**: Cannot find the Custom Integrations tab in Settings

**Cause**: Not all accounts have automatic access to this feature

**Solution**: Contact Autodesk support at bim360appsactivations@autodesk.com with:
- BIM 360 Account Name
- Email address of the account admin
- BIM 360 Account ID (Settings → View Account ID)

## Technical Details

### API Behavior Without Custom Integration

When an APS app is NOT added as a Custom Integration:

```json
// GET /project/v1/hubs response
{
  "jsonapi": { "version": "1.0" },
  "links": { "self": { "href": "/project/v1/hubs" } },
  "data": [],  // Empty array - no hubs accessible
  "meta": {
    "warnings": [
      {
        "HttpStatusCode": "403",
        "ErrorCode": "BIM360DM_ERROR",
        "Title": "Unable to get hubs from BIM360DM US.",
        "Detail": "You don't have permission to access this API"
      }
      // ... similar errors for other regions
    ]
  }
}
```

### API Behavior With Custom Integration

After adding the app as a Custom Integration:

```json
// GET /project/v1/hubs response
{
  "jsonapi": { "version": "1.0" },
  "links": { "self": { "href": "/project/v1/hubs" } },
  "data": [
    {
      "type": "hubs",
      "id": "b.cc47fb63-473c-4d21-b859-ad6b679007f1",
      "attributes": {
        "name": "Your BIM 360 Account",
        "extension": {
          "type": "hubs:autodesk.bim360:Account",
          "version": "1.0"
        },
        "region": "US"
      },
      "links": {
        "self": {
          "href": "/project/v1/hubs/b.cc47fb63-473c-4d21-b859-ad6b679007f1"
        }
      },
      "relationships": {
        "projects": {
          "links": {
            "related": {
              "href": "/project/v1/hubs/b.cc47fb63-473c-4d21-b859-ad6b679007f1/projects"
            }
          }
        }
      }
    }
  ]
}
```

## References

- [Official APS Documentation: Manage API Access to BIM 360 Docs](https://aps.autodesk.com/en/docs/bim360/v1/tutorials/getting-started/manage-access-to-docs/)
- [Official APS Documentation: Get Access to a BIM 360 Account](https://aps.autodesk.com/en/docs/bim360/v1/tutorials/getting-started/get-access-to-account/)
- [Data Management API Reference](https://aps.autodesk.com/en/docs/data/v2/reference/http/hubs-GET/)

## Summary

**Remember**: Custom Integration setup is a **mandatory prerequisite** for any ACC/BIM 360 integration. Plan for this step in your deployment process and ensure account administrators complete it before expecting the integration to work.
