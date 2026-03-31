/**
 * Processing Resume Service
 * 
 * Automatically resumes incomplete document processing on server startup
 * Also polls for large files that production deferred to sandbox (waiting_for_sandbox)
 */

import { getDb } from './db';
import { createProjectDbConnection } from './db-connection';
import { processDocument } from './document-processor-v2';
import { createProjectDbPool } from './db-connection';

// Polling interval for checking waiting_for_sandbox jobs (30 seconds)
const SANDBOX_POLL_INTERVAL_MS = 30000;
let pollingInterval: NodeJS.Timeout | null = null;

/**
 * Find all documents with incomplete processing and resume them
 */
export async function resumeIncompleteProcessing() {
  console.log('[Processing Resume] Checking for incomplete processing jobs...');
  
  try {
    const db = await getDb();
    if (!db) {
      console.warn('[Processing Resume] Database not available, skipping resume check');
      return;
    }
    
    // Discover active projects by scanning for proj_*_processing_jobs tables
    // (projects table lives in oe_toolkit, not mce_workspace)
    const [tables] = await db.execute(
      `SELECT TABLE_NAME FROM information_schema.TABLES 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE 'proj_%_processing_jobs'`
    ) as any;
    
    if (!tables || tables.length === 0) {
      console.log('[Processing Resume] No project tables found');
      return;
    }
    
    // Extract project IDs from table names like proj_5_processing_jobs
    const projects = (tables as any[]).map((t: any) => {
      const match = t.TABLE_NAME.match(/^proj_(\d+)_processing_jobs$/);
      return match ? { id: parseInt(match[1]) } : null;
    }).filter(Boolean);
    
    let totalIncomplete = 0;
    
    // Check each project for incomplete processing jobs
    for (const project of projects) {
      const projectId = project!.id;
      
      try {
        const projectConn = await createProjectDbConnection(projectId);
        
        try {
            // Find processing jobs that are stuck (status = 'processing' and updated more than 5 minutes ago)
            const [incompleteJobs] = await projectConn.execute(`
              SELECT 
                pj.document_id,
                pj.status,
                pj.stage,
                pj.progress_percent,
                pj.started_at,
                pj.updated_at,
                d.fileName,
                d.filePath,
                d.documentType
              FROM processing_jobs pj
              JOIN documents d ON d.id = pj.document_id
              WHERE pj.status = 'processing'
                AND (pj.updated_at IS NULL OR pj.updated_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE))
              ORDER BY pj.started_at ASC
            `) as any;
          
          if (incompleteJobs && incompleteJobs.length > 0) {
            console.log(`[Processing Resume] Found ${incompleteJobs.length} incomplete job(s) in project ${projectId}`);
            totalIncomplete += incompleteJobs.length;
            
            // Resume each incomplete job
            for (const job of incompleteJobs) {
              // Check if facts already exist for this document - if so, it's actually complete
              let factCount = 0;
              try {
                const [factResult] = await projectConn.execute(
                  `SELECT COUNT(*) as count FROM facts WHERE document_id = ?`,
                  [job.document_id]
                ) as any;
                factCount = factResult?.[0]?.count || 0;
              } catch (e) {
                // facts table might not exist in older projects
                factCount = 0;
              }
              
              if (factCount > 0) {
                console.log(`[Processing Resume] Skipping ${job.fileName} - already has ${factCount} facts extracted, marking as completed`);
                await projectConn.execute(
                  `UPDATE processing_jobs SET status = 'completed', stage = 'done', progress_percent = 100, completed_at = NOW() WHERE document_id = ?`,
                  [job.document_id]
                );
                continue;
              }
              
              console.log(`[Processing Resume] Resuming: ${job.fileName} (${job.document_id}) - stuck at ${job.stage} (${job.progress_percent}%)`);
              
              // Reset the job to queued state
              await projectConn.execute(
                `UPDATE processing_jobs 
                 SET status = 'processing', 
                     stage = 'resumed', 
                     progress_percent = 0,
                     updated_at = NOW() 
                 WHERE document_id = ?`,
                [job.document_id]
              );
              
              // Start processing in background
              resumeDocumentProcessing(projectId, job);
            }
          }
        } finally {
          await projectConn.end();
        }
      } catch (projectError) {
        console.error(`[Processing Resume] Error checking project ${projectId}:`, projectError);
      }
    }
    
    if (totalIncomplete > 0) {
      console.log(`[Processing Resume] ✓ Resumed ${totalIncomplete} incomplete processing job(s)`);
    } else {
      console.log('[Processing Resume] ✓ No incomplete jobs found');
    }
  } catch (error) {
    console.error('[Processing Resume] Error:', error);
  }
}

/**
 * Check for jobs waiting for sandbox processing (large files deferred from production)
 * This runs on a polling interval while the sandbox is active
 * Note: Small files (pending) should be processed by production, not sandbox
 */
export async function checkWaitingForSandboxJobs() {
  try {
    const db = await getDb();
    if (!db) return;
    
    // Discover active projects by scanning for proj_*_processing_jobs tables
    const [tables] = await db.execute(
      `SELECT TABLE_NAME FROM information_schema.TABLES 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE 'proj_%_processing_jobs'`
    ) as any;
    if (!tables || tables.length === 0) return;
    const projects = (tables as any[]).map((t: any) => {
      const match = t.TABLE_NAME.match(/^proj_(\d+)_processing_jobs$/);
      return match ? { id: parseInt(match[1]) } : null;
    }).filter(Boolean);
    
    for (const project of projects) {
      const projectId = project!.id;
      
      try {
        const projectConn = await createProjectDbConnection(projectId);
        
        try {
          // Find jobs that are queued and waiting for sandbox (large files only)
          // Small files (pending) should be processed by production, not sandbox
          const [waitingJobs] = await projectConn.execute(`
            SELECT 
              pj.document_id,
              pj.status,
              pj.stage,
              d.fileName,
              d.filePath,
              d.documentType
            FROM processing_jobs pj
            JOIN documents d ON d.id = pj.document_id
            WHERE pj.status = 'queued' AND pj.stage = 'waiting_for_sandbox'
            ORDER BY pj.created_at ASC
            LIMIT 1
          `) as any;
          
          if (waitingJobs && waitingJobs.length > 0) {
            const job = waitingJobs[0];
            console.log(`[Sandbox Poll] Found waiting job: ${job.fileName} (${job.document_id})`);
            
            // Update status to processing
            await projectConn.execute(
              `UPDATE processing_jobs SET status = 'processing', stage = 'starting', progress_percent = 0, updated_at = NOW() WHERE document_id = ?`,
              [job.document_id]
            );
            
            // Start processing
            resumeDocumentProcessing(projectId, job);
          }
        } finally {
          await projectConn.end();
        }
      } catch (projectError) {
        // Silently ignore project errors during polling
      }
    }
  } catch (error) {
    // Silently ignore errors during polling to avoid log spam
  }
}

/**
 * Start polling for waiting_for_sandbox jobs
 * Called on server startup
 */
export function startSandboxPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
  
  console.log(`[Sandbox Poll] Starting polling every ${SANDBOX_POLL_INTERVAL_MS / 1000}s for large files waiting for sandbox processing`);
  
  // Run immediately on startup
  checkWaitingForSandboxJobs();
  
  // Then poll at regular intervals
  pollingInterval = setInterval(() => {
    checkWaitingForSandboxJobs();
  }, SANDBOX_POLL_INTERVAL_MS);
}

/**
 * Stop polling (for cleanup)
 */
export function stopSandboxPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log('[Sandbox Poll] Polling stopped');
  }
}

/**
 * Resume processing for a single document
 * Exported so it can be called from processNext endpoint
 */
export async function resumeDocumentProcessing(projectId: number, job: any) {
  const document = {
    id: job.document_id,
    fileName: job.fileName,
    filePath: job.filePath
  };
  
  console.log(`[Processing Resume] Starting background processing for ${document.fileName}`);
  console.log(`[Processing Resume] File path: ${document.filePath}`);
  
  // Check if filePath contains chunked metadata (JSON string)
  // Handle both with and without spaces in JSON: "type":"chunked" or "type": "chunked"
  const isChunkedFile = document.filePath.startsWith('{') && 
    (document.filePath.includes('"type":"chunked"') || document.filePath.includes('"type": "chunked"'));
  
  if (isChunkedFile) {
    console.log(`[Processing Resume] Detected chunked file metadata, will download from S3 during processing`);
    // For chunked files, the document-processor-v2 will handle S3 download
    // No need to validate local file existence
  } else {
    // Validate local file exists before processing
    const fs = await import('fs/promises');
    try {
      await fs.access(document.filePath);
      console.log(`[Processing Resume] File exists: ${document.filePath}`);
    } catch (error) {
      console.error(`[Processing Resume] File not found: ${document.filePath}`);
      const projectDb = createProjectDbPool(projectId);
      try {
        await projectDb.execute(
          `UPDATE processing_jobs SET status = 'failed', stage = 'error', error_message = ?, completed_at = NOW() WHERE document_id = ?`,
          [`File not found: ${document.filePath}`, document.id]
        );
      } finally {
        await projectDb.end();
      }
      return;
    }
  }
  
  // Resolve AUTO document type before processing
  let resolvedDocumentType = job.documentType || 'OTHER';
  if (resolvedDocumentType === 'AUTO') {
    try {
      const { detectDocumentType } = await import('./document-type-detector');
      // For chunked files, pass the filePath JSON string — detectDocumentType handles reassembly
      resolvedDocumentType = await detectDocumentType(document.filePath, document.fileName);
      console.log(`[Processing Resume] AUTO detected document type: ${resolvedDocumentType}`);
      // Persist the detected type back to the documents table
      const projectDb = createProjectDbPool(projectId);
      try {
        await projectDb.execute(
          `UPDATE documents SET documentType = ? WHERE id = ?`,
          [resolvedDocumentType, document.id]
        );
      } finally {
        await projectDb.end();
      }
    } catch (detectErr) {
      console.error(`[Processing Resume] AUTO type detection failed, falling back to OTHER:`, detectErr);
      resolvedDocumentType = 'OTHER';
    }
  }

  // Progress callback
  const updateProgress = async (stage: string, progress: number) => {
    const projectDb = createProjectDbPool(projectId);
    try {
      await projectDb.execute(
        `UPDATE processing_jobs SET stage = ?, progress_percent = ?, updated_at = NOW() WHERE document_id = ?`,
        [stage, progress, document.id]
      );
    } finally {
      await projectDb.end();
    }
  };
  
  // Process document in background using process.nextTick to completely break the async context chain
  // This ensures the processing runs in a fresh execution context, not tied to any HTTP request
  process.nextTick(() => {
    console.log(`[Processing Resume] process.nextTick fired - starting processDocument in fresh context`);
    processDocument(
      projectId,
      document.id,
      document.filePath,
      resolvedDocumentType,
      'llama3.2:latest',
      undefined,
      updateProgress
    ).then(async (result) => {
    console.log(`[Processing Resume] ✓ Completed: ${document.fileName} (${result.facts.length} facts extracted)`);
    
    // Save facts if any were extracted
    if (result.facts.length > 0) {
      const projectDb = createProjectDbPool(projectId);
      try {
        const { insertRawFacts } = await import('./simple-fact-inserter');
        await insertRawFacts(projectDb, projectId, document.id, result.facts);
      } finally {
        await projectDb.end();
      }
    }
    
    // Mark as completed
    const projectDb = createProjectDbPool(projectId);
    try {
      await projectDb.execute(
        `UPDATE processing_jobs SET status = 'completed', stage = 'done', progress_percent = 100, completed_at = NOW() WHERE document_id = ?`,
        [document.id]
      );
    } finally {
      await projectDb.end();
    }
  }).catch(async (error) => {
    console.error(`[Processing Resume] ✗ Failed: ${document.fileName}:`, error);
    
    // Mark as failed
    const projectDb = createProjectDbPool(projectId);
    try {
      await projectDb.execute(
        `UPDATE processing_jobs SET status = 'failed', stage = 'error', error_message = ?, completed_at = NOW() WHERE document_id = ?`,
        [error.message, document.id]
      );
    } finally {
      await projectDb.end();
    }
  });
  }); // Close process.nextTick callback
}
