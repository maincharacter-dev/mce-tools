# Insight Reconciliation System Design

## Overview
When processing multiple documents for a project, insights need to be reconciled rather than duplicated. The system should merge similar insights, increase confidence when information agrees, and flag conflicts when information disagrees.

## Database Schema Changes

### extracted_facts table updates
```sql
ALTER TABLE extracted_facts 
  ADD COLUMN source_documents JSON COMMENT 'Array of document IDs that contributed to this insight',
  ADD COLUMN enrichment_count INT DEFAULT 1 COMMENT 'Number of documents that enriched this insight',
  ADD COLUMN conflict_with VARCHAR(36) NULL COMMENT 'ID of conflicting insight if any',
  ADD COLUMN merged_from JSON COMMENT 'Array of insight IDs that were merged into this one',
  ADD COLUMN last_enriched_at TIMESTAMP NULL COMMENT 'Last time this insight was enriched';
```

### New conflicts table
```sql
CREATE TABLE insight_conflicts (
  id VARCHAR(36) PRIMARY KEY,
  project_id INT NOT NULL,
  insight_a_id VARCHAR(36) NOT NULL,
  insight_b_id VARCHAR(36) NOT NULL,
  conflict_type ENUM('value_mismatch', 'date_mismatch', 'numerical_mismatch') NOT NULL,
  resolution_status ENUM('pending', 'resolved', 'ignored') DEFAULT 'pending',
  resolved_by INT NULL,
  resolved_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (insight_a_id) REFERENCES extracted_facts(id),
  FOREIGN KEY (insight_b_id) REFERENCES extracted_facts(id)
);
```

## Reconciliation Algorithm

### Step 1: Extract insights from new document
- Run existing extraction pipeline (deterministic + LLM)
- Get list of candidate insights

### Step 2: For each candidate insight, find existing matches
```
FOR each candidate_insight:
  existing_insights = query_by_normalized_key(candidate.key)
  
  IF no existing_insights:
    INSERT candidate as new insight
    CONTINUE
  
  FOR each existing_insight:
    similarity = compute_semantic_similarity(candidate.value, existing.value)
    
    IF similarity > 0.95:  // Exact match
      UPDATE existing confidence = weighted_average(existing.confidence, candidate.confidence)
      ADD candidate.source_document to existing.source_documents
      INCREMENT existing.enrichment_count
      SET existing.last_enriched_at = NOW()
      SKIP candidate (don't insert)
      
    ELSE IF similarity > 0.70:  // Similar, can merge
      MERGE candidate.value INTO existing.value (append additional details)
      UPDATE existing confidence = weighted_average(existing.confidence, candidate.confidence)
      ADD candidate.source_document to existing.source_documents
      INCREMENT existing.enrichment_count
      SET existing.last_enriched_at = NOW()
      SKIP candidate (don't insert)
      
    ELSE:  // Conflicting information
      INSERT candidate as new insight
      CREATE conflict record linking existing and candidate
      SET both insights.conflict_with = each other's ID
```

### Step 3: Regenerate section narratives
- After reconciliation, regenerate narratives for affected sections
- Narratives should reflect the enriched, higher-confidence insights

## Semantic Similarity Computation

Use LLM to compare insight values:

```typescript
async function computeSemanticSimilarity(value1: string, value2: string): Promise<number> {
  const response = await invokeLLM({
    messages: [
      {
        role: 'system',
        content: 'You are a semantic similarity analyzer. Compare two statements and return a similarity score from 0 to 100.'
      },
      {
        role: 'user',
        content: `Statement 1: ${value1}\nStatement 2: ${value2}\n\nReturn only a number from 0-100 indicating how similar these statements are in meaning.`
      }
    ]
  });
  
  const score = parseInt(response.choices[0].message.content);
  return score / 100;  // Normalize to 0-1
}
```

## Confidence Score Updates

### Weighted Average Formula
```
new_confidence = (existing_confidence * existing_enrichment_count + candidate_confidence) / (existing_enrichment_count + 1)
```

### Confidence Boosting Rules
- If deterministic AND LLM extraction agree: boost by 10%
- If multiple documents agree (enrichment_count > 2): boost by 5% per additional document (max +20%)
- If conflict detected: reduce by 15%

## Insight Merging Strategy

### For narrative insights (Project Overview, Financial Structure, Technical Design):
- Append new details that aren't already present
- Use LLM to merge values into coherent statement

```typescript
async function mergeInsightValues(existing: string, candidate: string): Promise<string> {
  const response = await invokeLLM({
    messages: [
      {
        role: 'system',
        content: 'You are a technical writer. Merge two similar statements into one comprehensive statement that includes all unique information from both.'
      },
      {
        role: 'user',
        content: `Existing: ${existing}\nNew: ${candidate}\n\nMerge these into one statement.`
      }
    ]
  });
  
  return response.choices[0].message.content;
}
```

### For factual insights (dates, numbers, names):
- Don't merge - flag as conflict if values differ
- Only update confidence if values match exactly

## UI Changes

### Insights Page
- Show source document badges on each insight card
- Add "Enriched 3x" indicator for insights with enrichment_count > 1
- Add conflict warning icon for insights with conflicts
- Add "View History" button to show insight evolution timeline

### New "Conflicts" Section
- Show all pending conflicts
- Side-by-side comparison of conflicting values
- Show source documents for each version
- Allow user to resolve: "Accept A", "Accept B", "Accept Both", "Ignore"

### Insight Detail Modal
- Show all source documents that contributed
- Show enrichment history (what was added when)
- Show confidence score evolution
- Show merge history if applicable

## Implementation Plan

1. Update database schema (ALTER TABLE + CREATE TABLE)
2. Implement semantic similarity function
3. Implement reconciliation logic in document processor
4. Update UI to show enrichment indicators
5. Build conflicts UI
6. Test with multiple documents

## Performance Considerations

- Semantic similarity computation is expensive (LLM call per comparison)
- Batch similarity checks where possible
- Cache similarity scores for frequently compared values
- Consider using embedding-based similarity as faster alternative to LLM calls
