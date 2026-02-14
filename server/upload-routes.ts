/**
 * REST API routes for file uploads using multipart/form-data
 * Separate from tRPC because tRPC doesn't support multipart uploads
 */

import { Router } from 'express';
import { upload } from './upload-middleware';
import { uploadDocument } from './document-service';
import { processDocument } from './document-processor-v2';
import { getDb } from './db';
import mysql from 'mysql2/promise';
import { detectDocumentType, type DocumentType } from './document-type-detector';

const router = Router();

/**
 * POST /api/upload
 * Upload a document file using multipart/form-data
 * 
 * Form fields:
 * - file: The document file (required)
 * - projectId: Project ID (required)
 * - documentType: Document type enum (optional, will be auto-detected if not provided)
 * - userId: User ID (required)
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { projectId, documentType, userId } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    console.log(`[Upload API] Received file: ${req.file.originalname}, size: ${req.file.size} bytes`);

    // Get project dbName from projects table
    const db = await getDb();
    const [projects] = await db.execute(`SELECT dbName FROM projects WHERE id = ${parseInt(projectId)}`) as any;
    
    if (!projects || projects.length === 0) {
      return res.status(404).json({ error: `Project ${projectId} not found` });
    }

    const projectDbName = projects[0].dbName;

    // Determine document type using AI if not provided
    let finalDocumentType: DocumentType;
    if (documentType && documentType !== 'AUTO') {
      finalDocumentType = documentType as DocumentType;
      console.log(`[Upload API] Using provided document type: ${finalDocumentType}`);
    } else {
      console.log(`[Upload API] Detecting document type using AI...`);
      finalDocumentType = await detectDocumentType(req.file.path, req.file.originalname);
      console.log(`[Upload API] AI detected type: ${finalDocumentType}`);
    }

    // Insert document metadata into project database
    const localMySQLUrl = process.env.DATABASE_URL || "mysql://root@127.0.0.1:3306/ingestion_engine_main";
    const projectDbUrl = localMySQLUrl.replace('/ingestion_engine_main', `/${projectDbName}`);
    const projectConn = await mysql.createConnection(projectDbUrl);

    const documentId = req.file.filename.replace(/\.[^/.]+$/, ''); // Remove extension to get UUID
    const uploadDate = new Date().toISOString();

    await projectConn.execute(
      `INSERT INTO documents (id, fileName, filePath, documentType, fileSizeBytes, uploadDate, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        documentId,
        req.file.originalname,
        req.file.path,
        finalDocumentType,
        req.file.size,
        uploadDate,
        'Uploaded'
      ]
    );

    await projectConn.end();

    console.log(`[Upload API] Document saved: ${documentId}`);

    // Start processing asynchronously
    const projectIdNum = parseInt(projectId);
    processDocument(projectIdNum, documentId, req.file.path, finalDocumentType).catch(err => {
      console.error(`Failed to process document ${documentId}:`, err);
    });

    console.log(`[Upload API] Processing started for document: ${documentId}`);

    // Return success response
    res.json({
      success: true,
      document: {
        id: documentId,
        fileName: req.file.originalname,
        filePath: req.file.path,
        documentType: finalDocumentType,
        fileSizeBytes: req.file.size,
        uploadDate,
        status: 'Uploaded'
      }
    });

  } catch (error: any) {
    console.error('[Upload API] Error:', error);
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
});

export default router;
