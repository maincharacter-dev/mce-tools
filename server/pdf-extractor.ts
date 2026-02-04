/**
 * PDF Text Extraction Service
 * 
 * Extracts text from PDF documents using multiple strategies:
 * 1. unpdf with chunked page-by-page processing (serverless-compatible)
 * 2. pdftotext (fast native tool, if available)
 * 3. OCR for scanned PDFs (tesseract.js)
 * 
 * Large files (>20MB) are processed page-by-page to stay within
 * serverless memory limits.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getDocumentProxy } from 'unpdf';

const execAsync = promisify(exec);

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

// Memory threshold for chunked processing (20MB)
const LARGE_FILE_THRESHOLD = 20 * 1024 * 1024;
// Pages to process per batch for large files
const PAGES_PER_BATCH = 10;

/**
 * Extract text from a single page using unpdf
 */
async function extractPageText(page: any): Promise<string> {
  try {
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item: any) => item.str || '')
      .join(' ');
    return text;
  } catch (error) {
    console.error(`[PDF Extractor] Error extracting page text:`, error);
    return '';
  }
}

/**
 * Extract text from PDF buffer using chunked page-by-page processing
 * This approach processes pages in batches to stay within memory limits
 */
export async function extractTextFromPdf(pdfBuffer: Buffer): Promise<PdfExtractionResult> {
  const sizeMB = (pdfBuffer.length / (1024 * 1024)).toFixed(2);
  const isLargeFile = pdfBuffer.length > LARGE_FILE_THRESHOLD;
  
  console.log(`[PDF Extractor] Starting extraction for ${sizeMB} MB PDF (${isLargeFile ? 'chunked' : 'standard'} mode)`);
  
  try {
    const parseStart = Date.now();
    
    // Convert Buffer to Uint8Array for unpdf
    const uint8Array = new Uint8Array(pdfBuffer);
    
    // Load the PDF document proxy (lightweight - doesn't load all pages into memory)
    console.log(`[PDF Extractor] Loading PDF document proxy...`);
    const pdf = await getDocumentProxy(uint8Array);
    const totalPages = pdf.numPages;
    
    console.log(`[PDF Extractor] Document has ${totalPages} pages, extracting text ${isLargeFile ? 'in batches of ' + PAGES_PER_BATCH : 'all at once'}...`);
    
    const pages: Array<{ pageNumber: number; text: string; wordCount: number }> = [];
    const allText: string[] = [];
    
    if (isLargeFile) {
      // CHUNKED PROCESSING: Process pages in batches
      for (let batchStart = 0; batchStart < totalPages; batchStart += PAGES_PER_BATCH) {
        const batchEnd = Math.min(batchStart + PAGES_PER_BATCH, totalPages);
        const batchNum = Math.floor(batchStart / PAGES_PER_BATCH) + 1;
        const totalBatches = Math.ceil(totalPages / PAGES_PER_BATCH);
        
        console.log(`[PDF Extractor] Processing batch ${batchNum}/${totalBatches} (pages ${batchStart + 1}-${batchEnd})`);
        
        // Process each page in this batch
        for (let pageNum = batchStart + 1; pageNum <= batchEnd; pageNum++) {
          try {
            const page = await pdf.getPage(pageNum);
            const pageText = await extractPageText(page);
            
            pages.push({
              pageNumber: pageNum,
              text: pageText.trim(),
              wordCount: pageText.trim().split(/\s+/).filter((w: string) => w.length > 0).length,
            });
            allText.push(pageText);
            
            // Clean up page to free memory
            // @ts-ignore - cleanup method exists on page proxy
            if (page.cleanup) page.cleanup();
          } catch (pageError) {
            console.error(`[PDF Extractor] Error on page ${pageNum}:`, pageError);
            pages.push({
              pageNumber: pageNum,
              text: '',
              wordCount: 0,
            });
          }
        }
        
        // Log progress
        const elapsed = (Date.now() - parseStart) / 1000;
        const pagesProcessed = batchEnd;
        const rate = pagesProcessed / elapsed;
        const eta = (totalPages - pagesProcessed) / rate;
        console.log(`[PDF Extractor] Progress: ${pagesProcessed}/${totalPages} pages (${rate.toFixed(1)} pages/sec, ETA: ${eta.toFixed(0)}s)`);
        
        // Force garbage collection hint between batches
        if (global.gc) {
          global.gc();
        }
      }
    } else {
      // STANDARD PROCESSING: Process all pages (for smaller files)
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const pageText = await extractPageText(page);
          
          pages.push({
            pageNumber: pageNum,
            text: pageText.trim(),
            wordCount: pageText.trim().split(/\s+/).filter((w: string) => w.length > 0).length,
          });
          allText.push(pageText);
        } catch (pageError) {
          console.error(`[PDF Extractor] Error on page ${pageNum}:`, pageError);
          pages.push({
            pageNumber: pageNum,
            text: '',
            wordCount: 0,
          });
        }
      }
    }
    
    const parseTime = Date.now() - parseStart;
    const fullText = allText.join('\n\n');
    
    console.log(`[PDF Extractor] Extraction completed in ${(parseTime / 1000).toFixed(2)}s: ${totalPages} pages, ${(fullText.length / 1024).toFixed(2)} KB text`);
    console.log(`[PDF Extractor] Extraction rate: ${(totalPages / (parseTime / 1000)).toFixed(2)} pages/sec`);
    
    // Check if we got meaningful text
    const meaningfulText = fullText.trim();
    const wordsPerPage = meaningfulText.split(/\s+/).length / totalPages;
    
    // If we have less than 10 words per page on average, it's likely a scanned PDF
    if (wordsPerPage < 10) {
      console.log(`[PDF Extractor] Low text density detected (${wordsPerPage.toFixed(1)} words/page), may need OCR`);
      // Note: OCR not implemented yet, returning what we have
    }
    
    // Clean up
    await pdf.destroy();
    
    return {
      text: fullText,
      pageCount: totalPages,
      method: 'direct',
      pages,
      metadata: undefined,
    };
  } catch (error) {
    console.error('[PDF Extractor] Extraction failed:', error);
    throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : String(error)}`);
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

// Check if pdftotext is available (cached result)
let pdftoTextAvailable: boolean | null = null;
async function checkPdftotext(): Promise<boolean> {
  if (pdftoTextAvailable !== null) return pdftoTextAvailable;
  try {
    await execAsync('which pdftotext');
    pdftoTextAvailable = true;
    console.log('[PDF Extractor] pdftotext is available');
  } catch {
    pdftoTextAvailable = false;
    console.log('[PDF Extractor] pdftotext is NOT available, will use unpdf');
  }
  return pdftoTextAvailable;
}

/**
 * Extract text from PDF file path with streaming and progress logging
 */
export async function extractTextFromPdfFile(filePath: string): Promise<PdfExtractionResult> {
  const stats = await fs.stat(filePath);
  const sizeMB = stats.size / (1024 * 1024);
  const fileSizeMB = sizeMB.toFixed(2);
  
  console.log(`[PDF Extractor] Reading PDF file: ${path.basename(filePath)} (${fileSizeMB} MB)`);
  const startTime = Date.now();
  
  // For large files (>20MB), try pdftotext first if available (faster native tool)
  if (sizeMB > 20) {
    const hasPdftotext = await checkPdftotext();
    
    if (hasPdftotext) {
      try {
        console.log(`[PDF Extractor] Using pdftotext for large file (${fileSizeMB} MB)`);
        console.log(`[PDF Extractor] Starting pdftotext at ${new Date().toISOString()}`);
        
        // Extract text using pdftotext with 5 minute timeout
        const PDFTOTEXT_TIMEOUT = 5 * 60 * 1000; // 5 minutes
        const { stdout } = await execAsync(`pdftotext "${filePath}" -`, { 
          maxBuffer: 100 * 1024 * 1024,
          timeout: PDFTOTEXT_TIMEOUT 
        });
        const extractionTime = (Date.now() - startTime) / 1000;
        
        console.log(`[PDF Extractor] pdftotext completed at ${new Date().toISOString()}`);
        console.log(`[PDF Extractor] pdftotext extraction completed in ${extractionTime.toFixed(2)}s`);
        console.log(`[PDF Extractor] Extracted ${(stdout.length / 1024).toFixed(2)} KB of text`);
        
        // Get page count
        const { stdout: pageCountStr } = await execAsync(`pdfinfo "${filePath}" | grep Pages | awk '{print $2}'`);
        const pageCount = parseInt(pageCountStr.trim()) || 1;
        
        // Split into pages (rough approximation)
        const avgCharsPerPage = stdout.length / pageCount;
        const pages: Array<{ pageNumber: number; text: string; wordCount: number }> = [];
        
        for (let i = 0; i < pageCount; i++) {
          const start = Math.floor(i * avgCharsPerPage);
          const end = Math.floor((i + 1) * avgCharsPerPage);
          const pageText = stdout.slice(start, end);
          pages.push({
            pageNumber: i + 1,
            text: pageText,
            wordCount: pageText.split(/\s+/).filter(w => w.length > 0).length,
          });
        }
        
        return {
          text: stdout,
          pageCount,
          method: 'direct',
          pages,
        };
      } catch (error: any) {
        console.error(`[PDF Extractor] pdftotext failed:`, error?.message || error);
        console.log(`[PDF Extractor] Falling back to chunked unpdf extraction`);
        // Fall through to chunked unpdf below
      }
    } else {
      console.log(`[PDF Extractor] pdftotext not available, using chunked unpdf for ${fileSizeMB} MB file`);
    }
  }
  
  // Use unpdf for all files (with chunked processing for large files)
  console.log(`[PDF Extractor] Using unpdf for file extraction`);
  const pdfBuffer = await fs.readFile(filePath);
  const readTime = Date.now() - startTime;
  console.log(`[PDF Extractor] File read completed in ${(readTime / 1000).toFixed(2)}s`);
  
  const result = await extractTextFromPdf(pdfBuffer);
  const totalTime = Date.now() - startTime;
  console.log(`[PDF Extractor] Total extraction time: ${(totalTime / 1000).toFixed(2)}s for ${fileSizeMB} MB (${(stats.size / totalTime * 1000 / 1024 / 1024).toFixed(2)} MB/s)`);
  
  return result;
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
