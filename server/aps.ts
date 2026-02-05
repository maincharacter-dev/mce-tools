import { ENV } from './_core/env';
import fs from 'fs';

// Debug log file
const DEBUG_LOG = '/tmp/acc-upload-debug.log';
function debugLog(message: string) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  console.log(message);
  try {
    fs.appendFileSync(DEBUG_LOG, logLine);
  } catch (e) {
    // Ignore file write errors
  }
}

const APS_AUTH_URL = "https://developer.api.autodesk.com/authentication/v2";
const APS_DATA_URL = "https://developer.api.autodesk.com";
const APS_ACC_URL_V1 = "https://developer.api.autodesk.com/construction/assets/v1";
const APS_ACC_URL_V2 = "https://developer.api.autodesk.com/construction/assets/v2";
const APS_LOCATIONS_URL = "https://developer.api.autodesk.com/construction/locations/v2";

export interface APSTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

export interface APSHub {
  id: string;
  name: string;
}

export interface APSProject {
  id: string;
  name: string;
  hub_id: string;
}

export interface APSCategory {
  id: string;
  name: string;
  statusSetId?: string;
  isRoot?: boolean;
  isLeaf?: boolean;
}

export interface APSAsset {
  clientAssetId: string;
  categoryId: string;
  statusId: string;
  description?: string;
  locationId?: string;
  barcode?: string;
  customAttributes?: Record<string, any>;
}

export interface APSLocation {
  id: string;
  parentId: string | null;
  type: string;
  name: string;
  description?: string | null;
  barcode?: string | null;
  order: number;
}

export interface APSUploadProgress {
  total: number;
  uploaded: number;
  failed: number;
  currentBatch: number;
  totalBatches: number;
}

/**
 * Get APS OAuth authorization URL
 */
export function getAPSAuthUrl(redirectUri: string, state?: string): string {
  console.log('[APS] Using CLIENT_ID:', ENV.APS_CLIENT_ID.substring(0, 20) + '...');
  const params = new URLSearchParams({
    response_type: "code",
    client_id: ENV.APS_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: "data:read data:write data:create account:read account:write"
  });

  if (state) {
    params.append("state", state);
  }

  return `${APS_AUTH_URL}/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<APSTokenResponse> {
  const response = await fetch(`${APS_AUTH_URL}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: ENV.APS_CLIENT_ID,
      client_secret: ENV.APS_CLIENT_SECRET,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for token: ${error}`);
  }

  return response.json();
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<APSTokenResponse> {
  console.log('[APS] Refreshing access token...');
  
  const response = await fetch(`${APS_AUTH_URL}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: ENV.APS_CLIENT_ID,
      client_secret: ENV.APS_CLIENT_SECRET,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh token: ${error}`);
  }

  const tokenData = await response.json();
  console.log('[APS] Token refreshed successfully');
  return tokenData;
}

/**
 * Get current user profile information
 */
export async function getUserProfile(accessToken: string): Promise<any> {
  const response = await fetch(
    `${APS_DATA_URL}/userprofile/v1/users/@me`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get user profile: ${error}`);
  }

  return response.json();
}

/**
 * List ACC hubs (accounts)
 */
export async function listHubs(accessToken: string): Promise<APSHub[]> {
  console.log('[APS] listHubs called with token:', accessToken.substring(0, 50) + '...');
  console.log('[APS] Token length:', accessToken.length);
  console.log('[APS] Calling:', `${APS_DATA_URL}/project/v1/hubs`);
  
  const response = await fetch(`${APS_DATA_URL}/project/v1/hubs`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[APS] listHubs error:', error);
    throw new Error(`Failed to list hubs: ${error}`);
  }

  const data = await response.json();
  console.log('[APS] Raw hubs API response:', JSON.stringify(data, null, 2));
  
  if (!data.data || data.data.length === 0) {
    console.warn('[APS] No hubs returned from API');
    return [];
  }
  
  return data.data.map((hub: any) => ({
    id: hub.id,
    name: hub.attributes.name,
    type: hub.attributes.extension?.type,
  }));
}

/**
 * List all projects accessible to the user (across all hubs)
 */
export async function listAllProjects(
  accessToken: string
): Promise<APSProject[]> {
  // First get all hubs
  const hubs = await listHubs(accessToken);
  
  // Then get projects from each hub
  const allProjects: APSProject[] = [];
  for (const hub of hubs) {
    try {
      const projects = await listProjects(accessToken, hub.id);
      allProjects.push(...projects);
    } catch (error) {
      console.error(`[APS] Failed to list projects for hub ${hub.id}:`, error);
      // Continue with other hubs
    }
  }
  
  return allProjects;
}

/**
 * List projects in a hub
 */
export async function listProjects(
  accessToken: string,
  hubId: string
): Promise<APSProject[]> {
  const response = await fetch(
    `${APS_DATA_URL}/project/v1/hubs/${hubId}/projects`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list projects: ${error}`);
  }

  const data = await response.json();
  return data.data.map((project: any) => ({
    id: project.id,
    name: project.attributes.name,
    hub_id: hubId,
  }));
}

/**
 * List asset categories in a project
 */
export async function listCategories(
  accessToken: string,
  projectId: string
): Promise<APSCategory[]> {
    const response = await fetch(`${APS_ACC_URL_V1}/projects/${projectId}/categories`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list categories: ${error}`);
  }

  const data = await response.json();
  return data.results.map((cat: any) => ({
    id: cat.id,
    name: cat.name,
    statusSetId: cat.statusSetId,
    isRoot: cat.isRoot,
    isLeaf: cat.isLeaf,
  }));
}

/**
 * Get default status for a category
 */
export async function getCategoryDefaultStatus(
  accessToken: string,
  projectId: string,
  categoryId: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `${APS_ACC_URL_V1}/projects/${projectId}/categories/${categoryId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    // Return the first status ID from the status set
    return data.statusSetId || null;
  } catch (error) {
    console.error("Failed to get category default status:", error);
    return null;
  }
}

/**
 * Get all location nodes in a project's location tree
 */
export async function listLocations(
  accessToken: string,
  projectId: string
): Promise<APSLocation[]> {
  try {
    // Strip 'b.' prefix if present (BIM 360 project IDs)
    const cleanProjectId = projectId.startsWith('b.') ? projectId.substring(2) : projectId;
    console.log(`[Locations API] Listing locations for project: ${projectId} (clean: ${cleanProjectId})`);
    
    const response = await fetch(
      `${APS_LOCATIONS_URL}/projects/${cleanProjectId}/trees/default/nodes`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`[Locations API] Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Locations API] Error response: ${errorText}`);
      throw new Error(`Failed to list locations: ${errorText}`);
    }

    const data = await response.json();
    console.log(`[Locations API] Found ${data.results?.length || 0} location nodes`);
    return data.results || [];
  } catch (error) {
    console.error("Failed to list locations:", error);
    throw error;
  }
}

/**
 * Create a new location node in the project's location tree
 */
export async function createLocation(
  accessToken: string,
  projectId: string,
  parentId: string,
  name: string,
  barcode?: string
): Promise<APSLocation> {
  try {
    // Strip 'b.' prefix if present (BIM 360 project IDs)
    const cleanProjectId = projectId.startsWith('b.') ? projectId.substring(2) : projectId;
    
    const response = await fetch(
      `${APS_LOCATIONS_URL}/projects/${cleanProjectId}/trees/default/nodes`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          parentId,
          type: "Area",
          name,
          barcode,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create location: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Failed to create location "${name}":`, error);
    throw error;
  }
}

/**
 * Upload assets to ACC project in batches
 */
export async function uploadAssetsToACC(
  accessToken: string,
  projectId: string,
  assets: any[],
  onProgress?: (progress: APSUploadProgress) => void
): Promise<{ success: boolean; message: string; count: number; errors: string[] }> {
  // Clear previous log
  try { fs.writeFileSync(DEBUG_LOG, ''); } catch (e) {}
  
  debugLog(`[ACC Upload] ========== UPLOAD START ==========`);
  debugLog(`[ACC Upload] Project ID: ${projectId}`);
  debugLog(`[ACC Upload] Assets to upload: ${assets.length}`);
  debugLog(`[ACC Upload] Sample asset: ${JSON.stringify(assets[0], null, 2)}`);
  
  const BATCH_SIZE = 100; // ACC API limit
  const totalBatches = Math.ceil(assets.length / BATCH_SIZE);
  let uploaded = 0;
  let failed = 0;
  const errors: string[] = [];
  
  console.log(`[ACC Upload] Will process ${totalBatches} batches of up to ${BATCH_SIZE} assets each`);

  // Get categories to find default category and status
  const categories = await listCategories(accessToken, projectId);
  
  if (categories.length === 0) {
    throw new Error("No asset categories found in project. Please set up asset categories in ACC first.");
  }

  // Find a leaf category (isLeaf=true) with a valid status
  // Skip root and parent categories
  let defaultCategory = null;
  let defaultStatusId = null;
  
  for (const category of categories) {
    // Skip root categories and try to find leaf categories
    if (category.isLeaf || !category.isRoot) {
      const statusId = await getCategoryDefaultStatus(accessToken, projectId, category.id);
      if (statusId) {
        defaultCategory = category;
        defaultStatusId = statusId;
        console.log(`[ACC Upload] Using category: ${category.name} (ID: ${category.id})`);
        break;
      }
    }
  }
  
  // If no usable category found, create one automatically
  if (!defaultCategory || !defaultStatusId) {
    console.log('[ACC Upload] No usable category found, creating default category...');
    
    // Find ROOT category
    const rootCategory = categories.find(cat => cat.isRoot);
    if (!rootCategory) {
      throw new Error('No ROOT category found in project');
    }

    // Create a status set with "Active" status (or reuse if exists)
    let statusSet;
    let statusSetId;
    let firstStatusId;
    
    const statusSetResponse = await fetch(
      `${APS_ACC_URL_V1}/projects/${projectId}/status-step-sets`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Asset Status',
          description: 'Default status set for assets',
          values: [
            {
              label: 'Active',
              description: 'Asset is active',
              color: 'green',
            },
          ],
        }),
      }
    );

    if (!statusSetResponse.ok) {
      const errorText = await statusSetResponse.text();
      // If status set already exists, extract it from the error response
      if (errorText.includes('DUPLICATE_STATUS_SET_NAME')) {
        console.log('[ACC Upload] Asset Status set already exists, reusing it...');
        try {
          const errorData = JSON.parse(errorText);
          const existingStatusSet = errorData.errorMetadata?.conflictingEntities?.[0];
          if (existingStatusSet) {
            statusSet = existingStatusSet;
            statusSetId = existingStatusSet.id;
            firstStatusId = existingStatusSet.values[0].id;
          } else {
            throw new Error('Could not extract existing status set from error');
          }
        } catch (parseError) {
          throw new Error(`Failed to parse status set error: ${errorText}`);
        }
      } else {
        throw new Error(`Failed to create status set: ${errorText}`);
      }
    } else {
      statusSet = await statusSetResponse.json();
      statusSetId = statusSet.id;
      firstStatusId = statusSet.values[0].id;
    }

    // Create "Equipment" category under ROOT (or find if it already exists)
    let newCategory;
    const categoryResponse = await fetch(
      `${APS_ACC_URL_V1}/projects/${projectId}/categories`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Equipment',
          description: 'Equipment and machinery',
          parentId: rootCategory.id,
        }),
      }
    );

    if (!categoryResponse.ok) {
      const errorText = await categoryResponse.text();
      // If category already exists, try to find it
      if (errorText.includes('DUPLICATE_CATEGORY_NAME')) {
        console.log('[ACC Upload] Equipment category already exists, finding it...');
        const existingCategory = categories.find(cat => cat.name === 'Equipment');
        if (!existingCategory) {
          throw new Error('Equipment category exists but could not be found');
        }
        newCategory = existingCategory;
      } else {
        throw new Error(`Failed to create category: ${errorText}`);
      }
    } else {
      newCategory = await categoryResponse.json();
    }

    // Assign status set to the new category
    const assignResponse = await fetch(
      `${APS_ACC_URL_V1}/projects/${projectId}/categories/${newCategory.id}/status-step-set/${statusSetId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!assignResponse.ok) {
      const error = await assignResponse.text();
      console.warn(`Failed to assign status set to category: ${error}`);
    }

    defaultCategory = newCategory;
    defaultStatusId = firstStatusId;
    console.log(`[ACC Upload] Created category: ${newCategory.name} (ID: ${newCategory.id})`);
  }

  // Create locations for assets (optional - skip if locations API not available)
  debugLog('[ACC Upload] Creating locations...');
  let locations: APSLocation[] = [];
  let rootLocation: APSLocation | undefined;
  let locationNameToId = new Map<string, string>();
  
  try {
    debugLog('[ACC Upload] Fetching existing locations from project...');
    locations = await listLocations(accessToken, projectId);
    debugLog(`[ACC Upload] Found ${locations.length} existing location nodes`);
    rootLocation = locations.find(loc => loc.type === 'Root');
    
    if (!rootLocation) {
      debugLog('[ACC Upload] ⚠️  No root location found, skipping location creation');
    } else {
      debugLog(`[ACC Upload] ✓ Root location found: ${rootLocation.name} (ID: ${rootLocation.id})`);
    }
  } catch (error: any) {
    debugLog(`[ACC Upload] ❌ Locations API error: ${error.message}`);
    debugLog('[ACC Upload] Skipping location creation due to API error');
  }
  
  // Extract unique location names from assets and create them if root location is available
  if (rootLocation) {
    const uniqueLocationNames = new Set<string>();
    assets.forEach(asset => {
      if (asset.location) {
        uniqueLocationNames.add(asset.location);
      }
    });
    
    debugLog(`[ACC Upload] Found ${uniqueLocationNames.size} unique locations in assets: ${Array.from(uniqueLocationNames).join(', ')}`);
    
    // Check which locations already exist
    debugLog('[ACC Upload] Checking for existing locations...');
    locations.forEach(loc => {
      if (loc.name && uniqueLocationNames.has(loc.name)) {
        locationNameToId.set(loc.name, loc.id);
        debugLog(`[ACC Upload]   ✓ "${loc.name}" already exists (ID: ${loc.id})`);
      }
    });
    
    // Create missing locations
    const missingLocations = Array.from(uniqueLocationNames).filter(name => !locationNameToId.has(name));
    debugLog(`[ACC Upload] Need to create ${missingLocations.length} new locations`);
    
    for (const locationName of missingLocations) {
      try {
        debugLog(`[ACC Upload]   Creating "${locationName}" under root (${rootLocation.id})...`);
        const newLocation = await createLocation(
          accessToken,
          projectId,
          rootLocation.id,
          locationName
        );
        locationNameToId.set(locationName, newLocation.id);
        debugLog(`[ACC Upload]   ✓ Created "${locationName}" (ID: ${newLocation.id})`);
      } catch (error: any) {
        debugLog(`[ACC Upload]   ❌ Failed to create "${locationName}": ${error.message}`);
        // Continue without this location
      }
    }
    
    debugLog(`[ACC Upload] Location mapping complete: ${locationNameToId.size} locations available`);
  } else {
    debugLog('[ACC Upload] Skipping location creation (no root location)');
  }

  // Process in batches
  for (let i = 0; i < totalBatches; i++) {
    const batchStart = i * BATCH_SIZE;
    const batchEnd = Math.min(batchStart + BATCH_SIZE, assets.length);
    const batch = assets.slice(batchStart, batchEnd);

    // Map our assets to ACC format
    const accAssets: APSAsset[] = batch.map((asset) => {
      const accAsset: APSAsset = {
        clientAssetId: asset.name || asset.assetId || `Asset-${asset.id}`,
        categoryId: defaultCategory.id,
        statusId: defaultStatusId,
        description: asset.description || asset.type || "",
      };
      
      // Add location if available
      if (asset.location) {
        if (locationNameToId.has(asset.location)) {
          accAsset.locationId = locationNameToId.get(asset.location);
        } else {
          console.log(`[ACC Upload] Warning: No location ID found for "${asset.location}" (asset: ${asset.name})`);
        }
      }
      
      return accAsset;
    });

    try {
      const response = await fetch(
        `${APS_ACC_URL_V2}/projects/${projectId}/assets:batch-create`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(accAssets),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error(`[ACC Upload] Batch ${i + 1}/${totalBatches} failed:`, error);
        errors.push(`Batch ${i + 1}: ${error}`);
        failed += batch.length;
      } else {
        const result = await response.json();
        console.log(`[ACC Upload] Batch ${i + 1}/${totalBatches} response:`, JSON.stringify(result, null, 2));
        uploaded += batch.length;
      }
    } catch (error) {
      console.error(`Batch ${i + 1} error:`, error);
      errors.push(`Batch ${i + 1}: ${error instanceof Error ? error.message : String(error)}`);
      failed += batch.length;
    }

    // Report progress
    if (onProgress) {
      onProgress({
        total: assets.length,
        uploaded,
        failed,
        currentBatch: i + 1,
        totalBatches,
      });
    }

    // Small delay between batches to respect rate limits
    if (i < totalBatches - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return {
    success: uploaded > 0,
    message: `Uploaded ${uploaded} of ${assets.length} assets${failed > 0 ? `, ${failed} failed` : ""}`,
    count: uploaded,
    errors,
  };
}

// ============================================================================
// Data Management API - For browsing and downloading files from ACC Docs
// ============================================================================

export interface APSFolder {
  id: string;
  type: string;
  attributes: {
    name: string;
    displayName?: string;
    objectCount?: number;
    createTime?: string;
    lastModifiedTime?: string;
  };
}

export interface APSFile {
  id: string;
  type: string;
  attributes: {
    name: string;
    displayName?: string;
    fileType?: string;
    storageSize?: number;
    createTime?: string;
    lastModifiedTime?: string;
    extension?: {
      type?: string;
      version?: string;
    };
  };
}

/**
 * List folders in a project (top-level folders)
 */
export async function listProjectFolders(
  accessToken: string,
  hubId: string,
  projectId: string
): Promise<APSFolder[]> {
  const response = await fetch(
    `${APS_DATA_URL}/project/v1/hubs/${hubId}/projects/${projectId}/topFolders`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list project folders: ${error}`);
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * List contents of a folder (subfolders and files)
 */
export async function listFolderContents(
  accessToken: string,
  projectId: string,
  folderId: string
): Promise<{ folders: APSFolder[]; files: APSFile[] }> {
  const response = await fetch(
    `${APS_DATA_URL}/data/v1/projects/${projectId}/folders/${folderId}/contents`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list folder contents: ${error}`);
  }

  const data = await response.json();
  const items = data.data || [];

  const folders: APSFolder[] = [];
  const files: APSFile[] = [];

  items.forEach((item: any) => {
    if (item.type === 'folders') {
      folders.push(item);
    } else if (item.type === 'items') {
      files.push(item);
    }
  });

  return { folders, files };
}

/**
 * Get download URL for a file
 */
export async function getFileDownloadUrl(
  accessToken: string,
  projectId: string,
  itemId: string
): Promise<string> {
  // Get item to find the tip version
  const itemResponse = await fetch(
    `${APS_DATA_URL}/data/v1/projects/${projectId}/items/${itemId}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!itemResponse.ok) {
    const error = await itemResponse.text();
    throw new Error(`Failed to get item details: ${error}`);
  }

  const itemData = await itemResponse.json();
  const tipUrl = itemData.data?.relationships?.tip?.links?.related?.href;
  
  if (!tipUrl) {
    throw new Error('No version information found for file');
  }
  
  // Get the version to extract storage URN
  const versionResponse = await fetch(tipUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  
  if (!versionResponse.ok) {
    const error = await versionResponse.text();
    throw new Error(`Failed to get version details: ${error}`);
  }
  
  const versionData = await versionResponse.json();
  
  // Extract storage URN from version attributes
  const storageUrn = versionData.data?.relationships?.storage?.data?.id;
  
  if (!storageUrn) {
    // Try getting it from the version ID itself - for some file types the version ID IS the storage URN
    const versionId = versionData.data?.id;
    if (versionId && versionId.includes('urn:adsk')) {
      // Extract the base64 part and decode to get storage location
      console.log('[APS] Using version ID as storage reference:', versionId);
      return `acc-storage://${accessToken}@${versionId}`;
    }
    throw new Error('No storage URN found for file');
  }
  
  console.log('[APS] Found storage URN:', storageUrn);
  return `acc-storage://${accessToken}@${storageUrn}`;
}

/**
 * Download file from ACC
 */
export async function downloadFile(
  accessToken: string,
  projectId: string,
  itemId: string
): Promise<Buffer> {
  const downloadUrl = await getFileDownloadUrl(accessToken, projectId, itemId);

  // Check if this is an ACC storage URL
  if (downloadUrl.startsWith('acc-storage://')) {
    // Parse the special URL format
    const match = downloadUrl.match(/^acc-storage:\/\/(.+)@(.+)$/);
    if (!match) {
      throw new Error('Invalid ACC storage URL format');
    }
    
    const [, token, storageUrn] = match;
    
    // Parse the storage URN to extract bucket and object key
    // Format: urn:adsk.objects:os.object:bucket/objectKey
    console.log('[APS] Parsing storage URN:', storageUrn);
    
    // Extract bucket and object key from URN
    // Example: urn:adsk.objects:os.object:wip.dm.prod/6bb634c6-9d7e-43b2-b909-868273050ec0.pdf
    const urnMatch = storageUrn.match(/^urn:adsk\.objects:os\.object:([^/]+)\/(.+)$/);
    
    if (!urnMatch) {
      throw new Error(`Invalid storage URN format: ${storageUrn}`);
    }
    
    const [, bucketKey, objectKey] = urnMatch;
    console.log('[APS] Bucket:', bucketKey, 'Object:', objectKey);
    
    // Use OSS API to get signed S3 download URL
    const signedUrlResponse = await fetch(
      `${APS_DATA_URL}/oss/v2/buckets/${encodeURIComponent(bucketKey)}/objects/${encodeURIComponent(objectKey)}/signeds3download`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    
    if (!signedUrlResponse.ok) {
      const error = await signedUrlResponse.text();
      console.error('[APS] Failed to get signed URL:', error);
      throw new Error(`Failed to get signed download URL: ${error}`);
    }
    
    const signedData = await signedUrlResponse.json();
    const signedUrl = signedData.url;
    
    if (!signedUrl) {
      console.error('[APS] Signed URL response:', JSON.stringify(signedData, null, 2));
      throw new Error('No signed URL in response');
    }
    
    console.log('[APS] Got signed URL, downloading file...');
    const fileResponse = await fetch(signedUrl);
    
    if (!fileResponse.ok) {
      throw new Error(`Failed to download file from signed URL: ${fileResponse.statusText}`);
    }
    
    const arrayBuffer = await fileResponse.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // Regular download URL
  const response = await fetch(downloadUrl);

  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Get project details including hub ID
 */
export async function getProjectDetails(accessToken: string, projectId: string): Promise<any> {
  const response = await fetch(`${APS_DATA_URL}/project/v1/projects/${projectId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[APS] getProjectDetails error:', error);
    throw new Error(`Failed to get project details: ${error}`);
  }

  const data = await response.json();
  console.log('[APS] Project details response:', JSON.stringify(data, null, 2));
  return data;
}

/**
 * Get user info including account ID from APS
 */
export async function getUserInfo(accessToken: string): Promise<any> {
  // Try the /users/@me endpoint
  const response = await fetch(`${APS_DATA_URL}/userprofile/v1/users/@me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[APS] getUserInfo error:', error);
    throw new Error(`Failed to get user info: ${error}`);
  }

  const data = await response.json();
  console.log('[APS] User info response:', JSON.stringify(data, null, 2));
  return data;
}

/**
 * Create a new ACC project
 */
export async function createACCProject(
  accessToken: string,
  accountId: string,
  projectName: string,
  projectType: string
): Promise<any> {
  // Convert hubId (b.xxx) to accountId (xxx) if needed
  const cleanAccountId = accountId.startsWith('b.') ? accountId.substring(2) : accountId;
  
  console.log('[APS] Creating ACC project:', { accountId: cleanAccountId, projectName, projectType });
  
  const response = await fetch(
    `${APS_DATA_URL}/construction/admin/v1/accounts/${cleanAccountId}/projects`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: projectName,
        type: projectType || 'Office', // Default to Office if not specified
        startDate: new Date().toISOString().split('T')[0],
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('[APS] createACCProject error response:');
    console.error('[APS] Status:', response.status, response.statusText);
    console.error('[APS] Headers:', Object.fromEntries(response.headers));
    console.error('[APS] Body:', error.substring(0, 500));
    throw new Error(`Failed to create ACC project (${response.status}): ${error.substring(0, 200)}`);
  }

  const data = await response.json();
  console.log('[APS] Created ACC project:', JSON.stringify(data, null, 2));
  return data;
}

/**
 * Assign a user as project administrator
 */
export async function assignProjectAdmin(
  accessToken: string,
  projectId: string,
  userId: string,
  email: string
): Promise<any> {
  console.log(`[APS] Assigning user ${email} (${userId}) as project admin for project ${projectId}`);
  
  const response = await fetch(
    `${APS_DATA_URL}/construction/admin/v2/projects/${projectId}/users:import`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        users: [
          {
            email: email,
            userId: userId,
            products: [
              {
                key: 'projectAdministration',
                access: 'administrator',
              },
              {
                key: 'docs',
                access: 'administrator',
              },
            ],
          },
        ],
      }),
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    console.error(`[APS] Failed to assign project admin: ${error}`);
    throw new Error(`Failed to assign project admin: ${error}`);
  }
  
  const data = await response.json();
  console.log('[APS] Project admin assigned:', JSON.stringify(data, null, 2));
  return data;
}

/**
 * Poll project activation status until it's active
 * @param accessToken APS access token
 * @param projectId ACC project ID (UUID format, not b.xxx)
 * @param maxRetries Maximum number of polling attempts (default: 10)
 * @param initialDelay Initial delay in milliseconds (default: 2000)
 * @returns The active project data
 */
export async function pollProjectActivation(
  accessToken: string,
  projectId: string,
  maxRetries: number = 10,
  initialDelay: number = 2000
): Promise<any> {
  console.log(`[APS] Polling project activation for ${projectId}...`);
  
  let delay = initialDelay;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Wait before checking (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, delay));
      
      console.log(`[APS] Activation check attempt ${attempt}/${maxRetries} (delay: ${delay}ms)`);
      
      // Get project status
      const response = await fetch(
        `${APS_DATA_URL}/construction/admin/v1/projects/${projectId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      
      if (!response.ok) {
        const error = await response.text();
        console.error(`[APS] Failed to get project status: ${error}`);
        // Continue retrying even on error
        delay *= 2; // Exponential backoff
        continue;
      }
      
      const project = await response.json();
      console.log(`[APS] Project status: ${project.status}`);
      
      // Log product statuses
      if (project.products && Array.isArray(project.products)) {
        console.log('[APS] Product statuses:');
        project.products.forEach((product: any) => {
          console.log(`  - ${product.name} (${product.key}): ${product.status}`);
        });
      }
      
      // Check if project is active
      if (project.status === 'active') {
        // Also check if critical products are active
        const docsProduct = project.products?.find((p: any) => p.key === 'docs');
        const projectAdminProduct = project.products?.find((p: any) => p.key === 'projectAdministration');
        
        if (docsProduct && docsProduct.status !== 'active') {
          console.log(`[APS] Project is active but docs product is still ${docsProduct.status}, continuing to poll...`);
          delay *= 2;
          continue;
        }
        
        if (projectAdminProduct && projectAdminProduct.status !== 'active') {
          console.log(`[APS] Project is active but projectAdministration is still ${projectAdminProduct.status}, continuing to poll...`);
          delay *= 2;
          continue;
        }
        
        console.log('[APS] ✓ Project fully activated!');
        return project;
      }
      
      console.log(`[APS] Project not yet active (status: ${project.status}), retrying...`);
      delay *= 2; // Exponential backoff
      
    } catch (error) {
      console.error(`[APS] Error checking project activation (attempt ${attempt}):`, error);
      delay *= 2;
    }
  }
  
  throw new Error(`Project activation timed out after ${maxRetries} attempts. Project may still be activating in the background.`);
}

/**
 * List all ACC projects in an account
 */
export async function listACCProjects(
  accessToken: string,
  accountId: string
): Promise<any[]> {
  // Convert hubId (b.xxx) to accountId (xxx) if needed
  const cleanAccountId = accountId.startsWith('b.') ? accountId.substring(2) : accountId;
  
  console.log('[APS] Listing ACC projects for account:', cleanAccountId);
  
  const response = await fetch(
    `${APS_DATA_URL}/construction/admin/v1/accounts/${cleanAccountId}/projects`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('[APS] listACCProjects error:', error);
    throw new Error(`Failed to list ACC projects (${response.status}): ${error}`);
  }

  const data = await response.json();
  console.log('[APS] listACCProjects raw response:', JSON.stringify(data, null, 2));
  
  // ACC Admin API returns projects in a 'results' array
  const projects = data.results || [];
  console.log(`[APS] Found ${projects.length} ACC projects`);
  return projects;
}

/**
 * Delete an ACC project
 */
export async function deleteACCProject(
  accessToken: string,
  accountId: string,
  projectId: string
): Promise<void> {
  // Convert hubId (b.xxx) to accountId (xxx) if needed
  const cleanAccountId = accountId.startsWith('b.') ? accountId.substring(2) : accountId;
  
  console.log('[APS] Deleting ACC project:', { accountId: cleanAccountId, projectId });
  
  const response = await fetch(
    `${APS_DATA_URL}/construction/admin/v1/accounts/${cleanAccountId}/projects/${projectId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('[APS] deleteACCProject error:', error);
    throw new Error(`Failed to delete ACC project (${response.status}): ${error}`);
  }

  console.log('[APS] Successfully deleted ACC project:', projectId);
}

/**
 * Create a folder in ACC project
 */
export async function createFolder(
  accessToken: string,
  projectId: string,
  parentFolderId: string,
  folderName: string
): Promise<any> {
  const response = await fetch(`${APS_DATA_URL}/data/v1/projects/${projectId}/folders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      jsonapi: { version: '1.0' },
      data: {
        type: 'folders',
        attributes: {
          name: folderName,
          extension: {
            type: 'folders:autodesk.bim360:Folder',
            version: '1.0',
          },
        },
        relationships: {
          parent: {
            data: {
              type: 'folders',
              id: parentFolderId,
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[APS] createFolder error:', error);
    throw new Error(`Failed to create folder "${folderName}": ${error}`);
  }

  const data = await response.json();
  console.log('[APS] Created folder:', folderName);
  return data.data;
}
