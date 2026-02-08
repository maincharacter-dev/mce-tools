import { invokeLLM } from "./_core/llm";

export interface ExtractedFact {
  category: string;
  key: string;
  value: string;
  confidence: number;
  source_page?: number;
  extraction_method: "llm_structured" | "llm_relationship" | "llm_risk" | "llm_assumption";
}

export interface ExtractionResult {
  facts: ExtractedFact[];
  total_facts: number;
  extraction_time_ms: number;
}

/**
 * Intelligent multi-pass fact extraction using LLM with structured output
 */
export class IntelligentFactExtractor {
  
  /**
   * Extract all facts from document text using multi-pass strategy
   */
  async extractFacts(
    documentText: string,
    documentType: string,
    fileName: string
  ): Promise<ExtractionResult> {
    const startTime = Date.now();
    const allFacts: ExtractedFact[] = [];

    console.log(`[Intelligent Extractor] Starting multi-pass extraction for ${fileName} (type: ${documentType})`);

    // Pass 1: Structured data extraction
    const structuredFacts = await this.extractStructuredData(documentText, documentType);
    allFacts.push(...structuredFacts);
    console.log(`[Intelligent Extractor] Pass 1 (Structured): ${structuredFacts.length} facts`);

    // Pass 2: Relationship extraction
    const relationshipFacts = await this.extractRelationships(documentText, documentType);
    allFacts.push(...relationshipFacts);
    console.log(`[Intelligent Extractor] Pass 2 (Relationships): ${relationshipFacts.length} facts`);

    // Pass 3: Risk identification
    const riskFacts = await this.extractRisks(documentText, documentType);
    allFacts.push(...riskFacts);
    console.log(`[Intelligent Extractor] Pass 3 (Risks): ${riskFacts.length} facts`);

    // Pass 4: Assumption extraction
    const assumptionFacts = await this.extractAssumptions(documentText, documentType);
    allFacts.push(...assumptionFacts);
    console.log(`[Intelligent Extractor] Pass 4 (Assumptions): ${assumptionFacts.length} facts`);

    const extractionTime = Date.now() - startTime;
    console.log(`[Intelligent Extractor] Total: ${allFacts.length} facts in ${extractionTime}ms`);

    return {
      facts: allFacts,
      total_facts: allFacts.length,
      extraction_time_ms: extractionTime
    };
  }

  /**
   * Pass 1: Extract structured key-value facts
   */
  private async extractStructuredData(text: string, docType: string): Promise<ExtractedFact[]> {
    const prompt = this.buildStructuredExtractionPrompt(text, docType);
    
    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are an expert at extracting structured facts from renewable energy project documents. Extract facts as JSON with category, key, value, and confidence (0-1)."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "fact_extraction",
            strict: true,
            schema: {
              type: "object",
              properties: {
                facts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      category: {
                        type: "string",
                        description: "Fact category: Project_Identity, Technical_Specifications, Grid_Connection, Site_Characteristics, Timeline, Energy_Performance, Regulatory, Financial"
                      },
                      key: {
                        type: "string",
                        description: "Short descriptive key for the fact"
                      },
                      value: {
                        type: "string",
                        description: "The extracted value"
                      },
                      confidence: {
                        type: "number",
                        description: "Confidence score 0-1"
                      }
                    },
                    required: ["category", "key", "value", "confidence"],
                    additionalProperties: false
                  }
                }
              },
              required: ["facts"],
              additionalProperties: false
            }
          }
        }
      });

      const content = response.choices[0].message.content;
      if (!content || typeof content !== 'string') return [];

      const parsed = JSON.parse(content);
      return parsed.facts.map((f: any) => ({
        ...f,
        extraction_method: "llm_structured" as const
      }));
    } catch (error) {
      console.error("[Intelligent Extractor] Structured extraction failed:", error);
      return [];
    }
  }

  /**
   * Pass 2: Extract relationships and dependencies
   */
  private async extractRelationships(text: string, docType: string): Promise<ExtractedFact[]> {
    const prompt = `Extract relationships, dependencies, and constraints from this renewable energy project document.

Focus on:
- Dependencies between milestones (e.g., "X must match Y", "A depends on B")
- Constraints (e.g., "limited to", "must not exceed", "requires")
- Conditional statements (e.g., "if X then Y")
- Requirements (e.g., "needs", "requires", "must have")

Document excerpt:
${text.substring(0, 8000)}

Return JSON with facts array containing category="Dependencies", key (short description), value (the relationship), confidence (0-1).`;

    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are an expert at identifying dependencies and relationships in project documents."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "relationship_extraction",
            strict: true,
            schema: {
              type: "object",
              properties: {
                facts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      category: { type: "string" },
                      key: { type: "string" },
                      value: { type: "string" },
                      confidence: { type: "number" }
                    },
                    required: ["category", "key", "value", "confidence"],
                    additionalProperties: false
                  }
                }
              },
              required: ["facts"],
              additionalProperties: false
            }
          }
        }
      });

      const content = response.choices[0].message.content;
      if (!content || typeof content !== 'string') return [];

      const parsed = JSON.parse(content);
      return parsed.facts.map((f: any) => ({
        ...f,
        extraction_method: "llm_relationship" as const
      }));
    } catch (error) {
      console.error("[Intelligent Extractor] Relationship extraction failed:", error);
      return [];
    }
  }

  /**
   * Pass 3: Extract risks and red flags
   */
  private async extractRisks(text: string, docType: string): Promise<ExtractedFact[]> {
    const prompt = `Identify risks, challenges, and potential red flags in this renewable energy project document.

Focus on:
- Technical risks (site issues, grid limitations, equipment challenges)
- Schedule risks (delays, dependencies, critical path items)
- Cost risks (budget concerns, escalation, contingencies)
- Regulatory risks (permits, approvals, compliance)
- Environmental/social risks (ESIA issues, community concerns)
- Design changes or site relocations

Document excerpt:
${text.substring(0, 8000)}

Return JSON with facts array containing category="Risks", key (risk type), value (description), confidence (0-1).`;

    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are an expert at identifying risks in renewable energy projects."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "risk_extraction",
            strict: true,
            schema: {
              type: "object",
              properties: {
                facts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      category: { type: "string" },
                      key: { type: "string" },
                      value: { type: "string" },
                      confidence: { type: "number" }
                    },
                    required: ["category", "key", "value", "confidence"],
                    additionalProperties: false
                  }
                }
              },
              required: ["facts"],
              additionalProperties: false
            }
          }
        }
      });

      const content = response.choices[0].message.content;
      if (!content || typeof content !== 'string') return [];

      const parsed = JSON.parse(content);
      return parsed.facts.map((f: any) => ({
        ...f,
        extraction_method: "llm_risk" as const
      }));
    } catch (error) {
      console.error("[Intelligent Extractor] Risk extraction failed:", error);
      return [];
    }
  }

  /**
   * Pass 4: Extract assumptions and design parameters
   */
  private async extractAssumptions(text: string, docType: string): Promise<ExtractedFact[]> {
    const prompt = `Extract design assumptions, parameters, and engineering choices from this renewable energy project document.

Focus on:
- Design parameters (ground coverage ratio, capacity factor, efficiency)
- Technology choices (module type, tracking, inverters)
- Engineering assumptions (losses, degradation, availability)
- Performance estimates (generation, yield, PR)
- Design standards or codes referenced

Document excerpt:
${text.substring(0, 8000)}

Return JSON with facts array containing category="Assumptions", key (parameter name), value (assumption), confidence (0-1).`;

    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are an expert at identifying design assumptions in engineering documents."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "assumption_extraction",
            strict: true,
            schema: {
              type: "object",
              properties: {
                facts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      category: { type: "string" },
                      key: { type: "string" },
                      value: { type: "string" },
                      confidence: { type: "number" }
                    },
                    required: ["category", "key", "value", "confidence"],
                    additionalProperties: false
                  }
                }
              },
              required: ["facts"],
              additionalProperties: false
            }
          }
        }
      });

      const content = response.choices[0].message.content;
      if (!content || typeof content !== 'string') return [];

      const parsed = JSON.parse(content);
      return parsed.facts.map((f: any) => ({
        ...f,
        extraction_method: "llm_assumption" as const
      }));
    } catch (error) {
      console.error("[Intelligent Extractor] Assumption extraction failed:", error);
      return [];
    }
  }

  /**
   * Build document-type-specific prompt for structured extraction
   */
  private buildStructuredExtractionPrompt(text: string, docType: string): string {
    const basePrompt = `Extract all key facts from this renewable energy project document.

Document Type: ${docType}

Extract facts in these categories:
1. Project_Identity: Project name, partners, ownership structure, document date, location
2. Technical_Specifications: Capacity (DC/AC), technology, modules, tracking, inverters, transformers, area
3. Grid_Connection: Voltage levels, connection method, grid operator, substation, distances
4. Site_Characteristics: Location, area, topography, access roads, environmental features
5. Timeline: FID, COD, construction start, study deliverables, milestones
6. Energy_Performance: Annual generation, capacity factor, losses, degradation
7. Regulatory: Permits, approvals, studies required (ESIA, geotech, etc.)
8. Financial: CAPEX, OPEX, ownership percentages, funding

Document excerpt (first 8000 chars):
${text.substring(0, 8000)}

Extract as many facts as possible with high confidence. Be specific and include units.`;

    return basePrompt;
  }
}

/**
 * Export singleton instance
 */
export const intelligentFactExtractor = new IntelligentFactExtractor();
