/**
 * PDF Text Extraction Service
 * 
 * Extracts text from PDF documents using multiple strategies:
 * 1. Direct text extraction (pdf-parse)
 * 2. OCR for scanned PDFs (tesseract.js)
 * 
 * Based on Solar Analyzer implementation patterns
 */

import { promises as fs } from 'fs';
import path from 'path';
import { PDFParse } from 'pdf-parse';
import { createWorker } from 'tesseract.js';

export interface PdfExtractionResult {
  text: string;
  pageCount: number;
  method: 'direct' | 'ocr' | 'hybrid';
  pages: Array<{
    pageNumber: number;
    text: string;
    wordCount: number;
  }>;
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
    creator?: string;
    producer?: string;
    creationDate?: Date;
    modificationDate?: Date;
  };
}

/**
 * Extract text from PDF buffer using direct text extraction
 */
export async function extractTextFromPdf(pdfBuffer: Buffer): Promise<PdfExtractionResult> {
  console.log(`[PDF Extractor] Starting extraction for ${(pdfBuffer.length / 1024).toFixed(2)} KB PDF`);
  
  try {
    // Try direct text extraction first
    const parser = new PDFParse({ data: pdfBuffer });
    const result = await parser.getText();
    const data = {
      numpages: result.total,
      text: result.text,
      info: {},
      metadata: null,
      version: '1.0'
    };
    
    console.log(`[PDF Extractor] Direct extraction completed: ${data.numpages} pages, ${data.text.length} characters`);
    
    // Check if we got meaningful text (more than just whitespace)
    const meaningfulText = data.text.trim();
    const wordsPerPage = meaningfulText.split(/\s+/).length / data.numpages;
    
    // If we have less than 10 words per page on average, it's likely a scanned PDF
    if (wordsPerPage < 10) {
      console.log(`[PDF Extractor] Low text density detected (${wordsPerPage.toFixed(1)} words/page), attempting OCR`);
      return await extractTextWithOcr(pdfBuffer);
    }
    
    // Parse pages (pdf-parse doesn't provide per-page text, so we split by form feed)
    const pageTexts = data.text.split('\f');
    const pages = pageTexts.map((text: string, index: number) => ({
      pageNumber: index + 1,
      text: text.trim(),
      wordCount: text.trim().split(/\s+/).filter((w: string) => w.length > 0).length,
    }));
    
    return {
      text: data.text,
      pageCount: data.numpages,
      method: 'direct',
      pages,
      metadata: undefined,
    };
  } catch (error) {
    console.error('[PDF Extractor] Direct extraction failed:', error);
    console.log('[PDF Extractor] Falling back to OCR');
    return await extractTextWithOcr(pdfBuffer);
  }
}

/**
 * Extract text using OCR (for scanned PDFs)
 * Note: This is a simplified version. For production, consider using pdf-poppler
 * to convert to images first (like Solar Analyzer does)
 */
async function extractTextWithOcr(pdfBuffer: Buffer): Promise<PdfExtractionResult> {
  console.log('[PDF Extractor] Starting OCR extraction');
  
  try {
    // For now, return a placeholder indicating OCR is needed
    // In production, this would use pdf-poppler + tesseract like Solar Analyzer
    console.warn('[PDF Extractor] OCR extraction not fully implemented yet');
    
    return {
      text: '[OCR extraction required - scanned PDF detected]',
      pageCount: 0,
      method: 'ocr',
      pages: [],
      metadata: undefined,
    };
  } catch (error) {
    console.error('[PDF Extractor] OCR extraction failed:', error);
    throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract text from PDF file path
 */
export async function extractTextFromPdfFile(filePath: string): Promise<PdfExtractionResult> {
  const pdfBuffer = await fs.readFile(filePath);
  return extractTextFromPdf(pdfBuffer);
}

/**
 * Extract text from PDF URL
 */
export async function extractTextFromPdfUrl(pdfUrl: string): Promise<PdfExtractionResult> {
  console.log(`[PDF Extractor] Fetching PDF from: ${pdfUrl}`);
  
  const response = await fetch(pdfUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
  }
  
  const pdfBuffer = Buffer.from(await response.arrayBuffer());
  return extractTextFromPdf(pdfBuffer);
}
