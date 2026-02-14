/**
 * DOCX Text Extraction Service
 * 
 * Extracts text from Microsoft Word documents (.docx)
 * Uses mammoth library for conversion
 */

import { promises as fs } from 'fs';
import * as mammoth from 'mammoth';

export interface DocxExtractionResult {
  text: string;
  html?: string;
  wordCount: number;
  messages: string[];
}

/**
 * Extract text from DOCX buffer
 */
export async function extractTextFromDocx(docxBuffer: Buffer): Promise<DocxExtractionResult> {
  console.log(`[DOCX Extractor] Starting extraction for ${(docxBuffer.length / 1024).toFixed(2)} KB DOCX`);
  
  try {
    // Extract plain text
    const textResult = await mammoth.extractRawText({ buffer: docxBuffer });
    
    // Also extract HTML for potential rich formatting preservation
    const htmlResult = await mammoth.convertToHtml({ buffer: docxBuffer });
    
    const wordCount = textResult.value.trim().split(/\s+/).filter((w: string) => w.length > 0).length;
    
    console.log(`[DOCX Extractor] Extraction completed: ${wordCount} words, ${textResult.value.length} characters`);
    
    // Collect any warnings or messages
    const messages = [
      ...textResult.messages.map((m: any) => m.message),
      ...htmlResult.messages.map((m: any) => m.message),
    ];
    
    if (messages.length > 0) {
      console.warn(`[DOCX Extractor] ${messages.length} warnings:`, messages);
    }
    
    return {
      text: textResult.value,
      html: htmlResult.value,
      wordCount,
      messages,
    };
  } catch (error) {
    console.error('[DOCX Extractor] Extraction failed:', error);
    throw new Error(`DOCX extraction failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract text from DOCX file path
 */
export async function extractTextFromDocxFile(filePath: string): Promise<DocxExtractionResult> {
  const docxBuffer = await fs.readFile(filePath);
  return extractTextFromDocx(docxBuffer);
}

/**
 * Extract text from DOCX URL
 */
export async function extractTextFromDocxUrl(docxUrl: string): Promise<DocxExtractionResult> {
  console.log(`[DOCX Extractor] Fetching DOCX from: ${docxUrl}`);
  
  const response = await fetch(docxUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch DOCX: ${response.status} ${response.statusText}`);
  }
  
  const docxBuffer = Buffer.from(await response.arrayBuffer());
  return extractTextFromDocx(docxBuffer);
}
