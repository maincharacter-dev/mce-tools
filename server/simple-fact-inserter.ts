/**
 * Simple Fact Inserter - Phase 1 Processing
 * 
 * Inserts extracted facts as-is without reconciliation, narrative generation,
 * or specialized extraction. Fast upload processing.
 */

import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';

interface ExtractedFact {
  category: string;
  key: string;
  value: string;
  confidence: number;
  source: string;
  extractionMethod: string;
}

/**
 * Insert facts directly without reconciliation
 */
export async function insertRawFacts(
  projectDb: mysql.Pool,
  projectId: number,
  documentId: string,
  facts: ExtractedFact[]
): Promise<number> {
  const { normalizeSection: normalizeSectionKey } = await import('../shared/section-normalizer');
  
  let insertedCount = 0;
  
  for (const fact of facts) {
    const normalizedKey = normalizeSectionKey(fact.key);
    const insightId = uuidv4();
    const sourceDocsJson = JSON.stringify([documentId]).replace(/'/g, "''");
    const escapedValue = fact.value.replace(/'/g, "''");
    
    await projectDb.execute(
      `INSERT INTO extracted_facts (id, source_document_id, source_documents, project_id, category, \`key\`, value, confidence, extraction_method, verification_status, enrichment_count, created_at) 
       VALUES ('${insightId}', '${documentId}', '${sourceDocsJson}', ${projectId}, '${fact.category}', '${normalizedKey}', '${escapedValue}', '${fact.confidence}', '${fact.extractionMethod}', 'pending', 1, NOW())`
    );
    insertedCount++;
  }
  
  return insertedCount;
}
