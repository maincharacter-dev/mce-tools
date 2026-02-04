/**
 * Unified Document Extraction Orchestrator
 * 
 * Routes documents to appropriate extractors based on file type
 * and manages the extraction workflow
 */

import { promises as fs } from 'fs';
import path from 'path';
import { extractTextFromPdf, extractTextFromPdfFile } from './pdf-extractor';
import { extractTextFromDocx, extractTextFromDocxFile } from './docx-extractor';
import { extractTextFromXlsx, extractTextFromXlsxFile } from './xlsx-extractor';

export interface DocumentExtractionResult {
  text: string;
  fileType: string;
  extractionMethod: string;
  wordCount: number;
  metadata?: Record<string, any>;
  pages?: Array<{
    pageNumber: number;
    text: string;
    wordCount: number;
  }>;
  sheets?: Array<{
    name: string;
    rowCount: number;
    columnCount: number;
  }>;
}

/**
 * Extract text from document based on file extension
 */
export async function extractTextFromDocument(
  filePath: string
): Promise<DocumentExtractionResult> {
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);
  
  console.log(`[Document Extractor] Processing ${fileName} (${ext})`);
  
  try {
    switch (ext) {
      case '.pdf':
        return await extractFromPdf(filePath);
      
      case '.docx':
      case '.doc':
        return await extractFromDocx(filePath);
      
      case '.xlsx':
      case '.xls':
        return await extractFromXlsx(filePath);
      
      case '.txt':
        return await extractFromText(filePath);
      
      case '.csv':
        return await extractFromCsv(filePath);
      
      default:
        throw new Error(`Unsupported file type: ${ext}`);
    }
  } catch (error) {
    console.error(`[Document Extractor] Failed to extract from ${fileName}:`, error);
    throw error;
  }
}

/**
 * Extract from PDF
 */
async function extractFromPdf(filePath: string): Promise<DocumentExtractionResult> {
  const result = await extractTextFromPdfFile(filePath);
  
  return {
    text: result.text,
    fileType: 'pdf',
    extractionMethod: result.method,
    wordCount: result.text.split(/\s+/).filter((w: string) => w.length > 0).length,
    metadata: result.metadata,
    pages: result.pages,
  };
}

/**
 * Extract from DOCX
 */
async function extractFromDocx(filePath: string): Promise<DocumentExtractionResult> {
  const result = await extractTextFromDocxFile(filePath);
  
  return {
    text: result.text,
    fileType: 'docx',
    extractionMethod: 'mammoth',
    wordCount: result.wordCount,
    metadata: {
      messages: result.messages,
    },
  };
}

/**
 * Extract from XLSX
 */
async function extractFromXlsx(filePath: string): Promise<DocumentExtractionResult> {
  const result = await extractTextFromXlsxFile(filePath);
  
  return {
    text: result.text,
    fileType: 'xlsx',
    extractionMethod: 'xlsx',
    wordCount: result.text.split(/\s+/).filter(w => w.length > 0).length,
    metadata: {
      totalRows: result.totalRows,
      totalCells: result.totalCells,
    },
    sheets: result.sheets.map(sheet => ({
      name: sheet.name,
      rowCount: sheet.rowCount,
      columnCount: sheet.columnCount,
    })),
  };
}

/**
 * Extract from plain text
 */
async function extractFromText(filePath: string): Promise<DocumentExtractionResult> {
  const text = await fs.readFile(filePath, 'utf-8');
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  
  return {
    text,
    fileType: 'txt',
    extractionMethod: 'direct',
    wordCount,
  };
}

/**
 * Extract from CSV
 * Parses CSV and converts to readable text format
 */
async function extractFromCsv(filePath: string): Promise<DocumentExtractionResult> {
  const content = await fs.readFile(filePath, 'utf-8');
  
  // Parse CSV lines
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  const rows: string[][] = [];
  
  for (const line of lines) {
    // Simple CSV parsing - handle quoted values
    const row: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current.trim());
    rows.push(row);
  }
  
  // Convert to readable text
  // First row is typically headers
  const headers = rows[0] || [];
  const dataRows = rows.slice(1);
  
  // Create text representation
  let text = `CSV Data (${dataRows.length} rows, ${headers.length} columns)\n\n`;
  text += `Headers: ${headers.join(', ')}\n\n`;
  
  // Add sample of data rows (first 50 rows)
  const sampleRows = dataRows.slice(0, 50);
  for (let i = 0; i < sampleRows.length; i++) {
    const row = sampleRows[i];
    text += `Row ${i + 1}: ${row.join(', ')}\n`;
  }
  
  if (dataRows.length > 50) {
    text += `\n... and ${dataRows.length - 50} more rows\n`;
  }
  
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  
  return {
    text,
    fileType: 'csv',
    extractionMethod: 'csv-parser',
    wordCount,
    metadata: {
      rowCount: dataRows.length,
      columnCount: headers.length,
      headers,
    },
  };
}

/**
 * Batch extract from multiple documents
 */
export async function extractTextFromDocuments(
  filePaths: string[]
): Promise<DocumentExtractionResult[]> {
  console.log(`[Document Extractor] Batch processing ${filePaths.length} documents`);
  
  const results: DocumentExtractionResult[] = [];
  
  for (const filePath of filePaths) {
    try {
      const result = await extractTextFromDocument(filePath);
      results.push(result);
    } catch (error) {
      console.error(`[Document Extractor] Failed to process ${filePath}:`, error);
      // Continue with other files
    }
  }
  
  console.log(`[Document Extractor] Batch completed: ${results.length}/${filePaths.length} successful`);
  
  return results;
}
