/**
 * ACC File Upload Service
 * 
 * Handles uploading files to Autodesk Construction Cloud (ACC) using:
 * 1. OSS (Object Storage Service) - for storing file bytes
 * 2. Data Management API - for creating items/versions in ACC folders
 */

// ACC API base URL
const APS_DATA_URL = "https://developer.api.autodesk.com";

/**
 * Upload a file to ACC
 * 
 * @param accessToken - ACC OAuth access token
 * @param projectId - ACC project ID (e.g., "b.xxx-xxx-xxx")
 * @param folderId - ACC folder URN where file should be uploaded
 * @param fileName - Name of the file
 * @param fileBuffer - File content as Buffer
 * @param overwrite - Whether to overwrite if file exists
 * @returns ACC item ID and web view URL
 */
export async function uploadFileToACC(
  accessToken: string,
  projectId: string,
  folderId: string,
  fileName: string,
  fileBuffer: Buffer,
  overwrite: boolean = true
): Promise<{ itemId: string; webViewUrl: string }> {
  
  // Step 1: Check if file already exists in folder
  const existingItem = await findFileInFolder(accessToken, projectId, folderId, fileName);
  
  if (existingItem && !overwrite) {
    throw new Error(`File "${fileName}" already exists in folder`);
  }
  
  if (existingItem && overwrite) {
    // Create new version of existing item
    return await createNewVersion(accessToken, projectId, existingItem.id, fileName, fileBuffer);
  }
  
  // Step 2: Create storage location in OSS
  const storageId = await createStorage(accessToken, projectId, folderId, fileName);
  console.log('[ACC Upload] Storage ID created:', storageId);
  
  // Step 3: Upload file bytes to OSS
  await uploadToOSS(accessToken, storageId, fileBuffer);
  console.log('[ACC Upload] File uploaded to S3 successfully');
  
  // Step 4: Create item in ACC folder
  console.log('[ACC Upload] Creating item with storage ID:', storageId);
  const item = await createItem(accessToken, projectId, folderId, fileName, storageId);
  
  return {
    itemId: item.id,
    webViewUrl: item.webViewUrl || ""
  };
}

/**
 * Find a file in an ACC folder by name
 */
async function findFileInFolder(
  accessToken: string,
  projectId: string,
  folderId: string,
  fileName: string
): Promise<{ id: string; name: string } | null> {
  
  try {
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
    const matchingItem = items.find((item: any) => 
      item.attributes?.displayName === fileName || item.attributes?.name === fileName
    );
    
    return matchingItem ? { id: matchingItem.id, name: matchingItem.attributes.displayName } : null;
  } catch (error) {
    console.error("[ACC Upload] Error finding file:", error);
    return null;
  }
}

/**
 * Create storage location in OSS
 */
async function createStorage(
  accessToken: string,
  projectId: string,
  folderId: string,
  fileName: string
): Promise<string> {
  
  const response = await fetch(
    `${APS_DATA_URL}/data/v1/projects/${projectId}/storage`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/vnd.api+json',
      },
      body: JSON.stringify({
        jsonapi: { version: "1.0" },
        data: {
          type: "objects",
          attributes: {
            name: fileName
          },
          relationships: {
            target: {
              data: {
                type: "folders",
                id: folderId
              }
            }
          }
        }
      })
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create storage: ${error}`);
  }
  
  const data = await response.json();
  return data.data.id;
}

/**
 * Upload file bytes to OSS
 */
async function uploadToOSS(
  accessToken: string,
  storageId: string,
  fileBuffer: Buffer
): Promise<void> {
  
  // Extract bucket and object key from storage URN
  // Format: urn:adsk.objects:os.object:bucket/objectKey
  const match = storageId.match(/urn:adsk\.objects:os\.object:([^\/]+)\/(.+)/);
  if (!match) {
    throw new Error(`Invalid storage URN format: ${storageId}`);
  }
  
  const [, bucket, objectKey] = match;
  
  // Step 1: Get signed S3 upload URL
  const signedUrlResponse = await fetch(
    `${APS_DATA_URL}/oss/v2/buckets/${bucket}/objects/${encodeURIComponent(objectKey)}/signeds3upload`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  
  if (!signedUrlResponse.ok) {
    const error = await signedUrlResponse.text();
    throw new Error(`Failed to get signed S3 URL: ${error}`);
  }
  
  const signedUrlData = await signedUrlResponse.json();
  const uploadUrl = signedUrlData.urls?.[0] || signedUrlData.url;
  const uploadKey = signedUrlData.uploadKey;
  
  if (!uploadUrl) {
    throw new Error('No signed URL returned from API');
  }
  
  if (!uploadKey) {
    throw new Error('No uploadKey returned from API');
  }
  
  // Step 2: Upload to S3 using signed URL (no Authorization header needed)
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/octet-stream',
    },
    body: new Uint8Array(fileBuffer)
  });
  
  if (!uploadResponse.ok) {
    const error = await uploadResponse.text();
    throw new Error(`Failed to upload to S3: ${error}`);
  }
  
  // Step 3: Complete the upload by notifying OSS
  const completeResponse = await fetch(
    `${APS_DATA_URL}/oss/v2/buckets/${bucket}/objects/${encodeURIComponent(objectKey)}/signeds3upload`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-ads-meta-Content-Type': 'application/octet-stream',
      },
      body: JSON.stringify({
        uploadKey: uploadKey,
      }),
    }
  );
  
  if (!completeResponse.ok) {
    const error = await completeResponse.text();
    throw new Error(`Failed to complete upload: ${error}`);
  }
}

/**
 * Create item in ACC folder
 */
async function createItem(
  accessToken: string,
  projectId: string,
  folderId: string,
  fileName: string,
  storageId: string
): Promise<{ id: string; webViewUrl?: string }> {
  
  const response = await fetch(
    `${APS_DATA_URL}/data/v1/projects/${projectId}/items`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/vnd.api+json',
      },
      body: JSON.stringify({
        jsonapi: { version: "1.0" },
        data: {
          type: "items",
          attributes: {
            displayName: fileName,
            extension: {
              type: "items:autodesk.bim360:File",
              version: "1.0"
            }
          },
          relationships: {
            tip: {
              data: {
                type: "versions",
                id: "1"
              }
            },
            parent: {
              data: {
                type: "folders",
                id: folderId
              }
            }
          }
        },
        included: [
          {
            type: "versions",
            id: "1",
            attributes: {
              name: fileName,
              extension: {
                type: "versions:autodesk.bim360:File",
                version: "1.0"
              }
            },
            relationships: {
              storage: {
                data: {
                  type: "objects",
                  id: storageId
                }
              }
            }
          }
        ]
      })
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create item: ${error}`);
  }
  
  const data = await response.json();
  return {
    id: data.data.id,
    webViewUrl: data.data.links?.webView?.href
  };
}

/**
 * Create new version of existing item
 */
async function createNewVersion(
  accessToken: string,
  projectId: string,
  itemId: string,
  fileName: string,
  fileBuffer: Buffer
): Promise<{ itemId: string; webViewUrl: string }> {
  
  // Get item details to find parent folder
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
  const folderId = itemData.data.relationships.parent.data.id;
  
  // Create new storage for the version
  const storageId = await createStorage(accessToken, projectId, folderId, fileName);
  
  // Upload file bytes
  await uploadToOSS(accessToken, storageId, fileBuffer);
  
  // Create new version
  const response = await fetch(
    `${APS_DATA_URL}/data/v1/projects/${projectId}/versions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/vnd.api+json',
      },
      body: JSON.stringify({
        jsonapi: { version: "1.0" },
        data: {
          type: "versions",
          attributes: {
            name: fileName,
            extension: {
              type: "versions:autodesk.bim360:File",
              version: "1.0"
            }
          },
          relationships: {
            item: {
              data: {
                type: "items",
                id: itemId
              }
            },
            storage: {
              data: {
                type: "objects",
                id: storageId
              }
            }
          }
        }
      })
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create version: ${error}`);
  }
  
  const data = await response.json();
  return {
    itemId,
    webViewUrl: data.data.links?.webView?.href || ""
  };
}

/**
 * Get or create folder in ACC
 * 
 * @param accessToken - ACC OAuth access token
 * @param projectId - ACC project ID
 * @param parentFolderId - Parent folder URN
 * @param folderName - Name of folder to create
 * @returns Folder URN
 */
export async function getOrCreateFolder(
  accessToken: string,
  projectId: string,
  parentFolderId: string,
  folderName: string
): Promise<string> {
  
  // Check if folder exists
  try {
    const response = await fetch(
      `${APS_DATA_URL}/data/v1/projects/${projectId}/folders/${parentFolderId}/contents`,
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
    const folders = data.data || [];
    const existingFolder = folders.find((item: any) => 
      item.type === "folders" && 
      (item.attributes?.displayName === folderName || item.attributes?.name === folderName)
    );
    
    if (existingFolder) {
      return existingFolder.id;
    }
  } catch (error) {
    console.error("[ACC Upload] Error checking folder:", error);
  }
  
  // Create folder
  const response = await fetch(
    `${APS_DATA_URL}/data/v1/projects/${projectId}/folders`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/vnd.api+json',
      },
      body: JSON.stringify({
        jsonapi: { version: "1.0" },
        data: {
          type: "folders",
          attributes: {
            name: folderName,
            extension: {
              type: "folders:autodesk.bim360:Folder",
              version: "1.0"
            }
          },
          relationships: {
            parent: {
              data: {
                type: "folders",
                id: parentFolderId
              }
            }
          }
        }
      })
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create folder: ${error}`);
  }
  
  const data = await response.json();
  return data.data.id;
}

/**
 * Get root folder ID for an ACC project
 */
export async function getRootFolderId(
  accessToken: string,
  hubId: string,
  projectId: string
): Promise<string> {
  
  const response = await fetch(
    `${APS_DATA_URL}/project/v1/hubs/${hubId}/projects/${projectId}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get project details: ${error}`);
  }
  
  const data = await response.json();
  return data.data.relationships.rootFolder.data.id;
}

/**
 * Get Project Files folder ID for an ACC project
 * This is the folder where users can create custom subfolders
 */
export async function getProjectFilesFolderId(
  accessToken: string,
  projectId: string,
  rootFolderId: string
): Promise<string> {
  
  // List contents of root folder to find "Project Files"
  const response = await fetch(
    `${APS_DATA_URL}/data/v1/projects/${projectId}/folders/${rootFolderId}/contents`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list root folder contents: ${error}`);
  }
  
  const data = await response.json();
  const folders = data.data || [];
  
  // Look for "Project Files" folder (name may vary by region/language)
  const projectFilesFolder = folders.find((item: any) => 
    item.type === "folders" && 
    (item.attributes?.displayName === "Project Files" || 
     item.attributes?.name === "Project Files" ||
     item.attributes?.displayName?.includes("Project") ||
     item.attributes?.name?.includes("Project"))
  );
  
  if (!projectFilesFolder) {
    // If no "Project Files" folder found, return the first folder or root
    console.warn("[ACC Upload] No 'Project Files' folder found, using first available folder");
    const firstFolder = folders.find((item: any) => item.type === "folders");
    if (firstFolder) {
      return firstFolder.id;
    }
    // Fallback to root if no folders found
    return rootFolderId;
  }
  
  return projectFilesFolder.id;
}
