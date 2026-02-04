import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { createProject, getProjectsByUser, getProjectById, getDb } from "./db";
import { ollamaConfig } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createProjectDbPool, createProjectDbConnection } from "./db-connection";
import { uploadDocument } from "./document-service";
import { processDocument } from './document-processor-v2';
import { resumeDocumentProcessing } from './processing-resume';
import { demoRouter } from "./demo-router";
import { accRouter } from "./accRouter";
import mysql from 'mysql2/promise';
import { sql } from 'drizzle-orm';

export const appRouter = router({
  system: systemRouter,
  acc: accRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  ollama: router({
    getConfig: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const [rows] = await db.execute("SELECT * FROM ollama_config LIMIT 1") as any;
      return rows[0] || null;
    }),
    updateConfig: protectedProcedure
      .input(z.object({
        baseUrl: z.string(),
        model: z.string(),
        temperature: z.string(),
        topP: z.string(),
        timeoutSeconds: z.number(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const [existing] = await db.execute("SELECT id FROM ollamaConfig LIMIT 1") as any;
        
        if (existing.length > 0) {
          await db.update(ollamaConfig)
            .set({
              baseUrl: input.baseUrl,
              model: input.model,
              temperature: input.temperature,
              topP: input.topP,
              timeoutSeconds: input.timeoutSeconds,
              updatedAt: new Date(),
            })
            .where(eq(ollamaConfig.id, existing[0].id));
        } else {
          await db.insert(ollamaConfig).values({
            baseUrl: input.baseUrl,
            model: input.model,
            temperature: input.temperature,
            topP: input.topP,
            timeoutSeconds: input.timeoutSeconds,
          });
        }
        
        return { success: true };
      }),
    testConnection: publicProcedure
      .input(z.object({ serverUrl: z.string() }))
      .mutation(async ({ input }) => {
        try {
          const response = await fetch(`${input.serverUrl}/api/tags`);
          if (!response.ok) throw new Error("Connection failed");
          return { success: true };
        } catch (error) {
          throw new Error("Unable to connect to Ollama server");
        }
      }),
  }),

  documents: router({
    // Initialize chunked upload session
    initChunkedUpload: protectedProcedure
      .input(
        z.object({
          projectId: z.string(),
          fileName: z.string(),
          fileType: z.string(),
          fileSize: z.number(),
          documentType: z.enum(["IM", "DD_PACK", "CONTRACT", "GRID_STUDY", "CONCEPT_DESIGN", "WEATHER_FILE", "OTHER", "AUTO"]),
          totalChunks: z.number(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const { storagePut } = await import("./storage");
        
        // Store metadata in S3 (works across server instances)
        const metadata = {
          projectId: input.projectId,
          fileName: input.fileName,
          fileType: input.fileType,
          fileSize: input.fileSize,
          documentType: input.documentType,
          totalChunks: input.totalChunks,
          userId: ctx.user.id,
          createdAt: new Date().toISOString(),
        };
        
        await storagePut(
          `temp-uploads/${uploadId}/metadata.json`,
          JSON.stringify(metadata, null, 2),
          "application/json"
        );
        
        console.log(`[Chunked Upload] Initialized upload ${uploadId} in S3`);
        return { uploadId };
      }),

    // Upload individual chunk
    uploadChunk: protectedProcedure
      .input(
        z.object({
          uploadId: z.string(),
          chunkIndex: z.number(),
          chunkData: z.string(), // base64 encoded
        })
      )
      .mutation(async ({ input }) => {
        const { storagePut } = await import("./storage");
        
        // Decode and decompress chunk
        const compressedBuffer = Buffer.from(input.chunkData, "base64");
        const pako = await import("pako");
        const decompressed = pako.inflate(compressedBuffer);
        const chunkBuffer = Buffer.from(decompressed);
        
        // Upload chunk to S3
        await storagePut(
          `temp-uploads/${input.uploadId}/chunk-${input.chunkIndex}`,
          chunkBuffer,
          "application/octet-stream"
        );
        
        console.log(`[Chunked Upload] Chunk ${input.chunkIndex} uploaded to S3`);
        return { success: true, chunkIndex: input.chunkIndex };
      }),

    // Finalize chunked upload - reassemble and process
    finalizeChunkedUpload: protectedProcedure
      .input(
        z.object({
          uploadId: z.string(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const fs = await import("fs/promises");
        const path = await import("path");
        const { storageGet } = await import("./storage");
        
        try {
          console.log(`[Chunked Upload] Finalizing upload: ${input.uploadId}`);
          
          // Download metadata from S3
          const metadataUrl = (await storageGet(`temp-uploads/${input.uploadId}/metadata.json`)).url;
          const metadataResponse = await fetch(metadataUrl);
          const metadata = await metadataResponse.json();
          console.log(`[Chunked Upload] Metadata:`, metadata);
          
          // Create local temp directory for reassembly
          const tempDir = path.join(process.cwd(), "data", "temp-local", input.uploadId);
          await fs.mkdir(tempDir, { recursive: true });
          const reassembledPath = path.join(tempDir, "reassembled");
          
          // Download and reassemble chunks from S3
          console.log(`[Chunked Upload] Downloading and reassembling ${metadata.totalChunks} chunks from S3...`);
          for (let i = 0; i < metadata.totalChunks; i++) {
            const chunkUrl = (await storageGet(`temp-uploads/${input.uploadId}/chunk-${i}`)).url;
            const chunkResponse = await fetch(chunkUrl);
            const chunkBuffer = Buffer.from(await chunkResponse.arrayBuffer());
            
            if (i === 0) {
              await fs.writeFile(reassembledPath, chunkBuffer);
            } else {
              await fs.appendFile(reassembledPath, chunkBuffer);
            }
          }
          
          const fileStats = await fs.stat(reassembledPath);
          console.log(`[Chunked Upload] Reassembled file size: ${fileStats.size} bytes`);
          
          // Generate document ID
          const { v4: uuidv4 } = await import('uuid');
          const documentId = uuidv4();
          console.log(`[Chunked Upload] Generated document ID: ${documentId}`);
          
          // Process synchronously to ensure document is saved before returning
          console.log(`[Chunked Upload] === PROCESSING STARTED ===`);
              // Determine document type (without loading file into memory)
              let finalDocumentType = metadata.documentType;
              if (metadata.documentType === "AUTO") {
                const { detectDocumentType } = await import("./document-type-detector");
                try {
                  finalDocumentType = await detectDocumentType(reassembledPath, metadata.fileName);
                  console.log(`AI detected document type: ${finalDocumentType}`);
                } catch (err) {
                  console.error(`[Chunked Upload] Document type detection failed:`, err);
                  finalDocumentType = "OTHER";
                }
              }
              
              // Store chunked metadata instead of local file path
              console.log(`[Chunked Upload] Preparing chunked metadata for database...`);
              const crypto = await import('crypto');
              const projectIdNum = parseInt(metadata.projectId);
              
              // Calculate hash from reassembled file
              const hashStream = crypto.createHash('sha256');
              const readStream = (await import('fs')).createReadStream(reassembledPath);
              for await (const chunk of readStream) {
                hashStream.update(chunk);
              }
              const fileHash = hashStream.digest('hex');
              console.log(`[Chunked Upload] File hash: ${fileHash}`);
              
              // Create chunked metadata JSON to store in filePath field
              const chunkedMetadata = JSON.stringify({
                type: "chunked",
                uploadId: input.uploadId,
                totalChunks: metadata.totalChunks,
                filename: metadata.fileName,
                fileSize: metadata.fileSize,
                fileHash: fileHash
              });
              
              console.log(`[Chunked Upload] Chunked metadata:`, chunkedMetadata);
              
              // Save to database using table-prefix architecture
              console.log(`[Chunked Upload] Connecting to database with table prefix for project ${projectIdNum}...`);
              const projectConn = await createProjectDbConnection(projectIdNum);
              
              console.log(`[Chunked Upload] Inserting document into database...`, {
                documentId,
                projectIdNum,
                fileName: metadata.fileName,
                filePath: chunkedMetadata,
                fileSize: metadata.fileSize,
                fileHash,
                documentType: finalDocumentType,
                userId: metadata.userId
              });
              
              try {
                await projectConn.execute(
                  `INSERT INTO documents (id, fileName, filePath, fileSizeBytes, fileHash, documentType, uploadDate, status) 
                   VALUES (?, ?, ?, ?, ?, ?, NOW(), 'uploaded')`,
                  [documentId, metadata.fileName, chunkedMetadata, metadata.fileSize, fileHash, finalDocumentType]
                );
              } finally {
                await projectConn.end();
              }
              
              // Clean up temporary reassembled file
              try {
                await fs.unlink(reassembledPath);
                await fs.rmdir(tempDir);
                console.log(`[Chunked Upload] Cleaned up temp files`);
              } catch (cleanupError) {
                console.error(`[Chunked Upload] Cleanup failed:`, cleanupError);
              }
              
              console.log(`[Chunked Upload] ✓ Document saved to database: ${documentId}`);
              
              const document = { id: documentId, fileName: metadata.fileName, filePath: chunkedMetadata };

              // Start processing
              const projectDb = createProjectDbPool(projectIdNum);
              
              try {
                await projectDb.execute(
                  `INSERT INTO processing_jobs (document_id, status, stage, progress_percent, started_at) 
                   VALUES (?, 'queued', 'pending', 0, NOW())`,
                  [document.id]
                );
              } finally {
                await projectDb.end();
              }
              
              // Progress callback
              const updateProgress = async (stage: string, progress: number) => {
                const projectDb = createProjectDbPool(projectIdNum);
                try {
                  await projectDb.execute(
                    `UPDATE processing_jobs SET stage = ?, progress_percent = ?, updated_at = NOW() WHERE document_id = ?`,
                    [stage, progress, document.id]
                  );
                } finally {
                  await projectDb.end();
                }
              };
              
              // Don't start processing here - let the Processing Status page trigger it via processNext
              // This avoids the background processing stalling issue
              console.log(`[Chunked Upload] Document queued for processing: ${document.id}`);
              console.log(`[Chunked Upload] Processing will start when user views Processing Status page`);
              
          // Clean up S3 temp files
          console.log(`[Chunked Upload] Cleaning up S3 temp files for: ${input.uploadId}`);
          // Note: S3 cleanup is best-effort, files will be cleaned up by lifecycle policy if this fails
          
          return { documentId };
        } catch (error: any) {
          console.error(`[Chunked Upload] Finalization failed:`, error);
          throw new Error(`Failed to finalize upload: ${error.message}`);
        }
      }),

    upload: protectedProcedure
        .input(
          z.object({
            projectId: z.string(),
            fileName: z.string(),
            fileType: z.string(),
            fileSize: z.number(),
            documentType: z.enum(["IM", "DD_PACK", "CONTRACT", "GRID_STUDY", "CONCEPT_DESIGN", "WEATHER_FILE", "OTHER", "AUTO"]),
            fileData: z.string(), // base64 encoded
          })
        )
        .mutation(async ({ input, ctx }) => {
          // Decode base64 file data
          const fileBuffer = Buffer.from(input.fileData, "base64");
          
          // Determine document type using AI if AUTO is selected
          let finalDocumentType = input.documentType;
          if (input.documentType === "AUTO") {
            const { detectDocumentType } = await import("./document-type-detector");
            // Save temp file for AI analysis
            const fs = await import("fs/promises");
            const path = await import("path");
            const tempPath = path.join("/tmp", `temp_${Date.now()}_${input.fileName}`);
            await fs.writeFile(tempPath, fileBuffer);
            try {
              finalDocumentType = await detectDocumentType(tempPath, input.fileName);
              console.log(`AI detected document type: ${finalDocumentType}`);
            } finally {
              await fs.unlink(tempPath).catch(() => {});
            }
          }
        
        // Upload document
        const document = await uploadDocument(
          input.projectId,
          input.fileName,
          fileBuffer,
          input.fileType,
          input.fileSize,
          finalDocumentType as any,
          ctx.user.id
        );

        // Start processing asynchronously and save facts
        const projectIdNum = parseInt(input.projectId);
        
        // Create processing job record using project ID (table-prefix architecture)
        const projectDb = createProjectDbPool(projectIdNum);
        
        try {
          
          // Insert initial processing job
          await projectDb.execute(
            `INSERT INTO processing_jobs (document_id, status, stage, progress_percent, started_at) 
             VALUES (?, 'queued', 'pending', 0, NOW())`,
            [document.id]
          );
        } finally {
          await projectDb.end();
        }
        
        // Progress callback to update job status
        const updateProgress = async (stage: string, progress: number) => {
          const projectDb = createProjectDbPool(projectIdNum);
          try {
            
            const status = progress >= 100 ? 'completed' : 'processing';
            const completedAt = progress >= 100 ? ', completed_at = NOW()' : '';
            
            await projectDb.execute(
              `UPDATE processing_jobs SET stage = ?, progress_percent = ?, status = ? ${completedAt} WHERE document_id = ?`,
              [stage, progress, status, document.id]
            );
          } finally {
            await projectDb.end();
          }
        };
        
        // Skip extraction for weather files - they're data files, not documents
        if (finalDocumentType === 'WEATHER_FILE') {
          console.log(`[Document Processor] Skipping extraction for weather file: ${document.fileName}`);
          console.log(`[Document Processor] projectIdNum: ${projectIdNum}`);
          
          // Also create a weather_files record so it shows up in Performance Validation
          try {
            console.log(`[Document Processor] Creating weather_files record for ${document.fileName}...`);
            const weatherProjectDb = createProjectDbPool(projectIdNum);
            try {
              const { v4: uuidv4 } = await import('uuid');
              const weatherFileId = uuidv4();
              const originalFormat = document.fileName.toLowerCase().endsWith('.csv') ? 'tmy_csv' : 'unknown';
              
              // Parse weather file header to extract location
              let latitude: number | null = null;
              let longitude: number | null = null;
              let elevation: number | null = null;
              let locationName: string | null = null;
              
              try {
                const fs = await import('fs/promises');
                const fileContent = await fs.readFile(document.filePath, 'utf-8');
                const lines = fileContent.split('\n');
                
                // Parse PVGIS TMY header format
                for (const line of lines.slice(0, 20)) {
                  if (line.includes('Latitude')) {
                    const match = line.match(/Latitude[^:]*:\s*([\d.-]+)/);
                    if (match) latitude = parseFloat(match[1]);
                  }
                  if (line.includes('Longitude')) {
                    const match = line.match(/Longitude[^:]*:\s*([\d.-]+)/);
                    if (match) longitude = parseFloat(match[1]);
                  }
                  if (line.includes('Elevation')) {
                    const match = line.match(/Elevation[^:]*:\s*([\d.-]+)/);
                    if (match) elevation = parseFloat(match[1]);
                  }
                  if (line.includes('Location')) {
                    const match = line.match(/Location[^:]*:\s*(.+)/);
                    if (match) locationName = match[1].trim();
                  }
                }
                
                if (latitude && longitude) {
                  console.log(`[Document Processor] Extracted location from weather file: ${latitude}, ${longitude}`);
                }
              } catch (parseErr) {
                console.error('[Document Processor] Failed to parse weather file header:', parseErr);
              }
              
              // Build INSERT with optional location fields
              const fields = [
                'id', 'project_id', 'file_key', 'file_url', 'file_name', 'file_size_bytes',
                'source_type', 'source_document_id', 'original_format', 'status', 'is_active',
                'created_at', 'updated_at'
              ];
              const placeholders = ['?', '?', '?', '?', '?', '?', '?', '?', '?', '?', '?', 'NOW()', 'NOW()'];
              const values: any[] = [
                weatherFileId,
                projectIdNum,
                document.filePath,
                document.filePath,
                document.fileName,
                input.fileSize,
                'document_upload',
                document.id,
                originalFormat,
                'pending',
                1
              ];
              
              if (latitude !== null) {
                fields.push('latitude');
                placeholders.push('?');
                values.push(latitude);
              }
              if (longitude !== null) {
                fields.push('longitude');
                placeholders.push('?');
                values.push(longitude);
              }
              if (elevation !== null) {
                fields.push('elevation');
                placeholders.push('?');
                values.push(elevation);
              }
              if (locationName) {
                fields.push('location_name');
                placeholders.push('?');
                values.push(locationName);
              }
              
              await weatherProjectDb.execute(
                `INSERT INTO weather_files (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`,
                values
              );
              
              console.log(`[Document Processor] Created weather_files record: ${weatherFileId}`);
            } catch (weatherErr) {
              console.error('[Document Processor] Failed to create weather_files record:', weatherErr);
            } finally {
              await weatherProjectDb.end();
            }
          } catch (outerErr) {
            console.error('[Document Processor] Failed to process weather file:', outerErr);
          }
          
          await updateProgress('completed', 100);
          console.log(`Document uploaded: ${document.id}, marked as completed (weather file)`);
          return { ...document, documentId: document.id };
        }
        
        // NOTE: Processing is now handled by processNext endpoint (called from ProcessingStatus page)
        // This prevents duplicate processing - upload just creates the job, processNext executes it
        console.log(`Document uploaded: ${document.id}, queued for processing (will be picked up by processNext)`);
        console.log(`[Upload] Job status: queued, waiting for processNext to start processing`);

        return { ...document, documentId: document.id };
      }),
    debugCheckDocument: protectedProcedure
      .input(z.object({ projectId: z.string(), documentId: z.string() }))
      .query(async ({ input }) => {
        const mysql = await import('mysql2/promise');
        const db = await getDb();
        if (!db) return { error: "Database not available", document: null };
        
        const [projects] = await db.execute(`SELECT id, dbName FROM projects WHERE id = ${parseInt(input.projectId)}`) as any;
        if (!projects || projects.length === 0) {
          return { error: `Project ${input.projectId} not found`, document: null };
        }
        
        const connection = await createProjectDbConnection(parseInt(input.projectId));
        
        try {
          const [rows] = await connection.execute(
            "SELECT * FROM documents WHERE id = ?",
            [input.documentId]
          );
          const docs = rows as any[];
          return { 
            error: null, 
            document: docs.length > 0 ? docs[0] : null,
            message: docs.length > 0 ? 'Document found!' : 'Document NOT found in database',
            totalDocsInProject: null
          };
        } finally {
          await connection.end();
        }
      }),
    debugListAllDocs: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(async ({ input }) => {
        const connection = await createProjectDbConnection(parseInt(input.projectId));
        try {
          const [rows] = await connection.execute("SELECT id, fileName, status FROM documents");
          return { documents: rows as any[], count: (rows as any[]).length };
        } finally {
          await connection.end();
        }
      }),
    debugGetUploadErrors: protectedProcedure
      .query(async () => {
        const mysql = await import('mysql2/promise');
        const { getDbConfig } = await import('./db-connection');
        const mainConfig = getDbConfig();
        const conn = await mysql.createConnection(mainConfig as any);
        try {
          const [rows] = await conn.execute("SELECT * FROM upload_errors ORDER BY createdAt DESC LIMIT 20");
          return { errors: rows as any[], count: (rows as any[]).length };
        } finally {
          await conn.end();
        }
      }),
    list: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(async ({ input }) => {
        const mysql = await import('mysql2/promise');
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        // Verify project exists
        const [projects] = await db.execute(`SELECT id FROM projects WHERE id = ${parseInt(input.projectId)}`) as any;
        if (!projects || projects.length === 0) {
          throw new Error(`Project ${input.projectId} not found`);
        }
        
        // Query documents from project database using table-prefix architecture
        const connection = await createProjectDbConnection(parseInt(input.projectId));
        
        try {
          // Join with processing_jobs to get actual processing status
          const [rows] = await connection.execute(
            `SELECT d.id, d.fileName, d.filePath, d.fileSizeBytes, d.fileHash, d.documentType, d.uploadDate, 
             COALESCE(pj.status, d.status) as status, 
             pj.stage, pj.progress_percent as progressPercent,
             COALESCE(pj.error_message, d.processingError) as processingError, 
             d.pageCount, d.createdAt, d.updatedAt 
             FROM documents d 
             LEFT JOIN processing_jobs pj ON d.id = pj.document_id 
             ORDER BY d.uploadDate DESC`
          );
          return rows as unknown as any[];
        } finally {
          await connection.end();
        }
      }),
    getProcessingStatus: protectedProcedure
      .input(z.object({ projectId: z.string(), documentId: z.string() }))
      .query(async ({ input }) => {
        const projectIdNum = parseInt(input.projectId);
        const connection = await createProjectDbConnection(projectIdNum);
        try {
          const [rows] = await connection.execute(
            "SELECT processing_status, processing_error FROM documents WHERE id = ?",
            [input.documentId]
          );
          return (rows as unknown as any[])[0] || null;
        } finally {
          await connection.end();
        }
      }),
    updateDocumentType: protectedProcedure
      .input(z.object({ 
        projectId: z.string(), 
        documentId: z.string(),
        documentType: z.enum(['IM', 'DD_PACK', 'CONTRACT', 'GRID_STUDY', 'PLANNING', 'CONCEPT_DESIGN', 'WEATHER_FILE', 'OTHER'])
      }))
      .mutation(async ({ input }) => {
        const mysql = await import('mysql2/promise');
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        // Verify project exists
        const [projects] = await db.execute(`SELECT id FROM projects WHERE id = ${parseInt(input.projectId)}`) as any;
        if (!projects || projects.length === 0) {
          throw new Error(`Project ${input.projectId} not found`);
        }
        
        // Update document type in project database using table-prefix architecture
        const connection = await createProjectDbConnection(parseInt(input.projectId));
        
        try {
          await connection.execute(
            "UPDATE documents SET documentType = ?, updatedAt = NOW() WHERE id = ?",
            [input.documentType, input.documentId]
          );
          return { success: true };
        } finally {
          await connection.end();
        }
      }),
    delete: protectedProcedure
      .input(z.object({ 
        projectId: z.string(), 
        documentId: z.string()
      }))
      .mutation(async ({ input }) => {
        const fs = await import('fs/promises');
        const projectIdNum = parseInt(input.projectId);
        const connection = await createProjectDbConnection(projectIdNum);
        
        try {
          // Get document file path before deleting
          const [docs] = await connection.execute(
            "SELECT filePath FROM documents WHERE id = ?",
            [input.documentId]
          ) as any;
          
          if (docs && docs.length > 0 && docs[0].filePath) {
            const filePath = docs[0].filePath;
            // Only delete local files, not S3 URLs
            if (!filePath.startsWith('http://') && !filePath.startsWith('https://')) {
              try {
                await fs.unlink(filePath);
                console.log(`Deleted local file: ${filePath}`);
              } catch (error) {
                console.error(`Failed to delete file: ${error}`);
                // Continue even if file deletion fails
              }
            } else {
              console.log(`Skipping S3 URL deletion: ${filePath}`);
            }
          }
          
          // Delete associated facts
          await connection.execute(
            "DELETE FROM extracted_facts WHERE source_document_id = ?",
            [input.documentId]
          );
          
          // Delete associated processing jobs
          await connection.execute(
            "DELETE FROM processing_jobs WHERE document_id = ?",
            [input.documentId]
          );
          
          // Delete document record
          await connection.execute(
            "DELETE FROM documents WHERE id = ?",
            [input.documentId]
          );
          
          return { success: true, message: "Document deleted successfully" };
        } finally {
          await connection.end();
        }
      }),
    
    // Sync document to ACC
    syncToACC: protectedProcedure
      .input(z.object({
        projectId: z.string(),
        documentId: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { uploadDocumentToACC } = await import('./accUploadService');
        const projectIdNum = parseInt(input.projectId);
        
        try {
          // Get document details from project database
          const connection = await createProjectDbConnection(projectIdNum);
          try {
            const [docs] = await connection.execute(
              "SELECT id, fileName, filePath, documentType FROM documents WHERE id = ?",
              [input.documentId]
            ) as any;
            
            if (!docs || docs.length === 0) {
              return { success: false, error: 'Document not found' };
            }
            
            const doc = docs[0];
            
            const result = await uploadDocumentToACC({
              projectId: projectIdNum,
              documentId: input.documentId,
              fileName: doc.fileName,
              filePath: doc.filePath,
              documentType: doc.documentType || 'AUTO',
            });
            
            return result;
          } finally {
            await connection.end();
          }
        } catch (error: any) {
          console.error('[syncToACC] Error:', error);
          return {
            success: false,
            error: error.message || 'Failed to sync to ACC',
          };
        }
      }),

    getProgress: protectedProcedure
      .input(z.object({ projectId: z.string(), documentId: z.string() }))
      .query(async ({ input }) => {
        const db = createProjectDbPool(parseInt(input.projectId));
        
        const [rows] = await db.execute(
          `SELECT status, stage, progress_percent, error_message, started_at, completed_at 
           FROM processing_jobs 
           WHERE document_id = ? 
           ORDER BY started_at DESC 
           LIMIT 1`,
          [input.documentId]
        ) as any;
        
        await db.end();
        
        if (rows.length === 0) {
          return null;
        }
        
        return rows[0];
      }),
    processNext: protectedProcedure
      .input(z.object({ projectId: z.string(), documentId: z.string().optional() }))
      .mutation(async ({ input }) => {
        const projectIdNum = parseInt(input.projectId);
        const projectDb = createProjectDbPool(projectIdNum);
        
        try {
          let doc: any;
          
          if (input.documentId) {
            // Get specific document
            const [docs] = await projectDb.execute(
              `SELECT d.id, d.filePath, d.documentType, d.status, pj.status as jobStatus, pj.stage, pj.progress_percent
               FROM documents d
               LEFT JOIN processing_jobs pj ON d.id = pj.document_id
               WHERE d.id = ?`,
              [input.documentId]
            ) as any;
            
            if (!docs || docs.length === 0) {
              return { processed: false, error: 'Document not found' };
            }
            doc = docs[0];
          } else {
            // Find next queued document
            const [docs] = await projectDb.execute(
              `SELECT d.id, d.filePath, d.documentType, d.status, pj.status as jobStatus, pj.stage, pj.progress_percent
               FROM documents d
               LEFT JOIN processing_jobs pj ON d.id = pj.document_id
               WHERE pj.status = 'queued'
               ORDER BY pj.created_at ASC
               LIMIT 1`
            ) as any;
            
            if (!docs || docs.length === 0) {
              return { processed: false, message: 'No queued documents found' };
            }
            doc = docs[0];
            console.log(`[ProcessNext] Found queued document ${doc.id}: ${doc.filePath?.substring(0, 50)}...`);
          }
          
          // Check if already completed or failed
          if (doc.jobStatus === 'completed' || doc.jobStatus === 'failed') {
            return { processed: false, status: doc.jobStatus, message: 'Processing already finished' };
          }
          
          // Check if processing is already in progress (status = 'processing')
          // Restart if it's been stuck for more than 5 minutes
          if (doc.jobStatus === 'processing') {
            // Check how long it's been stuck
            const [stuckCheck] = await projectDb.execute(
              `SELECT TIMESTAMPDIFF(MINUTE, updated_at, NOW()) as minutes_stuck FROM processing_jobs WHERE document_id = ?`,
              [doc.id]
            ) as any;
            
            const minutesStuck = stuckCheck?.[0]?.minutes_stuck || 0;
            console.log(`[ProcessNext] Job in processing status for ${minutesStuck} minutes`);
            
            if (minutesStuck < 5) {
              // Still recent, don't restart
              return { processed: false, status: 'processing', message: `Processing in progress (${minutesStuck} min)` };
            }
            
            // Job is stuck, reset to queued and restart
            console.log(`[ProcessNext] Job stuck for ${minutesStuck} minutes, resetting to queued`);
            await projectDb.execute(
              `UPDATE processing_jobs SET status = 'queued', updated_at = NOW() WHERE document_id = ?`,
              [doc.id]
            );
            // Fall through to start processing
          }
          
          // Start processing if status is queued, null, or was just reset from stuck
          if (!doc.jobStatus || doc.jobStatus === 'queued' || doc.jobStatus === 'processing') {
            console.log(`[ProcessNext] Starting processing for document ${doc.id}`);
            console.log(`[ProcessNext] File path: ${doc.filePath}`);
            
            // ATOMIC LOCK: Use UPDATE with WHERE clause to prevent race conditions
            // Only one request can successfully update from 'queued' to 'processing'
            const [updateResult] = await projectDb.execute(
              `UPDATE processing_jobs SET status = 'processing', stage = 'starting', progress_percent = 5, updated_at = NOW() 
               WHERE document_id = ? AND status = 'queued'`,
              [doc.id]
            ) as any;
            
            // Check if we actually acquired the lock (affectedRows > 0)
            if (!updateResult || updateResult.affectedRows === 0) {
              console.log(`[ProcessNext] Lock not acquired for ${doc.id} - another process is handling it`);
              return { processed: false, status: 'processing', message: 'Another process is already handling this document' };
            }
            
            console.log(`[ProcessNext] Lock acquired for ${doc.id} (affectedRows: ${updateResult.affectedRows})`);
            
            // Get the document's fileName for the job object
            const [docDetails] = await projectDb.execute(
              `SELECT fileName FROM documents WHERE id = ?`,
              [doc.id]
            ) as any;
            const fileName = docDetails?.[0]?.fileName || 'unknown';
            
            // Create a job object that matches what processing-resume expects
            const job = {
              document_id: doc.id,
              fileName: fileName,
              filePath: doc.filePath,
              documentType: doc.documentType
            };
            
            // Process all files directly - PDF extractor now uses chunked page-by-page
            // processing for large files to stay within serverless memory limits
            // Call the EXACT same function that processing-resume uses
            // Use setTimeout to add a delay - mimicking the 2-second delay in server startup
            // This lets the database transaction fully commit and S3 upload fully settle
            console.log(`[ProcessNext] Processing file directly`);
            console.log(`[ProcessNext] Scheduling resumeDocumentProcessing with 5-second delay to let things settle`);
            setTimeout(() => {
              console.log(`[ProcessNext] 5-second delay complete, now calling resumeDocumentProcessing`);
              resumeDocumentProcessing(projectIdNum, job);
            }, 5000);
            
            console.log(`[ProcessNext] Scheduled background processing for ${doc.id}`);
            
            // Return immediately - processing continues in background
            return { processed: true, status: 'processing', message: 'Processing started in background' };
          }
          
          // Processing is in progress, just return current status
          return { 
            processed: false, 
            status: doc.jobStatus, 
            stage: doc.stage, 
            progress: doc.progress_percent,
            message: 'Processing in progress'
          };
        } finally {
          await projectDb.end();
        }
      }),

    // Retry processing for failed or stuck documents
    retryProcessing: protectedProcedure
      .input(z.object({ projectId: z.string(), documentId: z.string() }))
      .mutation(async ({ input }) => {
        const projectIdNum = parseInt(input.projectId);
        const projectDb = createProjectDbPool(projectIdNum);
        
        try {
          // Get the document
          const [docs] = await projectDb.execute(
            `SELECT d.id, d.filePath, d.documentType, d.status, pj.status as jobStatus, pj.stage
             FROM documents d
             LEFT JOIN processing_jobs pj ON d.id = pj.document_id
             WHERE d.id = ?`,
            [input.documentId]
          ) as any;
          
          if (!docs || docs.length === 0) {
            return { success: false, error: 'Document not found' };
          }
          
          const doc = docs[0];
          console.log(`[RetryProcessing] Retrying document ${doc.id}, current status: ${doc.jobStatus}`);
          
          // Reset the processing job to queued status
          const [existingJob] = await projectDb.execute(
            `SELECT id FROM processing_jobs WHERE document_id = ?`,
            [doc.id]
          ) as any;
          
          if (existingJob && existingJob.length > 0) {
            // Update existing job to queued
            await projectDb.execute(
              `UPDATE processing_jobs 
               SET status = 'queued', stage = 'pending', progress_percent = 0, 
                   error_message = NULL, started_at = NOW(), completed_at = NULL, updated_at = NOW()
               WHERE document_id = ?`,
              [doc.id]
            );
            console.log(`[RetryProcessing] Reset existing processing job to queued`);
          } else {
            // Create new processing job
            await projectDb.execute(
              `INSERT INTO processing_jobs (document_id, status, stage, progress_percent, started_at) 
               VALUES (?, 'queued', 'pending', 0, NOW())`,
              [doc.id]
            );
            console.log(`[RetryProcessing] Created new processing job`);
          }
          
          // Start processing immediately in background (don't wait for polling)
          console.log(`[RetryProcessing] Starting background processing immediately`);
          
          // Update status to processing
          await projectDb.execute(
            `UPDATE processing_jobs SET status = 'processing', stage = 'starting', progress_percent = 5, updated_at = NOW() WHERE document_id = ?`,
            [doc.id]
          );
          
          // Start processing in background (fire and forget)
          (async () => {
            const bgProjectDb = createProjectDbPool(projectIdNum);
            try {
              // Progress callback
              const updateProgress = async (stage: string, progress: number) => {
                const db = createProjectDbPool(projectIdNum);
                try {
                  await db.execute(
                    `UPDATE processing_jobs SET stage = ?, progress_percent = ?, updated_at = NOW() WHERE document_id = ?`,
                    [stage, progress, doc.id]
                  );
                } finally {
                  await db.end();
                }
              };
              
              const { processDocument } = await import('./document-processor-v2');
              
              const result = await processDocument(
                projectIdNum,
                doc.id,
                doc.filePath,
                doc.documentType,
                'llama3.2:latest',
                undefined,
                updateProgress
              );
              
              // Save facts if any
              if (result.facts && result.facts.length > 0) {
                const { insertRawFacts } = await import('./simple-fact-inserter');
                await insertRawFacts(bgProjectDb, projectIdNum, doc.id, result.facts);
              }
              
              // Mark as completed
              await bgProjectDb.execute(
                `UPDATE processing_jobs SET status = 'completed', stage = 'done', progress_percent = 100, completed_at = NOW() WHERE document_id = ?`,
                [doc.id]
              );
              console.log(`[RetryProcessing] Background processing completed for ${doc.id}`);
            } catch (error: any) {
              console.error(`[RetryProcessing] Background processing failed:`, error);
              await bgProjectDb.execute(
                `UPDATE processing_jobs SET status = 'failed', stage = 'error', error_message = ?, completed_at = NOW() WHERE document_id = ?`,
                [error.message || 'Unknown error', doc.id]
              );
            } finally {
              await bgProjectDb.end();
            }
          })();
          
          return { success: true, message: 'Processing started in background' };
        } finally {
          await projectDb.end();
        }
      }),
  }),

  demo: demoRouter,

  projects: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await getProjectsByUser(ctx.user.id);
    }),
    get: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(async ({ input }) => {
        return await getProjectById(parseInt(input.projectId));
      }),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1, "Project name is required"),
          description: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const dbName = `proj_${ctx.user.id}_${Date.now()}`;
        return await createProject(
          input.name,
          input.description || null,
          dbName,
          ctx.user.id
        );
      }),
    resetDatabase: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const project = await getProjectById(parseInt(input.projectId));
        if (!project || project.createdByUserId !== ctx.user.id) {
          throw new Error("Project not found or access denied");
        }
        
        const { provisionProjectDatabase, deleteProjectDatabase } = await import("./project-db-provisioner");
        
        // Parse DATABASE_URL to get connection details
        const { getProjectDbProvisionConfig } = await import("./db-connection");
        const config = getProjectDbProvisionConfig(project.dbName);
        
        // Delete and recreate the project database with updated schema
        await deleteProjectDatabase(config);
        await provisionProjectDatabase(config);
        
        return { success: true, message: "Project database reset successfully" };
      }),
    delete: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const projectIdNum = parseInt(input.projectId);
        const project = await getProjectById(projectIdNum);
        if (!project || project.createdByUserId !== ctx.user.id) {
          throw new Error("Project not found or access denied");
        }
        
        const { deleteProjectTables } = await import("./project-db-provisioner");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        // Delete all project tables (proj_{id}_*)
        await deleteProjectTables(projectIdNum);
        
        // Delete project record from main database
        await db.execute(
          `DELETE FROM projects WHERE id = ${projectIdNum}`
        );
        
        // Delete associated narratives
        await db.execute(
          "DELETE FROM section_narratives WHERE project_db_name = '" + project.dbName + "'"
        );
        
        return { success: true, message: "Project deleted successfully" };
      }),
    consolidate: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const projectIdNum = parseInt(input.projectId);
        const project = await getProjectById(projectIdNum);
        if (!project || project.createdByUserId !== ctx.user.id) {
          throw new Error("Project not found or access denied");
        }

        // Run Phase 2 consolidation
        const { ProjectConsolidator } = await import('./project-consolidator');
        const consolidator = new ProjectConsolidator(
          projectIdNum,
          (progress) => {
            console.log(`[Consolidation Progress] ${progress.stage}: ${progress.message}`);
          }
        );

        await consolidator.consolidate();

        return { success: true, message: "Project consolidated successfully" };
      }),
  }),

  processing: router({
    listJobs: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(async ({ input }) => {
        try {
          console.log(`[listJobs] Raw input.projectId: "${input.projectId}" (type: ${typeof input.projectId})`);
          const projectIdNum = parseInt(input.projectId);
          console.log(`[listJobs] Parsed projectIdNum: ${projectIdNum}`);
          const connection = await createProjectDbConnection(projectIdNum);
          
          try {
            // Join with documents table to get filename
            const query = `
              SELECT 
                p.id, p.document_id, p.status, p.stage, p.progress_percent, 
                p.started_at, p.completed_at, p.error_message,
                d.fileName as document_name
              FROM processing_jobs p
              LEFT JOIN documents d ON p.document_id = d.id
              ORDER BY p.started_at DESC
            `;
            console.log(`[listJobs] Executing query for proj_${projectIdNum}_processing_jobs`);
            const [rows] = await connection.execute(query);
            console.log(`[listJobs] Found ${(rows as any[]).length} jobs`);
            return rows as unknown as any[];
          } finally {
            await connection.end();
          }
        } catch (error) {
          console.error('[listJobs] Error:', error);
          throw error;
        }
      }),
    
    // Get processing logs for a project (optionally filtered by document)
    getLogs: protectedProcedure
      .input(z.object({ projectId: z.string(), documentId: z.string().nullish() }))
      .query(async ({ input }) => {
        const projectIdNum = parseInt(input.projectId);
        const connection = await createProjectDbConnection(projectIdNum);
        
        try {
          let query = `
            SELECT 
              pl.id, pl.documentId, pl.step, pl.status, pl.message, pl.durationMs, pl.createdAt,
              d.fileName as document_name
            FROM processingLogs pl
            LEFT JOIN documents d ON pl.documentId = d.id
          `;
          const params: any[] = [];
          
          if (input.documentId) {
            query += ` WHERE pl.documentId = ?`;
            params.push(input.documentId);
          }
          
          query += ` ORDER BY pl.createdAt DESC LIMIT 100`;
          
          const [rows] = await connection.execute(query, params);
          return rows as any[];
        } finally {
          await connection.end();
        }
      }),
    retryJob: protectedProcedure
      .input(z.object({ projectId: z.string(), jobId: z.number() }))
      .mutation(async ({ input }) => {
        const projectIdNum = parseInt(input.projectId);
        const connection = await createProjectDbConnection(projectIdNum);
        try {
          await connection.execute(
            "UPDATE processing_jobs SET status = 'queued', error_message = NULL WHERE id = ?",
            [input.jobId]
          );
          return { success: true };
        } finally {
          await connection.end();
        }
      }),
  }),

  facts: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(async ({ input }) => {
        const projectIdNum = parseInt(input.projectId);
        const connection = await createProjectDbConnection(projectIdNum);
        try {
          const [rows] = await connection.execute(
            "SELECT * FROM extracted_facts WHERE deleted_at IS NULL ORDER BY confidence DESC, created_at DESC"
          );
          return rows as unknown as any[];
        } finally {
          await connection.end();
        }
      }),
    getNarratives: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        // projectId is actually the project_db_name (e.g., "proj_1_1769157846333")
        // Query narratives directly using it
        const [rows] = await db.execute(
          `SELECT section_name, narrative_text FROM section_narratives WHERE project_db_name = '${input.projectId}'`
        );
        
        // Convert to map for easy lookup
        const narratives: Record<string, string> = {};
        for (const row of rows as any[]) {
          narratives[row.section_name] = row.narrative_text;
        }
        
        return narratives;
      }),
    update: protectedProcedure
      .input(
        z.object({
          projectId: z.string(),
          factId: z.number(),
          status: z.enum(["pending", "approved", "rejected"]),
          value: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const projectIdNum = parseInt(input.projectId);
        const connection = await createProjectDbConnection(projectIdNum);
        
        try {
          const updates: string[] = ["verification_status = ?"];
          const params: any[] = [input.status];
          
          if (input.value !== undefined) {
            updates.push("value = ?");
            params.push(input.value);
          }
          
          params.push(input.factId);
          
          await connection.execute(
            `UPDATE extracted_facts SET ${updates.join(", ")} WHERE id = ?`,
            params
          );
          
          return { success: true };
        } finally {
          await connection.end();
        }
      }),
    synthesizeNarrativeOnDemand: protectedProcedure
      .input(
        z.object({
          projectId: z.string(),
          section: z.string(),
          canonicalName: z.string(), // Canonical section name for state key
          facts: z.array(z.object({
            key: z.string(),
            value: z.string(),
            confidence: z.string(),
          })),
        })
      )
      .mutation(async ({ input }) => {
        const { invokeLLM } = await import("./_core/llm");
        
        // Build facts list for LLM
        const factsList = input.facts
          .map((f, idx) => `${idx + 1}. ${f.value}`)
          .join("\n");
        
        const prompt = `You are a technical writer creating a project summary document for a Technical Advisory team.

Given the following extracted facts from the "${input.section}" section, synthesize them into a cohesive, flowing narrative paragraph (or multiple paragraphs if needed).

Requirements:
- Write in professional, technical prose suitable for executive review
- Combine related facts into flowing sentences
- Maintain all specific numbers, dates, and technical details
- Remove redundancy while preserving all unique information
- Use clear, concise language
- Do NOT use bullet points or lists - write flowing paragraphs only
- Do NOT add information not present in the facts

Facts:
${factsList}

Synthesized narrative:`;

        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: "You are a technical writer specializing in project documentation for Technical Advisory teams." },
              { role: "user", content: prompt }
            ],
          });
          
          const content = response.choices[0]?.message?.content || "";
          const narrative = typeof content === 'string' ? content.trim() : "";
          
          return { narrative };
        } catch (error: any) {
          console.error("Failed to synthesize narrative:", error);
          // Fallback: return facts as bullet points
          return { narrative: factsList };
        }
      }),
  }),

  conflicts: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(async ({ input }) => {
        const projectDb = await createProjectDbConnection(parseInt(input.projectId));

        try {
          const [conflicts] = await projectDb.execute(`
            SELECT 
              c.*,
              f1.value as insight_a_value,
              f1.confidence as insight_a_confidence,
              f1.source_documents as insight_a_sources,
              f2.value as insight_b_value,
              f2.confidence as insight_b_confidence,
              f2.source_documents as insight_b_sources
            FROM insight_conflicts c
            JOIN extracted_facts f1 ON c.insight_a_id = f1.id
            JOIN extracted_facts f2 ON c.insight_b_id = f2.id
            WHERE c.resolution_status = 'pending'
            ORDER BY c.created_at DESC
          `) as any;

          await projectDb.end();
          return conflicts;
        } catch (error: any) {
          await projectDb.end();
          throw new Error(`Failed to fetch conflicts: ${error.message}`);
        }
      }),

    resolve: protectedProcedure
      .input(z.object({
        projectId: z.string(),
        conflictId: z.string(),
        resolution: z.enum(['accept_a', 'accept_b', 'merge', 'ignore']),
        mergedValue: z.string().optional(), // For merge resolution
      }))
      .mutation(async ({ input }) => {
        const projectDb = await createProjectDbConnection(parseInt(input.projectId));

        try {
          // Get conflict details
          const [conflicts] = await projectDb.execute(`
            SELECT * FROM insight_conflicts WHERE id = '${input.conflictId}'
          `) as any;

          if (conflicts.length === 0) {
            throw new Error('Conflict not found');
          }

          const conflict = conflicts[0];

          // Handle different resolution types
          if (input.resolution === 'accept_a') {
            // Keep insight A, delete insight B
            await projectDb.execute(`DELETE FROM extracted_facts WHERE id = '${conflict.insight_b_id}'`);
            await projectDb.execute(`UPDATE extracted_facts SET conflict_with = NULL WHERE id = '${conflict.insight_a_id}'`);
          } else if (input.resolution === 'accept_b') {
            // Keep insight B, delete insight A
            await projectDb.execute(`DELETE FROM extracted_facts WHERE id = '${conflict.insight_a_id}'`);
            await projectDb.execute(`UPDATE extracted_facts SET conflict_with = NULL WHERE id = '${conflict.insight_b_id}'`);
          } else if (input.resolution === 'merge') {
            // Create new merged insight, delete both originals
            const { v4: uuidv4 } = await import('uuid');
            const mergedId = uuidv4();
            
            // Get both insights
            const [insightsA] = await projectDb.execute(`SELECT * FROM extracted_facts WHERE id = '${conflict.insight_a_id}'`) as any;
            const [insightsB] = await projectDb.execute(`SELECT * FROM extracted_facts WHERE id = '${conflict.insight_b_id}'`) as any;
            
            const insightA = insightsA[0];
            const insightB = insightsB[0];
            
            // Merge source documents
            const sourcesA = insightA.source_documents ? JSON.parse(insightA.source_documents) : [insightA.source_document_id];
            const sourcesB = insightB.source_documents ? JSON.parse(insightB.source_documents) : [insightB.source_document_id];
            const mergedSources = Array.from(new Set([...sourcesA, ...sourcesB]));
            
            // Calculate weighted confidence
            const confA = parseFloat(insightA.confidence);
            const confB = parseFloat(insightB.confidence);
            const mergedConf = ((confA + confB) / 2).toFixed(2);
            
            await projectDb.execute(`
              INSERT INTO extracted_facts (
                id, category, \`key\`, value, confidence, 
                source_document_id, extraction_method, verification_status,
                source_documents, enrichment_count, merged_from
              ) VALUES (
                '${mergedId}', '${insightA.category}', '${insightA.key}', 
                '${input.mergedValue?.replace(/'/g, "''")}', '${mergedConf}',
                '${insightA.source_document_id}', 'merged', 'pending',
                '${JSON.stringify(mergedSources).replace(/'/g, "''")}', 
                ${(insightA.enrichment_count || 1) + (insightB.enrichment_count || 1)},
                '${JSON.stringify([conflict.insight_a_id, conflict.insight_b_id]).replace(/'/g, "''")}'              )
            `);
            
            // Delete originals
            await projectDb.execute(`DELETE FROM extracted_facts WHERE id IN ('${conflict.insight_a_id}', '${conflict.insight_b_id}')`);
          }

          // Update conflict status
          await projectDb.execute(`
            UPDATE insight_conflicts 
            SET resolution_status = '${input.resolution}', resolved_at = NOW()
            WHERE id = '${input.conflictId}'
          `);

          await projectDb.end();
          return { success: true };
        } catch (error: any) {
          await projectDb.end();
          throw new Error(`Failed to resolve conflict: ${error.message}`);
        }
      }),
  }),

  performance: router({
    // Run performance validation calculation
    runValidation: protectedProcedure
      .input(z.object({ 
        projectId: z.string()
      }))
      .mutation(async ({ input }) => {
        const { runPerformanceValidation } = await import('./performance-validator');
        
        console.log('[Validation] Connecting to database:', input.projectId);
        const projectDb = await createProjectDbConnection(parseInt(input.projectId));
        console.log('[Validation] Connected to database');

        try {
          console.log('[Validation] Starting validation for project:', input.projectId, 'type:', typeof input.projectId);
          
          // Fetch current performance parameters
          console.log('[Validation] Fetching params...');
          let paramRows: any;
          try {
            const result = await projectDb.execute(
              `SELECT * FROM performance_parameters WHERE project_id = ${Number(input.projectId)} ORDER BY created_at DESC LIMIT 1`
            );
            paramRows = result[0];
            console.log('[Validation] Got params:', paramRows?.length, 'rows');
          } catch (queryError: any) {
            console.error('[Validation] Query error:', queryError.message, queryError.code, queryError.sqlMessage);
            throw queryError;
          }
          
          if (!paramRows || paramRows.length === 0) {
            throw new Error('No performance parameters found. Please run consolidation first.');
          }
          
          const params = paramRows[0];
          
          // Fetch weather file data if available
          console.log('[Validation] Fetching weather data...');
          const [weatherRows] = await projectDb.execute(
            `SELECT annual_summary FROM weather_files WHERE project_id = ${Number(input.projectId)} ORDER BY created_at DESC LIMIT 1`
          ) as any;
          console.log('[Validation] Got weather rows:', weatherRows?.length);
          
          let weatherData = null;
          if (weatherRows && weatherRows.length > 0 && weatherRows[0].annual_summary) {
            const summary = weatherRows[0].annual_summary;
            console.log('[Validation] annual_summary type:', typeof summary);
            // Handle both string and already-parsed object
            weatherData = typeof summary === 'string' ? JSON.parse(summary) : summary;
          }
          
          // Run validation calculation
          const result = await runPerformanceValidation(parseInt(input.projectId), params, weatherData);
          
          console.log('[Validation] About to INSERT:', {
            assumptions: result.assumptions,
            warnings: result.warnings,
            assumptionsType: typeof result.assumptions,
            warningsType: typeof result.warnings
          });
          
          await projectDb.execute(
            `INSERT INTO performance_validations (
              id, project_id, calculation_id,
              annual_generation_gwh, capacity_factor_percent, specific_yield_kwh_kwp,
              contractor_claim_gwh, variance_percent, variance_gwh, flag_triggered, confidence_level,
              dc_capacity_mw, ac_capacity_mw, tracking_type, total_system_losses_percent,
              parameters_extracted_count, parameters_assumed_count,
              ghi_annual_kwh_m2, assumptions, warnings
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              result.id, result.project_id, result.calculation_id,
              result.annual_generation_gwh, result.capacity_factor_percent, result.specific_yield_kwh_kwp,
              result.contractor_claim_gwh, result.variance_percent, result.variance_gwh, result.flag_triggered, result.confidence_level,
              result.dc_capacity_mw, result.ac_capacity_mw, result.tracking_type, result.total_system_losses_percent,
              result.parameters_extracted_count, result.parameters_assumed_count,
              result.ghi_annual_kwh_m2, JSON.stringify(result.assumptions), JSON.stringify(result.warnings)
            ]
          );
          
          await projectDb.end();
          
          return {
            success: true,
            result: {
              ...result,
              assumptions: result.assumptions,
              warnings: result.warnings
            }
          };
        } catch (error: any) {
          await projectDb.end();
          const errorMsg = error?.message || error?.toString() || JSON.stringify(error);
          console.error('[Performance Validation Error]', errorMsg);
          throw new Error(`Validation failed: ${errorMsg}`);
        }
      }),
    
    // Get all performance validations for a project
    getByProject: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(async ({ input }) => {
        const projectDb = await createProjectDbConnection(parseInt(input.projectId));

        try {
          const [rows] = await projectDb.execute(
            "SELECT * FROM performance_validations ORDER BY created_at DESC"
          ) as any;
          await projectDb.end();
          return rows || [];
        } catch (error: any) {
          await projectDb.end();
          throw new Error(`Failed to fetch performance validations: ${error.message}`);
        }
      }),

    // Get single performance validation by ID
    getById: protectedProcedure
      .input(z.object({ projectId: z.string(), validationId: z.string() }))
      .query(async ({ input }) => {
        const projectDb = await createProjectDbConnection(parseInt(input.projectId));

        try {
          const [rows] = await projectDb.execute(
            "SELECT * FROM performance_validations WHERE id = ?",
            [input.validationId]
          ) as any;
          await projectDb.end();
          return rows[0] || null;
        } catch (error: any) {
          await projectDb.end();
          throw new Error(`Failed to fetch performance validation: ${error.message}`);
        }
      }),

    // Create new performance validation (will be called by Solar Analyzer integration)
    create: protectedProcedure
      .input(z.object({
        projectId: z.string(),
        calculationId: z.string(),
        annualGenerationGwh: z.string().optional(),
        capacityFactorPercent: z.string().optional(),
        performanceRatioPercent: z.string().optional(),
        specificYieldKwhKwp: z.string().optional(),
        contractorClaimGwh: z.string().optional(),
        variancePercent: z.string().optional(),
        varianceGwh: z.string().optional(),
        flagTriggered: z.number().optional(),
        confidenceLevel: z.string().optional(),
        dcCapacityMw: z.string().optional(),
        acCapacityMw: z.string().optional(),
        moduleModel: z.string().optional(),
        inverterModel: z.string().optional(),
        trackingType: z.string().optional(),
        totalSystemLossesPercent: z.string().optional(),
        parametersExtractedCount: z.number().optional(),
        parametersAssumedCount: z.number().optional(),
        confidenceScore: z.string().optional(),
        weatherDataSource: z.string().optional(),
        ghiAnnualKwhM2: z.string().optional(),
        poaAnnualKwhM2: z.string().optional(),
        monthlyProfile: z.string().optional(), // JSON string
        modelUsed: z.string().optional(),
        pysamVersion: z.string().optional(),
        calculationTimeSeconds: z.string().optional(),
        warnings: z.string().optional(), // JSON string
      }))
      .mutation(async ({ input }) => {
        const projectDb = await createProjectDbConnection(parseInt(input.projectId));

        try {
          const validationId = `pv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          // Get project_id from project database name
          const mainDb = await getDb();
          const [projectRows] = await mainDb.execute(
            "SELECT id FROM projects WHERE id = ?",
            [input.projectId]
          ) as any;
          const projectId = projectRows[0]?.id;
          
          await projectDb.execute(
            `INSERT INTO performance_validations (
              id, project_id, calculation_id,
              annual_generation_gwh, capacity_factor_percent, performance_ratio_percent, specific_yield_kwh_kwp,
              contractor_claim_gwh, variance_percent, variance_gwh, flag_triggered, confidence_level,
              dc_capacity_mw, ac_capacity_mw, module_model, inverter_model, tracking_type,
              total_system_losses_percent, parameters_extracted_count, parameters_assumed_count, confidence_score,
              weather_data_source, ghi_annual_kwh_m2, poa_annual_kwh_m2, monthly_profile,
              model_used, pysam_version, calculation_time_seconds, warnings
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              validationId,
              projectId,
              input.calculationId,
              input.annualGenerationGwh,
              input.capacityFactorPercent,
              input.performanceRatioPercent,
              input.specificYieldKwhKwp,
              input.contractorClaimGwh,
              input.variancePercent,
              input.varianceGwh,
              input.flagTriggered || 0,
              input.confidenceLevel,
              input.dcCapacityMw,
              input.acCapacityMw,
              input.moduleModel,
              input.inverterModel,
              input.trackingType,
              input.totalSystemLossesPercent,
              input.parametersExtractedCount,
              input.parametersAssumedCount,
              input.confidenceScore,
              input.weatherDataSource,
              input.ghiAnnualKwhM2,
              input.poaAnnualKwhM2,
              input.monthlyProfile,
              input.modelUsed,
              input.pysamVersion,
              input.calculationTimeSeconds,
              input.warnings,
            ]
          );

          await projectDb.end();
          return { success: true, validationId };
        } catch (error: any) {
          await projectDb.end();
          throw new Error(`Failed to create performance validation: ${error.message}`);
        }
      }),
  }),
  
  // Performance parameters router
  performanceParams: router({
    getByProject: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(async ({ input }) => {
        const projectDb = createProjectDbPool(parseInt(input.projectId));

        try {
          const [rows] = await projectDb.execute(
            `SELECT * FROM performance_parameters ORDER BY created_at DESC`
          );
          await projectDb.end();
          return rows;
        } catch (error: any) {
          await projectDb.end();
          throw new Error(`Failed to fetch performance parameters: ${error.message}`);
        }
      }),
    
    getById: protectedProcedure
      .input(z.object({ projectId: z.string(), id: z.string() }))
      .query(async ({ input }) => {
        const projectDb = createProjectDbPool(parseInt(input.projectId));

        try {
          const [rows] = await projectDb.execute(
            `SELECT * FROM performance_parameters WHERE id = ?`,
            [input.id]
          );
          await projectDb.end();
          return (rows as any[])[0] || null;
        } catch (error: any) {
          await projectDb.end();
          throw new Error(`Failed to fetch performance parameter: ${error.message}`);
        }
      }),
  }),
  
  // Financial data router
  financial: router({
    getByProject: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(async ({ input }) => {
        const projectDb = createProjectDbPool(parseInt(input.projectId));

        try {
          const [rows] = await projectDb.execute(
            `SELECT * FROM financial_data ORDER BY created_at DESC`
          );
          await projectDb.end();
          return rows;
        } catch (error: any) {
          await projectDb.end();
          throw new Error(`Failed to fetch financial data: ${error.message}`);
        }
      }),
    
    getById: protectedProcedure
      .input(z.object({ projectId: z.string(), id: z.string() }))
      .query(async ({ input }) => {
        const projectDb = createProjectDbPool(parseInt(input.projectId));

        try {
          const [rows] = await projectDb.execute(
            `SELECT * FROM financial_data WHERE id = ?`,
            [input.id]
          );
          await projectDb.end();
          return (rows as any[])[0] || null;
        } catch (error: any) {
          await projectDb.end();
          throw new Error(`Failed to fetch financial data: ${error.message}`);
        }
      }),
  }),
  
  // Weather files router
  weatherFiles: router({
    getByProject: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(async ({ input }) => {
        const projectDb = createProjectDbPool(parseInt(input.projectId));

        try {
          const [rows] = await projectDb.execute(
            `SELECT * FROM weather_files ORDER BY created_at DESC`
          );
          await projectDb.end();
          return rows;
        } catch (error: any) {
          await projectDb.end();
          throw new Error(`Failed to fetch weather files: ${error.message}`);
        }
      }),
    
    upload: protectedProcedure
      .input(z.object({
        projectId: z.string(),
        fileName: z.string(),
        fileContent: z.string(), // Base64 encoded
        sourceDocumentId: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const projectDb = createProjectDbPool(parseInt(input.projectId));

        try {
          // Decode base64 content
          const fileBuffer = Buffer.from(input.fileContent, 'base64');
          const fileContent = fileBuffer.toString('utf-8');
          const fileSizeBytes = fileBuffer.length;
          
          // Upload to S3
          const { v4: uuidv4 } = await import('uuid');
          const fileId = uuidv4();
          const fileKey = `project-${input.projectId}/weather/manual/${fileId}-${input.fileName}`;
          
          const { storagePut } = await import('./storage');
          const { url: fileUrl } = await storagePut(
            fileKey,
            fileContent,
            'text/csv'
          );
          
          // Detect format from filename
          const ext = input.fileName.toLowerCase().split('.').pop();
          let originalFormat = 'unknown';
          if (ext === 'csv') originalFormat = 'csv';
          else if (ext === 'epw') originalFormat = 'epw';
          else if (ext === 'tm2' || ext === 'tm3') originalFormat = 'tmy3';
          
          // Create document record so it appears in Documents list
          await projectDb.execute(
            `INSERT INTO documents (
              id, fileName, filePath, fileSizeBytes, fileHash, documentType,
              uploadDate, status, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, NOW(), NOW())`,
            [
              fileId,
              input.fileName,
              fileUrl,
              fileSizeBytes,
              fileId, // Use fileId as hash for now
              'WEATHER_FILE',
              'Processed' // Weather files don't need extraction
            ]
          );
          
          // Save to weather_files table (will be processed by Solar Analyzer when validation runs)
          await projectDb.execute(
            `INSERT INTO weather_files (
              id, project_id, file_key, file_url, file_name, file_size_bytes,
              source_type, source_document_id, original_format, status,
              is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [
              fileId,
              input.projectId,
              fileKey,
              fileUrl,
              input.fileName,
              fileSizeBytes,
              'manual_upload',
              input.sourceDocumentId || null,
              originalFormat,
              'pending', // Will be processed when validation runs
              1 // Set as active
            ]
          );
          
          await projectDb.end();
          
          console.log(`[Weather Upload] Saved weather file: ${input.fileName}`);
          
          // Auto-trigger validation if ready
          const { ValidationTrigger } = await import('./validation-trigger');
          const trigger = new ValidationTrigger();
          const triggerResult = await trigger.autoTriggerIfReady(parseInt(input.projectId));
          
          return {
            id: fileId,
            status: 'pending',
            triggered: triggerResult.triggered
          };
        } catch (error: any) {
          await projectDb.end();
          throw new Error(`Failed to upload weather file: ${error.message}`);
        }
      }),

    // Get weather data (uploaded or free fallback)
    getWeatherData: protectedProcedure
      .input(z.object({
        projectId: z.string(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
      }))
      .query(async ({ input }) => {
        const projectDb = createProjectDbPool(parseInt(input.projectId));

        try {
          // Check for uploaded weather file with processed data
          const [rows] = await projectDb.execute(
            `SELECT * FROM weather_files 
             WHERE is_active = 1 AND monthly_irradiance IS NOT NULL 
             ORDER BY created_at DESC LIMIT 1`
          );
          
          const uploadedFile = (rows as any[])[0];
          
          if (uploadedFile && uploadedFile.monthly_irradiance) {
            // Return uploaded file data
            await projectDb.end();
            return {
              source: 'uploaded' as const,
              monthlyData: typeof uploadedFile.monthly_irradiance === 'string'
                ? JSON.parse(uploadedFile.monthly_irradiance)
                : uploadedFile.monthly_irradiance,
              annualGHI: uploadedFile.annual_ghi_kwh_m2,
              annualDNI: uploadedFile.annual_dni_kwh_m2,
              fileName: uploadedFile.file_name,
            };
          }
          
          // Fall back to free weather data if location available
          let latitude = input.latitude;
          let longitude = input.longitude;

          // If location not provided, try to get from performance_parameters
          if (latitude === undefined || longitude === undefined) {
            const [perfParams] = await projectDb.execute(
              `SELECT latitude, longitude FROM performance_parameters WHERE latitude IS NOT NULL LIMIT 1`
            );
            
            if (perfParams && (perfParams as any[]).length > 0) {
              const params = (perfParams as any[])[0];
              latitude = parseFloat(params.latitude);
              longitude = parseFloat(params.longitude);
              console.log(`[WeatherData] Using location from performance_parameters: ${latitude}, ${longitude}`);
            }
          }

          await projectDb.end();
          
          if (latitude !== undefined && longitude !== undefined) {
            const { fetchFreeWeatherData } = await import('./free-weather-service');
            const freeData = await fetchFreeWeatherData(latitude, longitude);
            return freeData;
          }
          
          return null;
        } catch (error: any) {
          await projectDb.end();
          throw new Error(`Failed to get weather data: ${error.message}`);
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
