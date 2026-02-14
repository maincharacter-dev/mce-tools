/**
 * XLSX Text Extraction Service
 * 
 * Extracts text and data from Microsoft Excel spreadsheets (.xlsx, .xls)
 * Uses xlsx library for parsing
 */

import { promises as fs } from 'fs';
import * as XLSX from 'xlsx';

export interface XlsxExtractionResult {
  text: string;
  sheets: Array<{
    name: string;
    rowCount: number;
    columnCount: number;
    data: any[][];
    text: string;
  }>;
  totalRows: number;
  totalCells: number;
}

/**
 * Extract text and data from XLSX buffer
 */
export async function extractTextFromXlsx(xlsxBuffer: Buffer): Promise<XlsxExtractionResult> {
  console.log(`[XLSX Extractor] Starting extraction for ${(xlsxBuffer.length / 1024).toFixed(2)} KB XLSX`);
  
  try {
    // Parse workbook
    const workbook = XLSX.read(xlsxBuffer, { type: 'buffer' });
    
    const sheets = [];
    let totalRows = 0;
    let totalCells = 0;
    const allText: string[] = [];
    
    // Process each sheet
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to array of arrays
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
      
      // Calculate dimensions
      const rowCount = data.length;
      const columnCount = data.length > 0 ? Math.max(...data.map((row: any) => row.length)) : 0;
      
      // Extract text from all cells
      const sheetText = data
        .map((row: any) => row.join(' | '))
        .filter((line: string) => line.trim().length > 0)
        .join('\n');
      
      sheets.push({
        name: sheetName,
        rowCount,
        columnCount,
        data,
        text: sheetText,
      });
      
      totalRows += rowCount;
      totalCells += rowCount * columnCount;
      allText.push(`\n=== Sheet: ${sheetName} ===\n${sheetText}`);
      
      console.log(`[XLSX Extractor] Sheet "${sheetName}": ${rowCount} rows, ${columnCount} columns`);
    }
    
    const combinedText = allText.join('\n\n');
    
    console.log(`[XLSX Extractor] Extraction completed: ${workbook.SheetNames.length} sheets, ${totalRows} rows, ${totalCells} cells`);
    
    return {
      text: combinedText,
      sheets,
      totalRows,
      totalCells,
    };
  } catch (error) {
    console.error('[XLSX Extractor] Extraction failed:', error);
    throw new Error(`XLSX extraction failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract text from XLSX file path
 */
export async function extractTextFromXlsxFile(filePath: string): Promise<XlsxExtractionResult> {
  const xlsxBuffer = await fs.readFile(filePath);
  return extractTextFromXlsx(xlsxBuffer);
}

/**
 * Extract text from XLSX URL
 */
export async function extractTextFromXlsxUrl(xlsxUrl: string): Promise<XlsxExtractionResult> {
  console.log(`[XLSX Extractor] Fetching XLSX from: ${xlsxUrl}`);
  
  const response = await fetch(xlsxUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch XLSX: ${response.status} ${response.statusText}`);
  }
  
  const xlsxBuffer = Buffer.from(await response.arrayBuffer());
  return extractTextFromXlsx(xlsxBuffer);
}
