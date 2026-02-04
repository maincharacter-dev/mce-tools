/**
 * Multer middleware for handling multipart/form-data file uploads
 * Supports files up to 100MB
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Extract projectId from request body or query
    const projectId = req.body.projectId || req.query.projectId;
    if (!projectId) {
      return cb(new Error('Project ID is required'), '');
    }

    // Create project-specific directory
    const uploadDir = path.join(process.cwd(), 'data', 'projects', `proj_${projectId}`, 'documents');
    
    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with UUID
    const ext = path.extname(file.originalname);
    const filename = `${randomUUID()}${ext}`;
    cb(null, filename);
  }
});

// File filter to validate file types
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/msword', // .doc
    'application/vnd.ms-excel', // .xls
    'text/plain',
    'text/csv', // .csv
    'application/csv', // .csv (alternative)
  ];

  // Also check by extension for CSV files (some browsers report different mime types)
  const ext = file.originalname.toLowerCase().split('.').pop();
  const allowedExtensions = ['pdf', 'docx', 'xlsx', 'doc', 'xls', 'txt', 'csv'];

  if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext || '')) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}. Allowed types: PDF, DOCX, XLSX, DOC, XLS, TXT, CSV`));
  }
};

// Create multer instance
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB limit
  }
});
