/**
 * ACC (Autodesk Construction Cloud) Router
 * 
 * Handles APS OAuth and ACC API operations.
 * Copied from acc-tools for exact compatibility.
 */

import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import {
  getAPSAuthUrl,
  exchangeCodeForToken,
  listHubs,
  listProjects,
  listProjectFolders,
  listFolderContents,
  downloadFile,
} from "./aps";
import { storagePut } from "./storage";
import path from "path";
import { getDb } from "./db";
import { documents, projects } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { createProjectDbPool } from "./db-connection";

export const accRouter = router({
  /**
   * Get APS OAuth authorization URL
   */
  getAuthUrl: publicProcedure
    .input(
      z.object({
        redirectUri: z.string(),
        state: z.string().optional(),
      })
    )
    .query(({ input }) => {
      const authUrl = getAPSAuthUrl(input.redirectUri, input.state);
      return { authUrl };
    }),

  /**
   * Exchange authorization code for access token and store credentials
   */
  exchangeCode: publicProcedure
    .input(
      z.object({
        code: z.string(),
        redirectUri: z.string(),
        projectId: z.number().optional(), // Optional: store credentials for specific project
      })
    )
    .mutation(async ({ input }) => {
      const tokens = await exchangeCodeForToken(input.code, input.redirectUri);
      
      // If projectId provided, store credentials
      if (input.projectId) {
        const projectDb = createProjectDbPool(input.projectId);
        try {
          // Calculate expiry time (tokens typically expire in 3600 seconds)
          const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);
          
          // Delete any existing credentials
          await projectDb.execute(`DELETE FROM acc_credentials`);
          
          // Insert new credentials
          await projectDb.execute(
            `INSERT INTO acc_credentials (access_token, refresh_token, expires_at) VALUES (?, ?, ?)`,
            [tokens.access_token, tokens.refresh_token, expiresAt]
          );
          
          console.log(`[ACC Auth] Stored credentials for project ${input.projectId}`);
        } finally {
          await projectDb.end();
        }
      }
      
      return tokens;
    }),

  /**
   * Get stored ACC credentials for a project
   */
  getStoredCredentials: publicProcedure
    .input(
      z.object({
        projectId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const projectDb = createProjectDbPool(input.projectId);
      try {
        const [rows] = await projectDb.execute(
          `SELECT access_token, refresh_token, expires_at FROM acc_credentials LIMIT 1`
        ) as any;
        
        if (!rows || rows.length === 0) {
          return { hasCredentials: false };
        }
        
        const cred = rows[0];
        const expiresAt = new Date(cred.expires_at);
        const isExpired = expiresAt < new Date();
        
        // If expired, try to refresh
        if (isExpired && cred.refresh_token) {
          console.log(`[ACC Auth] Token expired, refreshing...`);
          try {
            const { refreshAccessToken } = await import('./aps');
            const tokens = await refreshAccessToken(cred.refresh_token);
            
            // Update credentials in database
            const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
            await projectDb.execute(
              `UPDATE acc_credentials SET access_token = ?, refresh_token = ?, expires_at = ? WHERE id = (SELECT id FROM acc_credentials LIMIT 1)`,
              [tokens.access_token, tokens.refresh_token, expiresAt]
            );
            
            console.log(`[ACC Auth] Token refreshed successfully`);
            return {
              hasCredentials: true,
              isExpired: false,
              accessToken: tokens.access_token,
              expiresAt: expiresAt.toISOString(),
            };
          } catch (error) {
            console.error(`[ACC Auth] Failed to refresh token:`, error);
            return { hasCredentials: true, isExpired: true };
          }
        }
        
        return {
          hasCredentials: true,
          isExpired: false,
          accessToken: cred.access_token,
          expiresAt: expiresAt.toISOString(),
        };
      } finally {
        await projectDb.end();
      }
    }),

  /**
   * Store ACC project mapping
   */
  saveProjectMapping: publicProcedure
    .input(
      z.object({
        projectId: z.number(),
        accHubId: z.string(),
        accHubName: z.string(),
        accProjectId: z.string(),
        accProjectName: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const projectDb = createProjectDbPool(input.projectId);
      try {
        // Delete any existing mapping
        await projectDb.execute(`DELETE FROM acc_project_mapping`);
        
        // Insert new mapping
        await projectDb.execute(
          `INSERT INTO acc_project_mapping (acc_hub_id, acc_hub_name, acc_project_id, acc_project_name) VALUES (?, ?, ?, ?)`,
          [input.accHubId, input.accHubName, input.accProjectId, input.accProjectName]
        );
        
        console.log(`[ACC] Saved project mapping for project ${input.projectId}`);
        return { success: true };
      } finally {
        await projectDb.end();
      }
    }),

  /**
   * Get stored ACC project mapping
   */
  getProjectMapping: publicProcedure
    .input(
      z.object({
        projectId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const projectDb = createProjectDbPool(input.projectId);
      try {
        const [rows] = await projectDb.execute(
          `SELECT acc_hub_id, acc_hub_name, acc_project_id, acc_project_name FROM acc_project_mapping LIMIT 1`
        ) as any;
        
        if (!rows || rows.length === 0) {
          return { hasMapping: false };
        }
        
        const mapping = rows[0];
        return {
          hasMapping: true,
          accHubId: mapping.acc_hub_id,
          accHubName: mapping.acc_hub_name,
          accProjectId: mapping.acc_project_id,
          accProjectName: mapping.acc_project_name,
        };
      } finally {
        await projectDb.end();
      }
    }),

  /**
   * Disconnect ACC (delete credentials and mapping)
   */
  disconnect: publicProcedure
    .input(
      z.object({
        projectId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const projectDb = createProjectDbPool(input.projectId);
      try {
        await projectDb.execute(`DELETE FROM acc_credentials`);
        await projectDb.execute(`DELETE FROM acc_project_mapping`);
        console.log(`[ACC] Disconnected ACC for project ${input.projectId}`);
        return { success: true };
      } finally {
        await projectDb.end();
      }
    }),

  /**
   * Debug: Get raw hubs API response
   */
  debugHubsRaw: publicProcedure
    .input(
      z.object({
        accessToken: z.string(),
      })
    )
    .query(async ({ input }) => {
      const response = await fetch(`https://developer.api.autodesk.com/project/v1/hubs`, {
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
        },
      });
      const rawData = await response.json();
      return { 
        status: response.status,
        statusText: response.statusText,
        rawData 
      };
    }),

  /**
   * List ACC hubs (legacy - accepts access token directly)
   */
  listHubs: publicProcedure
    .input(
      z.object({
        accessToken: z.string().optional(),
        projectId: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      // If projectId is provided, get token from database with auto-refresh
      if (input.projectId) {
        const projectDb = createProjectDbPool(input.projectId);
        try {
          // Get credentials and check if expired
          const [rows] = await projectDb.execute(
            `SELECT access_token, refresh_token, expires_at FROM acc_credentials LIMIT 1`
          ) as any;
          
          if (!rows || rows.length === 0) {
            throw new Error('No ACC credentials found. Please connect to ACC first.');
          }
          
          const cred = rows[0];
          let accessToken = cred.access_token;
          const expiresAt = new Date(cred.expires_at);
          const isExpired = expiresAt < new Date();
          
          // Refresh token if expired
          if (isExpired && cred.refresh_token) {
            console.log(`[ACC] Token expired, refreshing before listing hubs...`);
            const { refreshAccessToken } = await import('./aps');
            const tokens = await refreshAccessToken(cred.refresh_token);
            
            // Update credentials
            const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);
            await projectDb.execute(
              `UPDATE acc_credentials SET access_token = ?, refresh_token = ?, expires_at = ?`,
              [tokens.access_token, tokens.refresh_token, newExpiresAt]
            );
            
            accessToken = tokens.access_token;
            console.log(`[ACC] Token refreshed successfully`);
          }
          
          // List hubs with valid token
          const hubs = await listHubs(accessToken);
          return { hubs };
        } finally {
          await projectDb.end();
        }
      }
      
      // Otherwise use provided access token (legacy behavior)
      if (!input.accessToken) {
        throw new Error('Either accessToken or projectId must be provided');
      }
      const hubs = await listHubs(input.accessToken);
      return { hubs };
    }),

  /**
   * List ACC projects
   */
  listProjects: publicProcedure
    .input(
      z.object({
        accessToken: z.string(),
        hubId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const projects = await listProjects(input.accessToken, input.hubId);
      return { projects };
    }),

  /**
   * List project folders (top-level)
   */
  listProjectFolders: publicProcedure
    .input(
      z.object({
        accessToken: z.string(),
        hubId: z.string(),
        projectId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const folders = await listProjectFolders(input.accessToken, input.hubId, input.projectId);
      return { folders };
    }),

  /**
   * List folder contents (subfolders and files)
   */
  listFolderContents: publicProcedure
    .input(
      z.object({
        accessToken: z.string(),
        projectId: z.string(),
        folderId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const contents = await listFolderContents(
        input.accessToken,
        input.projectId,
        input.folderId
      );
      console.log('[ACC Router] Folder contents response:', JSON.stringify(contents, null, 2));
      if (contents.files && contents.files.length > 0) {
        console.log('[ACC Router] First file:', JSON.stringify(contents.files[0], null, 2));
      }
      return contents;
    }),

  /**
   * Sync files from ACC to project
   */
  syncFiles: publicProcedure
    .input(
      z.object({
        accessToken: z.string(),
        projectId: z.string(),
        files: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
          })
        ),
        targetProjectId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const results = [];

      for (const file of input.files) {
        const projectPool = createProjectDbPool(input.targetProjectId);
        
        try {
          // Check if file with same name already exists
          const [existingDocs] = await projectPool.query(
            `SELECT id, fileName FROM documents WHERE fileName = ?`,
            [file.name]
          ) as any;
          
          if (existingDocs && existingDocs.length > 0) {
            console.log('[ACC Sync] File already exists, skipping:', file.name);
            results.push({
              fileId: file.id,
              fileName: file.name,
              success: false,
              skipped: true,
              error: `File "${file.name}" already exists in this project. Skipping to avoid duplicates.`,
            });
            await projectPool.end();
            continue;
          }
          
          // Download file from ACC
          const fileBuffer = await downloadFile(
            input.accessToken,
            input.projectId,
            file.id
          );

          // Save file locally (same as regular upload)
          const fs = await import('fs/promises');
          const path = await import('path');
          const DATA_DIR = '/home/ubuntu/project-ingestion-engine/data/projects';
          const projectDir = path.join(DATA_DIR, `proj_${input.targetProjectId}`, 'documents');
          await fs.mkdir(projectDir, { recursive: true });
          
          const documentId = uuidv4();
          const localFilePath = path.join(projectDir, `${documentId}${path.extname(file.name)}`);
          await fs.writeFile(localFilePath, fileBuffer);
          
          console.log('[ACC Sync] File saved locally:', localFilePath);

          await projectPool.query(
            `INSERT INTO documents (id, fileName, filePath, fileSizeBytes, fileHash, uploadDate, status, documentType) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [documentId, file.name, localFilePath, fileBuffer.length, "", new Date(), "Uploaded", "OTHER"]
          );
          
          // Create processing job so document appears on Processing Status page
          await projectPool.query(
            `INSERT INTO processing_jobs (document_id, status, stage, progress_percent, started_at) 
             VALUES (?, 'queued', 'pending', 0, NOW())`,
            [documentId]
          );
          
          await projectPool.end();
          console.log('[ACC Sync] Document and processing job inserted:', documentId);

          results.push({
            fileId: file.id,
            fileName: file.name,
            success: true,
            localPath: localFilePath,
            documentId,
          });
        } catch (error: any) {
          console.error('[ACC Sync] Failed to sync file:', file.name, 'Error:', error.message);
          console.error('[ACC Sync] Full error:', error);
          try {
            await projectPool.end();
          } catch (e) {
            // Ignore pool close errors
          }
          results.push({
            fileId: file.id,
            fileName: file.name,
            success: false,
            error: error.message,
          });
        }
      }

      return { results };
    }),
  
  /**
   * Debug: Inspect folder structure and allowed types
   */
  inspectFolderStructure: publicProcedure
    .input(
      z.object({
        projectId: z.number(),
        folderId: z.string().optional(), // If not provided, starts from root
      })
    )
    .query(async ({ input }) => {
      const projectDb = createProjectDbPool(input.projectId);
      
      try {
        // Get credentials
        const [credRows] = await projectDb.execute(
          `SELECT access_token FROM acc_credentials LIMIT 1`
        ) as any;
        
        if (!credRows || credRows.length === 0) {
          throw new Error('No ACC credentials found');
        }
        
        const accessToken = credRows[0].access_token;
        
        // Get project mapping
        const [mappingRows] = await projectDb.execute(
          `SELECT acc_hub_id, acc_project_id FROM acc_project_mapping LIMIT 1`
        ) as any;
        
        if (!mappingRows || mappingRows.length === 0) {
          throw new Error('No ACC project mapping found');
        }
        
        const { acc_hub_id: hubId, acc_project_id: projectId } = mappingRows[0];
        
        // Get folder ID to inspect
        let folderId = input.folderId;
        if (!folderId) {
          // Get root folder
          const { getRootFolderId } = await import('./accUpload');
          folderId = await getRootFolderId(accessToken, hubId, projectId);
        }
        
        // Get folder details
        const folderResponse = await fetch(
          `https://developer.api.autodesk.com/data/v1/projects/${projectId}/folders/${folderId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );
        
        if (!folderResponse.ok) {
          throw new Error(`Failed to get folder details: ${await folderResponse.text()}`);
        }
        
        const folderData = await folderResponse.json();
        
        // Get folder contents
        const contentsResponse = await fetch(
          `https://developer.api.autodesk.com/data/v1/projects/${projectId}/folders/${folderId}/contents`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );
        
        if (!contentsResponse.ok) {
          throw new Error(`Failed to get folder contents: ${await contentsResponse.text()}`);
        }
        
        const contentsData = await contentsResponse.json();
        
        return {
          folder: {
            id: folderData.data.id,
            name: folderData.data.attributes.displayName || folderData.data.attributes.name,
            type: folderData.data.attributes.extension?.type,
            allowedTypes: folderData.data.attributes.extension?.data?.allowedTypes || [],
          },
          contents: contentsData.data.map((item: any) => ({
            id: item.id,
            type: item.type,
            name: item.attributes.displayName || item.attributes.name,
            extensionType: item.attributes.extension?.type,
            allowedTypes: item.attributes.extension?.data?.allowedTypes || [],
          })),
        };
      } finally {
        await projectDb.end();
      }
    }),

  /**
   * Get sync status for documents
   */
  getSyncStatus: publicProcedure
    .input(
      z.object({
        projectId: z.number(),
        documentIds: z.array(z.string()),
      })
    )
    .query(async ({ input }) => {
      const projectDb = createProjectDbPool(input.projectId);
      try {
        const placeholders = input.documentIds.map(() => '?').join(',');
        const [rows] = await projectDb.execute(
          `SELECT document_id, acc_item_id, acc_folder_path, acc_file_name, acc_web_view_url, upload_status, uploaded_at
           FROM acc_uploads
           WHERE document_id IN (${placeholders})`,
          input.documentIds
        );
        return rows as any[];
      } finally {
        await projectDb.end();
      }
    }),

  /**
   * Batch sync multiple documents to ACC
   */
  batchSync: publicProcedure
    .input(
      z.object({
        projectId: z.number(),
        documentIds: z.array(z.string()),
        documentType: z.string().default('AUTO'),
      })
    )
    .mutation(async ({ input }) => {
      const { uploadDocumentToACC } = await import('./accUploadService');
      const { createProjectDbPool } = await import('./db-connection');
      
      console.log(`[Batch Sync] Starting batch sync for ${input.documentIds.length} documents`);
      const results = [];
      const projectDb = createProjectDbPool(input.projectId);
      
      for (const documentId of input.documentIds) {
        try {
          console.log(`[Batch Sync] Processing document ${documentId}`);
          // Fetch document details from project database
          const [docRows] = await projectDb.execute(
            `SELECT id, fileName, filePath, documentType FROM documents WHERE id = ?`,
            [documentId]
          ) as any;
          
          if (!docRows || docRows.length === 0) {
            console.log(`[Batch Sync] Document ${documentId} not found in database`);
            results.push({
              documentId,
              success: false,
              error: 'Document not found',
            });
            continue;
          }
          
          const document = docRows[0];
          console.log(`[Batch Sync] Found document: ${document.fileName}, filePath: ${document.filePath}`);
          
          const result = await uploadDocumentToACC({
            projectId: input.projectId,
            documentId: documentId,
            fileName: document.fileName,
            filePath: document.filePath,
            documentType: input.documentType === 'AUTO' ? document.documentType : input.documentType,
          });
          
          console.log(`[Batch Sync] Upload result for ${documentId}: success=${result.success}, error=${result.error}`);
          results.push({
            documentId,
            success: result.success,
            error: result.error,
          });
        } catch (error: any) {
          console.error(`[Batch Sync] Exception for ${documentId}:`, error);
          results.push({
            documentId,
            success: false,
            error: error.message,
          });
        }
      }
      
      return {
        total: input.documentIds.length,
        succeeded: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
      };
    }),
});
