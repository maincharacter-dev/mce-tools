/**
 * ACC Upload Service
 * 
 * Handles automatic upload of processed documents to ACC after processing completes.
 * Integrates with document processing pipeline.
 */

import { uploadFileToACC } from './accUpload';
import { getInputDocumentFolderPath, classifyDocumentType } from './accFolderMapping';
import { createProjectDbPool } from './db-connection';
// Use native fetch (Node 18+)

interface UploadToACCParams {
  projectId: number;
  documentId: string;
  fileName: string;
  filePath: string; // S3 URL
  documentType: string;
}

interface UploadToACCResult {
  success: boolean;
  accFileName?: string;
  accFolderPath?: string;
  accWebViewUrl?: string;
  error?: string;
}

/**
 * Upload document to ACC after processing completes
 * Called from document processing pipeline
 */
export async function uploadDocumentToACC(params: UploadToACCParams): Promise<UploadToACCResult> {
  const { projectId, documentId, fileName, filePath, documentType } = params;
  
  console.log(`[ACC Upload Service] Starting upload for document ${documentId} (${fileName})`);
  
  try {
    // Get ACC credentials from project database
    const projectDb = createProjectDbPool(projectId);
    
    let accessToken: string;
    let accHubId: string;
    let accProjectId: string;
    
    try {
      // Get ACC credentials
      const [credRows] = await projectDb.execute(
        `SELECT access_token, expires_at FROM acc_credentials LIMIT 1`
      ) as any;
      
      if (!credRows || credRows.length === 0) {
        console.log(`[ACC Upload Service] No ACC credentials found for project ${projectId}, skipping upload`);
        return { success: false, error: 'No ACC credentials found. Please connect to ACC first.' };
      }
      
      const cred = credRows[0];
      
      // Check if token is expired
      const expiresAt = new Date(cred.expires_at);
      if (expiresAt < new Date()) {
        console.log(`[ACC Upload Service] ACC token expired for project ${projectId}, skipping upload`);
        return { success: false, error: 'ACC token expired. Please reconnect to ACC.' };
      }
      
      accessToken = cred.access_token;
      
      // Get ACC project mapping
      const [mappingRows] = await projectDb.execute(
        `SELECT acc_hub_id, acc_project_id FROM acc_project_mapping LIMIT 1`
      ) as any;
      
      if (!mappingRows || mappingRows.length === 0) {
        console.log(`[ACC Upload Service] No ACC project mapping found for project ${projectId}, skipping upload`);
        return { success: false, error: 'No ACC project selected. Please select an ACC project first.' };
      }
      
      accHubId = mappingRows[0].acc_hub_id;
      accProjectId = mappingRows[0].acc_project_id;
      
    } finally {
      await projectDb.end();
    }
    
    // Get file buffer (handle both S3 URLs and local file paths)
    let fileBuffer: Buffer;
    
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      // Download from S3 URL
      console.log(`[ACC Upload Service] Downloading file from S3: ${filePath}`);
      const fileResponse = await fetch(filePath);
      if (!fileResponse.ok) {
        throw new Error(`Failed to download file from S3: ${fileResponse.statusText}`);
      }
      fileBuffer = Buffer.from(await fileResponse.arrayBuffer());
    } else {
      // Read from local filesystem
      console.log(`[ACC Upload Service] Reading file from local path: ${filePath}`);
      const fs = await import('fs/promises');
      fileBuffer = await fs.readFile(filePath);
    }
    
    // Classify document type if AUTO
    let finalDocType = documentType;
    if (documentType === 'AUTO' || documentType === 'OTHER' || !documentType || documentType.trim() === '') {
      finalDocType = classifyDocumentType(fileName);
      console.log(`[ACC Upload Service] Classified document type: ${finalDocType}`);
    }
    
    // Ensure finalDocType is valid, default to OTHER if not
    if (!finalDocType || finalDocType.trim() === '') {
      finalDocType = 'OTHER';
      console.log(`[ACC Upload Service] Using default document type: OTHER`);
    }
    
    // Get target folder path in ACC
    const folderPath = getInputDocumentFolderPath(finalDocType as any);
    console.log(`[ACC Upload Service] Target folder path: ${folderPath}`);
    
    // Upload to ACC
    // Note: folderPath is an array like ['02_Data_Incoming', 'Information_Memorandum']
    // We need to get or create the folder and get its ID
    console.log(`[ACC Upload Service] Uploading to ACC project ${accProjectId}`);
    
    // Import helper functions from accUpload
    const { getOrCreateFolder, getRootFolderId, getProjectFilesFolderId } = await import('./accUpload');
    
    // Get root folder ID
    const rootFolderId = await getRootFolderId(accessToken, accHubId, accProjectId);
    
    // Get Project Files folder (where we can create custom folders)
    const projectFilesFolderId = await getProjectFilesFolderId(accessToken, accProjectId, rootFolderId);
    console.log(`[ACC Upload Service] Project Files folder ID: ${projectFilesFolderId}`);
    
    // Traverse folder path and create folders as needed
    let currentFolderId = projectFilesFolderId;
    for (const folderName of folderPath) {
      currentFolderId = await getOrCreateFolder(accessToken, accProjectId, currentFolderId, folderName);
    }
    
    const folderId = currentFolderId;
    
    const result = await uploadFileToACC(
      accessToken,
      accProjectId,
      folderId,
      fileName,
      fileBuffer,
      true // overwrite: create new version if file exists
    );
    
    console.log(`[ACC Upload Service] Upload successful! ACC Item ID: ${result.itemId}`);
    console.log(`[ACC Upload Service] Web view URL: ${result.webViewUrl}`);
    
    // Record upload in database
    const projectDb2 = createProjectDbPool(projectId);
    try {
      await projectDb2.execute(
        `INSERT INTO acc_uploads (document_id, acc_item_id, acc_folder_path, acc_file_name, acc_web_view_url, upload_status, uploaded_at)
         VALUES (?, ?, ?, ?, ?, 'completed', NOW())
         ON DUPLICATE KEY UPDATE 
           acc_item_id = VALUES(acc_item_id),
           acc_folder_path = VALUES(acc_folder_path),
           acc_web_view_url = VALUES(acc_web_view_url),
           upload_status = 'completed',
           uploaded_at = NOW()`,
        [documentId, result.itemId || '', folderPath.join('/'), fileName, result.webViewUrl || '']
      );
      console.log(`[ACC Upload Service] Upload recorded in database`);
      
      return {
        success: true,
        accFileName: fileName,
        accFolderPath: folderPath.join('/'),
        accWebViewUrl: result.webViewUrl,
      };
    } finally {
      await projectDb2.end();
    }
    
  } catch (error: any) {
    console.error(`[ACC Upload Service] Upload failed for document ${documentId}:`, error.message);
    
    // Record failure in database
    const projectDb = createProjectDbPool(projectId);
    try {
      await projectDb.execute(
        `INSERT INTO acc_uploads (document_id, acc_item_id, acc_folder_path, acc_file_name, upload_status, upload_error, uploaded_at)
         VALUES (?, '', ?, ?, 'failed', ?, NOW())
         ON DUPLICATE KEY UPDATE 
           upload_status = 'failed',
           upload_error = VALUES(upload_error),
           uploaded_at = NOW()`,
        [documentId, 'unknown', fileName, error.message]
      );
    } catch (dbError) {
      console.error(`[ACC Upload Service] Failed to record error in database:`, dbError);
    } finally {
      await projectDb.end();
    }
    
    // Don't throw - we don't want to fail the entire processing pipeline if ACC upload fails
    console.log(`[ACC Upload Service] Continuing despite upload failure`);
    
    return {
      success: false,
      error: error.message || 'Upload failed - check ACC credentials and project mapping',
    };
  }
}

/**
 * Check if project has ACC integration enabled
 */
export async function hasACCIntegration(projectId: number): Promise<boolean> {
  const projectDb = createProjectDbPool(projectId);
  try {
    const [credRows] = await projectDb.execute(
      `SELECT COUNT(*) as count FROM acc_credentials`
    ) as any;
    
    const [mappingRows] = await projectDb.execute(
      `SELECT COUNT(*) as count FROM acc_project_mapping`
    ) as any;
    
    return credRows[0].count > 0 && mappingRows[0].count > 0;
  } finally {
    await projectDb.end();
  }
}
