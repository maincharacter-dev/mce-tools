import { invokeLLM } from "./_core/llm";
import { saveProcessingLog } from "./document-service";

interface ExtractedFact {
  key: string;
  value: string;
  category: "Technology" | "Assumption" | "Parameter" | "Dependency" | "Risk" | "Other";
  confidence: number;
  extractionMethod: "Deterministic_Regex" | "Ollama_LLM";
  sourceLocation?: string;
}

/**
 * Deterministic extraction patterns for common renewable energy project facts
 */
const DETERMINISTIC_PATTERNS = {
  // Capacity patterns (e.g., "100 MW", "50.5 kW")
  capacity: /(\d+(?:\.\d+)?)\s*(MW|kW|GW|W)\b/gi,

  // Date patterns (e.g., "2024-01-15", "January 15, 2024")
  dates: /(\d{4}-\d{2}-\d{2})|(\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b)/gi,

  // Document numbers (e.g., "IM-2024-001", "DD-PACK-001")
  documentNumbers: /\b([A-Z]{2,}-\d{4}-\d{3,}|[A-Z]{2,}-[A-Z]{2,}-\d{3,})\b/gi,

  // Technology types (Solar, Wind, BESS, etc.)
  technology: /\b(photovoltaic|solar|wind|battery|BESS|energy storage|hybrid|grid-scale)\b/gi,

  // Voltage levels
  voltage: /(\d+(?:\.\d+)?)\s*(kV|MV|LV|V)\b/gi,

  // Efficiency percentages
  efficiency: /efficiency[:\s]+(\d+(?:\.\d+)?)\s*%/gi,

  // Coordinates/Location
  coordinates: /(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/g,

  // Email addresses
  emails: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,

  // Phone numbers
  phones: /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,

  // Company names (basic pattern)
  companies: /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Pty|Ltd|Inc|Corp|Corporation|Company)\b/g,

  // Risk keywords
  riskKeywords: /\b(risk|constraint|challenge|issue|concern|limitation|barrier|obstacle|threat|vulnerability)\b/gi,

  // Assumption keywords
  assumptionKeywords: /\b(assume|assumption|assumed|presume|presupposed|taken as|given that)\b/gi,
};

/**
 * Extracts facts using deterministic patterns
 */
export function extractDeterministicFacts(text: string, sourceLocation?: string): ExtractedFact[] {
  const facts: ExtractedFact[] = [];

  // Capacity extraction
  const capacityMatches = Array.from(text.matchAll(DETERMINISTIC_PATTERNS.capacity));
  for (const match of capacityMatches) {
    facts.push({
      key: "capacity",
      value: `${match[1]} ${match[2]}`,
      category: "Parameter",
      confidence: 0.95,
      extractionMethod: "Deterministic_Regex",
      sourceLocation,
    });
  }

  // Date extraction
  const dateMatches = Array.from(text.matchAll(DETERMINISTIC_PATTERNS.dates));
  for (const match of dateMatches) {
    facts.push({
      key: "date_reference",
      value: match[0],
      category: "Parameter",
      confidence: 0.9,
      extractionMethod: "Deterministic_Regex",
      sourceLocation,
    });
  }

  // Document number extraction
  const docMatches = Array.from(text.matchAll(DETERMINISTIC_PATTERNS.documentNumbers));
  for (const match of docMatches) {
    facts.push({
      key: "document_number",
      value: match[0],
      category: "Parameter",
      confidence: 0.98,
      extractionMethod: "Deterministic_Regex",
      sourceLocation,
    });
  }

  // Technology extraction
  const techMatches = Array.from(text.matchAll(DETERMINISTIC_PATTERNS.technology));
  for (const match of techMatches) {
    facts.push({
      key: "technology_type",
      value: match[0].toLowerCase(),
      category: "Technology",
      confidence: 0.85,
      extractionMethod: "Deterministic_Regex",
      sourceLocation,
    });
  }

  // Voltage extraction
  const voltageMatches = Array.from(text.matchAll(DETERMINISTIC_PATTERNS.voltage));
  for (const match of voltageMatches) {
    facts.push({
      key: "voltage_level",
      value: `${match[1]} ${match[2]}`,
      category: "Parameter",
      confidence: 0.92,
      extractionMethod: "Deterministic_Regex",
      sourceLocation,
    });
  }

  // Email extraction
  const emailMatches = Array.from(text.matchAll(DETERMINISTIC_PATTERNS.emails));
  for (const match of emailMatches) {
    facts.push({
      key: "contact_email",
      value: match[0],
      category: "Parameter",
      confidence: 0.98,
      extractionMethod: "Deterministic_Regex",
      sourceLocation,
    });
  }

  // Risk keywords
  const riskMatches = Array.from(text.matchAll(DETERMINISTIC_PATTERNS.riskKeywords));
  for (const match of riskMatches.slice(0, 5)) {
    // Limit to 5 to avoid duplication
    facts.push({
      key: "risk_indicator",
      value: match[0],
      category: "Risk",
      confidence: 0.7,
      extractionMethod: "Deterministic_Regex",
      sourceLocation,
    });
  }

  return facts;
}

/**
 * Extracts facts using Ollama LLM
 */
export async function extractLLMFacts(
  text: string,
  projectId: string,
  documentId: string,
  sourceLocation?: string
): Promise<ExtractedFact[]> {
  try {
    await saveProcessingLog(projectId, documentId, "LLM_Extraction", "Started", "Starting LLM extraction");

    const prompt = `You are an expert in renewable energy project analysis. Extract structured facts from the following document excerpt.

Return a JSON array of facts with this structure:
[
  {
    "key": "fact_key",
    "value": "fact_value",
    "category": "Technology|Assumption|Parameter|Dependency|Risk|Other",
    "confidence": 0.85
  }
]

Focus on:
1. Technology choices and specifications
2. Key assumptions about the project
3. Important parameters (capacity, voltage, efficiency)
4. Dependencies on external factors
5. Identified risks or constraints

Document excerpt:
${text.substring(0, 2000)}

Return ONLY the JSON array, no other text.`;

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are a renewable energy project analyst. Extract facts from documents in JSON format.",
        },
        {
          role: "user",
          content: prompt,
        },
      ] as any,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "facts_extraction",
          strict: true,
          schema: {
            type: "object",
            properties: {
              facts: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    key: { type: "string" },
                    value: { type: "string" },
                    category: {
                      type: "string",
                      enum: ["Technology", "Assumption", "Parameter", "Dependency", "Risk", "Other"],
                    },
                    confidence: { type: "number" },
                  },
                  required: ["key", "value", "category", "confidence"],
                },
              },
            },
            required: ["facts"],
          },
        },
      },
    });

    const contentValue = response.choices[0]?.message.content;
    if (!contentValue) {
      throw new Error("No response from LLM");
    }

    const content = typeof contentValue === "string" ? contentValue : JSON.stringify(contentValue);
    const parsed = JSON.parse(content);
    const factsArray = parsed.facts || (Array.isArray(parsed) ? parsed : []);
    const facts: ExtractedFact[] = factsArray.map((fact: any) => ({
      ...fact,
      extractionMethod: "Ollama_LLM" as const,
      sourceLocation,
    }));

    await saveProcessingLog(
      projectId,
      documentId,
      "LLM_Extraction",
      "Completed",
      `Extracted ${facts.length} facts`
    );

    return facts;
  } catch (error) {
    console.error("[DocumentProcessor] LLM extraction failed:", error);
    await saveProcessingLog(projectId, documentId, "LLM_Extraction", "Failed", String(error));
    return [];
  }
}

/**
 * Consolidates and deduplicates facts from multiple extraction methods
 */
export function consolidateFacts(facts: ExtractedFact[]): ExtractedFact[] {
  const consolidated = new Map<string, ExtractedFact>();

  for (const fact of facts) {
    const key = `${fact.key}:${fact.value.toLowerCase()}`;
    const existing = consolidated.get(key);

    if (!existing) {
      consolidated.set(key, fact);
    } else {
      // Keep the fact with higher confidence
      if (fact.confidence > existing.confidence) {
        consolidated.set(key, fact);
      }
    }
  }

  return Array.from(consolidated.values());
}

/**
 * Processes a document: text extraction, deterministic extraction, and LLM extraction
 */
export async function processDocument(
  projectId: number,
  documentId: string,
  extractedText: string,
  sourceLocation?: string
): Promise<ExtractedFact[]> {
  const projectIdStr = String(projectId);
  try {
    // Step 1: Deterministic extraction
    await saveProcessingLog(projectIdStr, documentId, "Deterministic_Extraction", "Started", "Starting deterministic extraction");
    const deterministicFacts = extractDeterministicFacts(extractedText, sourceLocation);
    await saveProcessingLog(
      projectIdStr,
      documentId,
      "Deterministic_Extraction",
      "Completed",
      `Extracted ${deterministicFacts.length} facts`
    );

    // Step 2: LLM extraction
    const llmFacts = await extractLLMFacts(projectIdStr, documentId, extractedText, sourceLocation);

    // Step 3: Consolidation
    await saveProcessingLog(projectIdStr, documentId, "Consolidation", "Started", "Consolidating facts");
    const allFacts = [...deterministicFacts, ...llmFacts];
    const consolidatedFacts = consolidateFacts(allFacts);
    await saveProcessingLog(
      projectIdStr,
      documentId,
      "Consolidation",
      "Completed",
      `Consolidated to ${consolidatedFacts.length} unique facts`
    );

    return consolidatedFacts;
  } catch (error) {
    console.error("[DocumentProcessor] Processing failed:", error);
    await saveProcessingLog(projectIdStr, documentId, "Complete", "Failed", String(error));
    throw error;
  }
}
