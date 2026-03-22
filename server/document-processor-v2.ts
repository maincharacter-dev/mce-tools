/**
 * Document Processing Service V2
 * 
 * Integrates text extraction and Ollama-based fact extraction
 * into a unified processing pipeline
 */

import { extractTextFromDocument } from './document-extractor';
import { extractFactsWithOllama } from './ollama';
import { IntelligentFactExtractorV2 } from './intelligent-fact-extractor-v2';
import mysql from 'mysql2/promise';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
// storage.ts (Forge API) no longer used — all storage is local filesystem
import { createDocumentLogger } from './processing-logger';

export interface ProcessedDocument {
  documentId: string;
  extractedText: string;
  extractionMethod: string;
  wordCount: number;
  facts: ExtractedFact[];
  processingTime: number;
  status: 'completed' | 'failed' | 'partial';
  error?: string;
}

export interface ExtractedFact {
  category: 'specification' | 'financial' | 'technical' | 'planning' | 'risk' | 'other';
  key: string;
  value: string;
  confidence: number;
  source: string;
  extractionMethod: 'deterministic' | 'llm';
}

/**
 * Process a document: extract text, then extract facts
 */
export interface ProgressCallback {
  (stage: string, progress: number): Promise<void>;
}

export async function processDocument(
  projectId: number,
  documentId: string,
  filePath: string,
  documentType: string,
  ollamaModel: string = 'llama3.2:latest',
  projectDbConnection?: mysql.Connection,
  onProgress?: ProgressCallback
): Promise<ProcessedDocument> {
  const startTime = Date.now();
  
  console.log(`[Document Processor] Processing document ${documentId} for project ${projectId}`);
  
  // Create logger for this document
  const logger = createDocumentLogger(projectId, documentId);
  
  let tempFile: string | null = null;
  let localFilePath = filePath;
  
  try {
    // Check if filePath contains chunked metadata (JSON string)
    // Handle both with and without spaces in JSON: "type":"chunked" or "type": "chunked"
    if (filePath.startsWith('{') && (filePath.includes('"type":"chunked"') || filePath.includes('"type": "chunked"'))) {
      console.log(`[Document Processor] Detected chunked file metadata, reading from local storage...`);
      
      const metadata = JSON.parse(filePath);
      const { uploadId, totalChunks, filename, fileSize } = metadata;
      const fileSizeMB = fileSize ? (fileSize / 1024 / 1024).toFixed(2) : 'unknown';
      
      await logger.start('Upload', `Reading ${totalChunks} chunks (${fileSizeMB} MB) from local storage`);
      
      // Create temp file for reassembled content
      tempFile = path.join(os.tmpdir(), `${documentId}-${filename}`);
      console.log(`[Document Processor] Reassembling ${totalChunks} chunks to ${tempFile}`);
      
      const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
      const uploadDir = path.join(dataDir, 'temp-uploads', uploadId);
      
      // Reassemble chunks from local filesystem
      const chunks: Buffer[] = [];
      for (let i = 0; i < totalChunks; i++) {
        if (i % 5 === 0 || i === totalChunks - 1) {
          await logger.progress('Upload', `Reading chunk ${i + 1}/${totalChunks}`);
        }
        if (onProgress) {
          const progressPercent = Math.floor((i / totalChunks) * 10);
          await onProgress('reading_chunks', progressPercent);
        }
        try {
          const chunkPath = path.join(uploadDir, `chunk-${i}`);
          const chunkBuffer = await fs.readFile(chunkPath);
          chunks.push(chunkBuffer);
        } catch (chunkError) {
          console.error(`[Document Processor] ERROR reading chunk ${i + 1}/${totalChunks}:`, chunkError);
          throw chunkError;
        }
      }
      
      // Write reassembled file to temp
      const fullBuffer = Buffer.concat(chunks);
      await fs.writeFile(tempFile, fullBuffer);
      const reassembledSizeMB = (fullBuffer.length / 1024 / 1024).toFixed(2);
      console.log(`[Document Processor] Reassembled ${totalChunks} chunks into ${reassembledSizeMB} MB file`);
      await logger.complete('Upload', `Reassembled ${totalChunks} chunks into ${reassembledSizeMB} MB file`);
      
      localFilePath = tempFile;
    }
    
    // Step 1: Extract text from document
    console.log(`[Document Processor] ========================================`);
    console.log(`[Document Processor] Step 1: Extracting text from ${localFilePath}`);
    console.log(`[Document Processor] Document type: ${documentType}`);
    console.log(`[Document Processor] ========================================`);
    
    // Get file size to estimate extraction time
    const fileStats = await fs.stat(localFilePath);
    const fileSizeMB = (fileStats.size / 1024 / 1024).toFixed(2);
    
    await logger.start('Text_Extraction', `Starting text extraction (${documentType}) - ${fileSizeMB} MB file`);
    if (onProgress) await onProgress('text_extraction', 10);
    
    // For large files, add a progress update since extraction can take a while
    let progressInterval: NodeJS.Timeout | null = null;
    if (fileStats.size > 20 * 1024 * 1024) { // > 20MB
      let elapsed = 0;
      progressInterval = setInterval(async () => {
        elapsed += 10;
        await logger.progress('Text_Extraction', `Extracting text... ${elapsed}s elapsed (large file, please wait)`);
      }, 10000); // Update every 10 seconds
    }
    
    const extractionStart = Date.now();
    let textResult;
    try {
      textResult = await extractTextFromDocument(localFilePath);
    } finally {
      if (progressInterval) clearInterval(progressInterval);
    }
    const extractionTime = Date.now() - extractionStart;
    
    console.log(`[Document Processor] ========================================`);
    console.log(`[Document Processor] Text extraction completed in ${(extractionTime / 1000).toFixed(2)}s`);
    console.log(`[Document Processor] - Words: ${textResult.wordCount}`);
    console.log(`[Document Processor] - Method: ${textResult.extractionMethod}`);
    console.log(`[Document Processor] - Text size: ${(textResult.text.length / 1024).toFixed(2)} KB`);
    console.log(`[Document Processor] ========================================`);
    
    await logger.complete('Text_Extraction', `Extracted ${textResult.wordCount} words (${(textResult.text.length / 1024).toFixed(2)} KB) using ${textResult.extractionMethod} in ${(extractionTime / 1000).toFixed(2)}s`);
    if (onProgress) await onProgress('text_extraction', 30);
    
    // Step 2: Extract facts using deterministic patterns
    console.log(`[Document Processor] Step 2: Extracting facts with deterministic patterns`);
    await logger.start('Deterministic_Extraction', 'Running pattern-based extraction');
    if (onProgress) await onProgress('deterministic_extraction', 40);
    const deterministicFacts = extractDeterministicFacts(textResult.text, documentType);
    
    console.log(`[Document Processor] Deterministic extraction found ${deterministicFacts.length} facts`);
    await logger.complete('Deterministic_Extraction', `Found ${deterministicFacts.length} facts using regex patterns`);
    if (onProgress) await onProgress('deterministic_extraction', 50);
    
    // Step 3: Extract facts using Intelligent LLM Extractor V2 (contextual statements)
    console.log(`[Document Processor] Step 3: Extracting facts with Intelligent LLM Extractor V2`);
    await logger.start('LLM_Extraction', 'Starting AI-powered fact extraction (4 passes)');
    if (onProgress) await onProgress('llm_extraction', 60);
    let llmFacts: ExtractedFact[] = [];
    
    try {
      const intelligentExtractor = new IntelligentFactExtractorV2();
      const intelligentResult = await intelligentExtractor.extractFacts(
        textResult.text,
        documentType
      );
      
      llmFacts = intelligentResult.facts.map((fact: any) => ({
        category: fact.section || 'other',
        key: fact.section || 'Other',  // Use section as key for proper categorization
        value: fact.statement || fact.value,
        confidence: fact.confidence || 0.5,
        source: fact.extraction_method || '',
        extractionMethod: 'llm' as const,
      }));
      
      console.log(`[Document Processor] Intelligent LLM extraction V2 found ${llmFacts.length} facts in ${intelligentResult.extraction_time_ms}ms`);
      await logger.complete('LLM_Extraction', `Extracted ${llmFacts.length} facts using AI in ${(intelligentResult.extraction_time_ms / 1000).toFixed(2)}s`);
      if (onProgress) await onProgress('llm_extraction', 80);
    } catch (llmError) {
      console.error(`[Document Processor] Intelligent LLM extraction V2 failed:`, llmError);
      await logger.fail('LLM_Extraction', `AI extraction failed: ${llmError instanceof Error ? llmError.message : String(llmError)}`);
      // Continue with deterministic facts only
    }
    
    // Step 4: Combine and deduplicate facts
    const allFacts = [...deterministicFacts, ...llmFacts];
    const deduplicatedFacts = deduplicateFacts(allFacts);
    
    console.log(`[Document Processor] Total facts after deduplication: ${deduplicatedFacts.length}`);
    if (onProgress) await onProgress('saving_facts', 90);
    
    // Step 5: Store results in project database
    // Note: Database storage will be implemented when integrating with routers
    // For now, just return the processed results
    console.log(`[Document Processor] Skipping database storage (to be implemented in router integration)`);
    
    const processingTime = Date.now() - startTime;
    
    console.log(`[Document Processor] Processing completed in ${(processingTime / 1000).toFixed(2)}s`);
    await logger.complete('Complete', `Processing completed: ${deduplicatedFacts.length} facts extracted in ${(processingTime / 1000).toFixed(2)}s`);
    // Note: Do NOT mark as 100% here - additional processing happens in router callback
    
    return {
      documentId,
      extractedText: textResult.text,
      extractionMethod: textResult.extractionMethod,
      wordCount: textResult.wordCount,
      facts: deduplicatedFacts,
      processingTime,
      status: 'completed',
    };
  } catch (error) {
    console.error(`[Document Processor] Processing failed:`, error);
    await logger.fail('Complete', `Processing failed: ${error instanceof Error ? error.message : String(error)}`);
    
    const processingTime = Date.now() - startTime;
    
    return {
      documentId,
      extractedText: '',
      extractionMethod: 'failed',
      wordCount: 0,
      facts: [],
      processingTime,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    // Clean up temp file if it was created
    if (tempFile) {
      try {
        await fs.unlink(tempFile);
        console.log(`[Document Processor] Cleaned up temp file: ${tempFile}`);
      } catch (error) {
        console.error(`[Document Processor] Failed to clean up temp file:`, error);
      }
    }
  }
}

/**
 * Extract facts using deterministic patterns (regex, keywords)
 */
function extractDeterministicFacts(text: string, documentType: string): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  
  // Pattern 1: Capacity (MW, MWp, MWac, MWdc)
  const capacityPattern = /(\d+(?:\.\d+)?)\s*(MW|MWp|MWac|MWdc|kW|kWp)/gi;
  let match;
  while ((match = capacityPattern.exec(text)) !== null) {
    facts.push({
      category: 'specification',
      key: 'Technical_Design',  // Use section key for proper categorization
      value: `${match[1]} ${match[2]}`,
      confidence: 0.95,
      source: match[0],
      extractionMethod: 'deterministic',
    });
  }
  
  // Pattern 2: Dates (various formats)
  const datePattern = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/gi;
  const dateMatches = text.match(datePattern);
  if (dateMatches) {
    dateMatches.slice(0, 10).forEach((date) => { // Limit to first 10 dates
      facts.push({
        category: 'planning',
        key: 'Project_Timeline',  // Use section key for proper categorization
        value: date,
        confidence: 0.85,
        source: date,
        extractionMethod: 'deterministic',
      });
    });
  }
  
  // Pattern 3: Financial amounts ($, €, £)
  const financialPattern = /([€$£])\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(million|billion|M|B)?/gi;
  while ((match = financialPattern.exec(text)) !== null) {
    facts.push({
      category: 'financial',
      key: 'Financial_Structure',  // Use section key for proper categorization
      value: `${match[1]}${match[2]}${match[3] || ''}`,
      confidence: 0.9,
      source: match[0],
      extractionMethod: 'deterministic',
    });
  }
  
  // Pattern 4: Grid connection voltage
  const voltagePattern = /(\d+)\s*(kV|KV|kilovolt)/gi;
  while ((match = voltagePattern.exec(text)) !== null) {
    facts.push({
      category: 'technical',
      key: 'Grid_Infrastructure',  // Use section key for proper categorization
      value: `${match[1]} ${match[2]}`,
      confidence: 0.9,
      source: match[0],
      extractionMethod: 'deterministic',
    });
  }
  
  // Pattern 5: Technology type keywords
  const techKeywords = ['solar', 'wind', 'battery', 'BESS', 'photovoltaic', 'PV', 'onshore', 'offshore'];
  techKeywords.forEach((keyword) => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    if (regex.test(text)) {
      facts.push({
        category: 'specification',
        key: 'Technical_Design',  // Use section key for proper categorization
        value: keyword,
        confidence: 0.8,
        source: keyword,
        extractionMethod: 'deterministic',
      });
    }
  });
  
  return facts;
}

/**
 * Deduplicate facts based on key and value similarity
 */
function deduplicateFacts(facts: ExtractedFact[]): ExtractedFact[] {
  const seen = new Map<string, ExtractedFact>();
  
  for (const fact of facts) {
    const key = `${fact.category}:${fact.key}:${fact.value.toLowerCase()}`;
    
    if (!seen.has(key)) {
      seen.set(key, fact);
    } else {
      // If we've seen this fact before, keep the one with higher confidence
      const existing = seen.get(key)!;
      if (fact.confidence > existing.confidence) {
        seen.set(key, fact);
      }
    }
  }
  
  return Array.from(seen.values());
}
