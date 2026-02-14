import { invokeLLM } from "./_core/llm";
import mysql from "mysql2/promise";
import { v4 as uuidv4 } from "uuid";

interface Insight {
  id: string;
  key: string;
  value: string;
  confidence: string;
  source_document_id: string;
  source_documents?: string[];  // JSON array
  enrichment_count?: number;
  extraction_method: string;
}

interface ReconciliationResult {
  action: 'insert' | 'update' | 'conflict';
  existingInsightId?: string;
  mergedValue?: string;
  newConfidence?: number;
  conflictId?: string;
}

/**
 * Computes semantic similarity between two insight values using LLM
 * Returns a score from 0 to 1
 */
export async function computeSemanticSimilarity(value1: string, value2: string): Promise<number> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: 'You are a semantic similarity analyzer. Compare two statements and return ONLY a number from 0 to 100 indicating similarity. Return just the number, nothing else.'
        },
        {
          role: 'user',
          content: `Statement 1: ${value1}\n\nStatement 2: ${value2}\n\nSimilarity score (0-100):`
        }
      ]
    });
    
    const content = response.choices[0]?.message?.content;
    const scoreText = typeof content === 'string' ? content : '';
    const score = parseInt(scoreText.trim());
    
    if (isNaN(score)) {
      console.warn(`[Reconciler] Failed to parse similarity score: ${scoreText}`);
      return 0;
    }
    
    return Math.min(100, Math.max(0, score)) / 100;  // Normalize to 0-1
  } catch (error) {
    console.error(`[Reconciler] Error computing similarity:`, error);
    return 0;
  }
}

/**
 * Merges two similar insight values into one comprehensive statement
 */
export async function mergeInsightValues(existing: string, candidate: string): Promise<string> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: 'You are a technical writer. Merge two similar statements into one comprehensive statement that includes all unique information from both. Maintain factual accuracy and professional tone.'
        },
        {
          role: 'user',
          content: `Existing insight: ${existing}\n\nNew insight: ${candidate}\n\nMerge these into one comprehensive statement:`
        }
      ]
    });
    
    const content = response.choices[0]?.message?.content;
    return typeof content === 'string' ? content.trim() : existing;
  } catch (error) {
    console.error(`[Reconciler] Error merging values:`, error);
    return existing;  // Fallback to existing value
  }
}

/**
 * Calculates weighted average confidence score
 */
function calculateWeightedConfidence(
  existingConfidence: number,
  candidateConfidence: number,
  enrichmentCount: number
): number {
  const newConfidence = (existingConfidence * enrichmentCount + candidateConfidence) / (enrichmentCount + 1);
  return Math.min(100, Math.round(newConfidence));
}

/**
 * Parses confidence string to number (e.g., "95%" -> 95, "high" -> 80)
 */
function parseConfidence(confidence: string): number {
  if (confidence.endsWith('%')) {
    return parseInt(confidence);
  }
  
  const lowerConf = confidence.toLowerCase();
  if (lowerConf === 'high') return 85;
  if (lowerConf === 'medium') return 65;
  if (lowerConf === 'low') return 40;
  
  const parsed = parseInt(confidence);
  return isNaN(parsed) ? 50 : parsed;
}

/**
 * Reconciles a candidate insight with existing insights in the database
 * Returns the action to take and any necessary data
 */
export async function reconcileInsight(
  projectDb: mysql.Pool,
  projectId: number,
  candidate: Insight,
  normalizedKey: string
): Promise<ReconciliationResult> {
  try {
    // Find existing insights with the same normalized key
    const [existingRows] = await projectDb.execute(
      `SELECT * FROM extracted_facts WHERE \`key\` = '${normalizedKey}' AND deleted_at IS NULL`
    ) as any;
    
    if (!existingRows || existingRows.length === 0) {
      // No existing insights, insert as new
      return { action: 'insert' };
    }
    
    // Check each existing insight for similarity
    for (const existing of existingRows) {
      const similarity = await computeSemanticSimilarity(candidate.value, existing.value);
      
      console.log(`[Reconciler] Similarity between "${candidate.value.substring(0, 50)}..." and "${existing.value.substring(0, 50)}...": ${(similarity * 100).toFixed(1)}%`);
      
      if (similarity > 0.95) {
        // Exact match - update confidence and source documents
        const existingConf = parseConfidence(existing.confidence);
        const candidateConf = parseConfidence(candidate.confidence);
        const enrichmentCount = existing.enrichment_count || 1;
        const newConfidence = calculateWeightedConfidence(existingConf, candidateConf, enrichmentCount);
        
        return {
          action: 'update',
          existingInsightId: existing.id,
          newConfidence,
          mergedValue: existing.value  // Keep existing value for exact matches
        };
      } else if (similarity > 0.70) {
        // Similar - merge values
        const mergedValue = await mergeInsightValues(existing.value, candidate.value);
        const existingConf = parseConfidence(existing.confidence);
        const candidateConf = parseConfidence(candidate.confidence);
        const enrichmentCount = existing.enrichment_count || 1;
        const newConfidence = calculateWeightedConfidence(existingConf, candidateConf, enrichmentCount);
        
        return {
          action: 'update',
          existingInsightId: existing.id,
          newConfidence,
          mergedValue
        };
      } else {
        // Different values - potential conflict
        // For now, insert as new and create conflict record
        return {
          action: 'conflict',
          existingInsightId: existing.id
        };
      }
    }
    
    // No similar insights found, insert as new
    return { action: 'insert' };
  } catch (error) {
    console.error(`[Reconciler] Error reconciling insight:`, error);
    return { action: 'insert' };  // Fallback to insert
  }
}

/**
 * Creates a conflict record between two insights
 */
export async function createConflict(
  projectDb: mysql.Pool,
  projectId: number,
  insightAId: string,
  insightBId: string,
  conflictType: 'value_mismatch' | 'date_mismatch' | 'numerical_mismatch'
): Promise<string> {
  const conflictId = uuidv4();
  
  await projectDb.execute(
    `INSERT INTO insight_conflicts (id, project_id, insight_a_id, insight_b_id, conflict_type, resolution_status, created_at)
     VALUES ('${conflictId}', ${projectId}, '${insightAId}', '${insightBId}', '${conflictType}', 'pending', NOW())`
  );
  
  // Update both insights to reference the conflict
  await projectDb.execute(
    `UPDATE extracted_facts SET conflict_with = '${insightBId}' WHERE id = '${insightAId}'`
  );
  await projectDb.execute(
    `UPDATE extracted_facts SET conflict_with = '${insightAId}' WHERE id = '${insightBId}'`
  );
  
  console.log(`[Reconciler] Created conflict ${conflictId} between ${insightAId} and ${insightBId}`);
  
  return conflictId;
}

/**
 * Updates an existing insight with enriched information
 */
export async function enrichInsight(
  projectDb: mysql.Pool,
  insightId: string,
  newValue: string,
  newConfidence: number,
  sourceDocumentId: string
): Promise<void> {
  // Get existing source_documents
  const [rows] = await projectDb.execute(
    `SELECT source_documents, enrichment_count FROM extracted_facts WHERE id = '${insightId}'`
  ) as any;
  
  if (!rows || rows.length === 0) {
    throw new Error(`Insight ${insightId} not found`);
  }
  
  const existing = rows[0];
  let sourceDocs: string[] = [];
  
  try {
    sourceDocs = existing.source_documents ? JSON.parse(existing.source_documents) : [];
  } catch (e) {
    sourceDocs = [];
  }
  
  // Add new source document if not already present
  if (!sourceDocs.includes(sourceDocumentId)) {
    sourceDocs.push(sourceDocumentId);
  }
  
  const enrichmentCount = (existing.enrichment_count || 1) + 1;
  const sourceDocsJson = JSON.stringify(sourceDocs).replace(/'/g, "''");
  const escapedValue = newValue.replace(/'/g, "''");
  
  await projectDb.execute(
    `UPDATE extracted_facts 
     SET value = '${escapedValue}', 
         confidence = '${newConfidence}%', 
         source_documents = '${sourceDocsJson}',
         enrichment_count = ${enrichmentCount},
         last_enriched_at = NOW()
     WHERE id = '${insightId}'`
  );
  
  console.log(`[Reconciler] Enriched insight ${insightId} (enrichment_count: ${enrichmentCount})`);
}
