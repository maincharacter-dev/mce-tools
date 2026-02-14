import fs from "fs";
import path from "path";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";

interface DocumentMetadata {
  id: string;
  fileName: string;
  filePath: string;
  fileSizeBytes: number;
  fileHash: string;
  documentType: string;
  uploadDate: Date;
}

const DATA_DIR = process.env.DATA_DIR || "/home/ubuntu/project-ingestion-engine/data/projects";

/**
 * Ensures project storage directory exists
 */
export function ensureProjectStorageDir(projectId: number): string {
  const projectDir = path.join(DATA_DIR, `proj_${projectId}`);
  const documentsDir = path.join(projectDir, "documents");
  const exportsDir = path.join(projectDir, "exports");
  const logsDir = path.join(projectDir, "logs");

  [projectDir, documentsDir, exportsDir, logsDir].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  return projectDir;
}

/**
 * Calculates SHA256 hash of a file
 */
export function calculateFileHash(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash("sha256");
  hashSum.update(fileBuffer);
  return hashSum.digest("hex");
}

/**
 * Saves uploaded document to local storage
 */
export async function saveDocument(
  projectId: number,
  fileBuffer: Buffer,
  originalFileName: string,
  documentType: string
): Promise<DocumentMetadata> {
  const projectDir = ensureProjectStorageDir(projectId);
  const documentsDir = path.join(projectDir, "documents");

  const documentId = uuidv4();
  const fileExtension = path.extname(originalFileName);
  const storedFileName = `${documentId}${fileExtension}`;
  const filePath = path.join(documentsDir, storedFileName);

  // Write file to disk
  await fs.promises.writeFile(filePath, fileBuffer);

  // Calculate hash
  const fileHash = calculateFileHash(filePath);

  const metadata: DocumentMetadata = {
    id: documentId,
    fileName: originalFileName,
    filePath: filePath,
    fileSizeBytes: fileBuffer.length,
    fileHash: fileHash,
    documentType: documentType,
    uploadDate: new Date(),
  };

  // Save metadata
  const metadataPath = path.join(documentsDir, `${documentId}_metadata.json`);
  await fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

  return metadata;
}

/**
 * Retrieves a document from storage
 */
export async function getDocument(projectId: number, documentId: string): Promise<Buffer | null> {
  const projectDir = path.join(DATA_DIR, `proj_${projectId}`);
  const documentsDir = path.join(projectDir, "documents");

  // Find the file with this ID (could have different extensions)
  const files = fs.readdirSync(documentsDir);
  const documentFile = files.find(
    (f) => f.startsWith(documentId) && !f.endsWith("_metadata.json")
  );

  if (!documentFile) {
    return null;
  }

  const filePath = path.join(documentsDir, documentFile);
  return await fs.promises.readFile(filePath);
}

/**
 * Deletes a document from storage
 */
export async function deleteDocument(projectId: number, documentId: string): Promise<boolean> {
  const projectDir = path.join(DATA_DIR, `proj_${projectId}`);
  const documentsDir = path.join(projectDir, "documents");

  try {
    // Delete main file
    const files = fs.readdirSync(documentsDir);
    const documentFile = files.find(
      (f) => f.startsWith(documentId) && !f.endsWith("_metadata.json")
    );

    if (documentFile) {
      fs.unlinkSync(path.join(documentsDir, documentFile));
    }

    // Delete metadata
    const metadataFile = `${documentId}_metadata.json`;
    const metadataPath = path.join(documentsDir, metadataFile);
    if (fs.existsSync(metadataPath)) {
      fs.unlinkSync(metadataPath);
    }

    return true;
  } catch (error) {
    console.error(`[DocumentService] Failed to delete document: ${documentId}`, error);
    return false;
  }
}

/**
 * Lists all documents for a project
 */
export async function listProjectDocuments(projectId: number): Promise<DocumentMetadata[]> {
  const projectDir = path.join(DATA_DIR, `proj_${projectId}`);
  const documentsDir = path.join(projectDir, "documents");

  if (!fs.existsSync(documentsDir)) {
    return [];
  }

  const files = fs.readdirSync(documentsDir);
  const metadataFiles = files.filter((f) => f.endsWith("_metadata.json"));

  const documents: DocumentMetadata[] = [];
  for (const metadataFile of metadataFiles) {
    const metadataPath = path.join(documentsDir, metadataFile);
    const metadataContent = await fs.promises.readFile(metadataPath, "utf-8");
    const metadata = JSON.parse(metadataContent) as DocumentMetadata;
    documents.push(metadata);
  }

  return documents;
}

/**
 * Saves processing log for a document
 */
export async function saveProcessingLog(
  projectId: string | number,
  documentId: string,
  step: string,
  status: string,
  message: string,
  durationMs?: number
): Promise<void> {
  const projectDir = path.join(DATA_DIR, `proj_${projectId}`);
  const logsDir = path.join(projectDir, "logs");

  const logEntry = {
    documentId,
    step,
    status,
    message,
    durationMs,
    timestamp: new Date().toISOString(),
  };

  const logFile = path.join(logsDir, `processing_${new Date().toISOString().split("T")[0]}.log`);
  const logLine = JSON.stringify(logEntry) + "\n";

  await fs.promises.appendFile(logFile, logLine);
}

/**
 * Cleans up all project storage
 */
export async function deleteProjectStorage(projectId: number): Promise<boolean> {
  const projectDir = path.join(DATA_DIR, `proj_${projectId}`);

  try {
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
    return true;
  } catch (error) {
    console.error(`[DocumentService] Failed to delete project storage: ${projectId}`, error);
    return false;
  }
}

/**
 * Uploads a document and saves metadata to the project database
 */
export async function uploadDocument(
  projectId: string,
  fileName: string,
  fileBuffer: Buffer,
  fileType: string,
  fileSize: number,
  documentType: string,
  uploadedBy: number
): Promise<{ id: string; fileName: string; filePath: string }> {
  const mysql = await import('mysql2/promise');
  
  // Get project dbName from main database
  const dbUrl = process.env.DATABASE_URL || "mysql://root@127.0.0.1:3306/ingestion_engine_main";
  const mainConn = await mysql.createConnection(dbUrl);
  const [rows] = await mainConn.execute('SELECT dbName FROM projects WHERE id = ?', [projectId]);
  await mainConn.end();
  
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`Project ${projectId} not found`);
  }
  const projectDbName = (rows[0] as any).dbName;
  
  // Save file to disk
  const metadata = await saveDocument(parseInt(projectId), fileBuffer, fileName, documentType);
  
  // Save metadata to database using raw mysql2 connection
  const connection = await mysql.createConnection(dbUrl.replace(/\/[^/]*$/, `/${projectDbName}`));
  
  try {
    await connection.execute(
      `INSERT INTO documents (id, fileName, filePath, fileSizeBytes, fileHash, documentType, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [metadata.id, fileName, metadata.filePath, fileSize, metadata.fileHash, documentType, 'Uploaded']
    );
  } finally {
    await connection.end();
  }
  
  return {
    id: metadata.id,
    fileName,
    filePath: metadata.filePath,
  };
}
