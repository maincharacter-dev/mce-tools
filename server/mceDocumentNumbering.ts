/**
 * MCE Document Numbering Service
 * 
 * Generates MCE document numbers following the convention:
 * {PROJECT_CODE}-MCE-{DISCIPLINE}-{DOCTYPE}-{NUMBER}-{STATUS}-{REV}
 * 
 * Examples:
 * - PROJ001-MCE-TA-RPT-001-S0-A (Technical Advisory Report, WIP, draft revision A)
 * - PROJ001-MCE-DE-SUM-002-A1-0 (Data Extraction Summary, Ready for Issue, issued revision 0)
 */

import { createProjectDbPool } from "./db-connection.js";

/**
 * Discipline codes
 */
export const DISCIPLINE_CODES = {
  TECHNICAL_ADVISORY: "TA",
  COMMERCIAL_ADVISORY: "CA",
  DATA_EXTRACTION: "DE",
  DUE_DILIGENCE: "DD",
  PROCUREMENT_SUPPORT: "PS",
} as const;

/**
 * Document type codes
 */
export const DOCUMENT_TYPE_CODES = {
  REPORT: "RPT",
  SUMMARY: "SUM",
  SPREADSHEET: "XLS",
  PRESENTATION: "PPT",
  MEMO: "MEM",
  DRAWING: "DWG",
} as const;

/**
 * Status codes
 */
export const STATUS_CODES = {
  WIP: "S0",                    // Work in Progress
  INTERNAL_REVIEW: "S1",        // Internal Review
  EXTERNAL_REVIEW: "S2",        // External Review (Client Review)
  FINAL_REVIEW: "S3",           // Final Review
  READY_FOR_ISSUE: "A1",        // Ready for Issue (Approved)
} as const;

/**
 * Revision codes
 * - Drafts: A, B, C, D... (letters)
 * - Issued: 0, 1, 2, 3... (numbers)
 */
export const REVISION_TYPES = {
  DRAFT: "draft",    // Use letters: A, B, C...
  ISSUED: "issued",  // Use numbers: 0, 1, 2...
} as const;

/**
 * Generate next MCE document number
 * 
 * @param projectId - Project ID
 * @param projectCode - Project code (e.g., "PROJ001")
 * @param discipline - Discipline code
 * @param documentType - Document type code
 * @param status - Status code (defaults to S0 for new documents)
 * @param revisionType - Revision type (draft or issued)
 * @returns Full MCE document number
 */
export async function generateMCEDocumentNumber(
  projectId: number,
  projectCode: string,
  discipline: string,
  documentType: string,
  status: string = STATUS_CODES.WIP,
  revisionType: "draft" | "issued" = "draft"
): Promise<string> {
  
  const db = createProjectDbPool(projectId);
  
  try {
    // Get or create sequence number
    const [rows] = await db.execute(
      `SELECT last_number FROM document_numbers 
       WHERE project_code = ? AND discipline = ? AND document_type = ?`,
      [projectCode, discipline, documentType]
    ) as any;
    
    let nextNumber: number;
    
    if (rows && rows.length > 0) {
      // Increment existing sequence
      nextNumber = rows[0].last_number + 1;
      await db.execute(
        `UPDATE document_numbers 
         SET last_number = ?, updated_at = NOW() 
         WHERE project_code = ? AND discipline = ? AND document_type = ?`,
        [nextNumber, projectCode, discipline, documentType]
      );
    } else {
      // Create new sequence starting at 1
      nextNumber = 1;
      await db.execute(
        `INSERT INTO document_numbers (project_code, discipline, document_type, last_number) 
         VALUES (?, ?, ?, ?)`,
        [projectCode, discipline, documentType, nextNumber]
      );
    }
    
    // Format number with leading zeros (3 digits)
    const numberPart = String(nextNumber).padStart(3, '0');
    
    // Determine revision
    const revision = revisionType === "draft" ? "A" : "0";
    
    // Build full document number
    const documentNumber = `${projectCode}-MCE-${discipline}-${documentType}-${numberPart}-${status}-${revision}`;
    
    return documentNumber;
    
  } finally {
    await db.end();
  }
}

/**
 * Parse MCE document number into components
 * 
 * @param documentNumber - Full MCE document number
 * @returns Parsed components
 */
export function parseMCEDocumentNumber(documentNumber: string): {
  projectCode: string;
  discipline: string;
  documentType: string;
  number: string;
  status: string;
  revision: string;
} | null {
  
  // Format: {PROJECT_CODE}-MCE-{DISCIPLINE}-{DOCTYPE}-{NUMBER}-{STATUS}-{REV}
  const pattern = /^([A-Z0-9]+)-MCE-([A-Z]+)-([A-Z]+)-(\d{3})-([A-Z]\d)-([A-Z0-9])$/;
  const match = documentNumber.match(pattern);
  
  if (!match) {
    return null;
  }
  
  return {
    projectCode: match[1],
    discipline: match[2],
    documentType: match[3],
    number: match[4],
    status: match[5],
    revision: match[6],
  };
}

/**
 * Increment revision of an existing document number
 * 
 * @param documentNumber - Current document number
 * @param revisionType - Type of revision (draft or issued)
 * @returns New document number with incremented revision
 */
export function incrementRevision(
  documentNumber: string,
  revisionType: "draft" | "issued" = "draft"
): string | null {
  
  const parsed = parseMCEDocumentNumber(documentNumber);
  if (!parsed) {
    return null;
  }
  
  let newRevision: string;
  
  if (revisionType === "draft") {
    // Increment letter: A → B, B → C, etc.
    const currentLetter = parsed.revision;
    if (currentLetter.match(/^[A-Z]$/)) {
      const nextCharCode = currentLetter.charCodeAt(0) + 1;
      newRevision = String.fromCharCode(nextCharCode);
    } else {
      // If current is a number, start from A
      newRevision = "A";
    }
  } else {
    // Increment number: 0 → 1, 1 → 2, etc.
    const currentNumber = parsed.revision;
    if (currentNumber.match(/^\d+$/)) {
      newRevision = String(parseInt(currentNumber) + 1);
    } else {
      // If current is a letter, start from 0
      newRevision = "0";
    }
  }
  
  return `${parsed.projectCode}-MCE-${parsed.discipline}-${parsed.documentType}-${parsed.number}-${parsed.status}-${newRevision}`;
}

/**
 * Update status of an existing document number
 * 
 * @param documentNumber - Current document number
 * @param newStatus - New status code
 * @returns New document number with updated status
 */
export function updateStatus(
  documentNumber: string,
  newStatus: string
): string | null {
  
  const parsed = parseMCEDocumentNumber(documentNumber);
  if (!parsed) {
    return null;
  }
  
  return `${parsed.projectCode}-MCE-${parsed.discipline}-${parsed.documentType}-${parsed.number}-${newStatus}-${parsed.revision}`;
}

/**
 * Get discipline code from deliverable type
 */
export function getDisciplineCode(deliverableType: string): string {
  const mapping: Record<string, string> = {
    "Data_Extraction": DISCIPLINE_CODES.DATA_EXTRACTION,
    "Technical_Advisory": DISCIPLINE_CODES.TECHNICAL_ADVISORY,
    "Commercial_Advisory": DISCIPLINE_CODES.COMMERCIAL_ADVISORY,
    "Due_Diligence": DISCIPLINE_CODES.DUE_DILIGENCE,
    "Procurement_Support": DISCIPLINE_CODES.PROCUREMENT_SUPPORT,
  };
  
  return mapping[deliverableType] || DISCIPLINE_CODES.DATA_EXTRACTION;
}

/**
 * Get document type code from file extension
 */
export function getDocumentTypeCode(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  switch (ext) {
    case 'pdf':
    case 'docx':
    case 'doc':
      return DOCUMENT_TYPE_CODES.REPORT;
    case 'xlsx':
    case 'xls':
    case 'csv':
      return DOCUMENT_TYPE_CODES.SPREADSHEET;
    case 'pptx':
    case 'ppt':
      return DOCUMENT_TYPE_CODES.PRESENTATION;
    case 'txt':
    case 'md':
      return DOCUMENT_TYPE_CODES.MEMO;
    case 'dwg':
    case 'dxf':
      return DOCUMENT_TYPE_CODES.DRAWING;
    default:
      return DOCUMENT_TYPE_CODES.REPORT;
  }
}
