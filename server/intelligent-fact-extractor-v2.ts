import { invokeLLM } from "./_core/llm";

export interface ExtractedFact {
  section: string;
  statement: string;
  key: string;
  value: string;
  confidence: number;
  extraction_method: string;
}

export interface ExtractionResult {
  facts: ExtractedFact[];
  total_facts: number;
  extraction_time_ms: number;
}

/**
 * Intelligent multi-pass fact extractor that produces contextual statements
 * instead of disconnected key-value pairs.
 */
export class IntelligentFactExtractorV2 {
  
  /**
   * Main extraction method - runs 4 passes to extract comprehensive structured facts
   */
  async extractFacts(documentText: string, documentType: string): Promise<ExtractionResult> {
    const startTime = Date.now();
    const allFacts: ExtractedFact[] = [];

    console.log(`[Intelligent Extractor V2] Starting extraction for ${documentType}`);

    // Pass 1: Structured data extraction with full contextual statements
    const structuredFacts = await this.extractStructuredData(documentText, documentType);
    allFacts.push(...structuredFacts);
    console.log(`[Intelligent Extractor V2] Pass 1 (Structured): ${structuredFacts.length} facts`);

    // Pass 2: Relationship and dependency extraction
    const relationshipFacts = await this.extractRelationships(documentText, documentType);
    allFacts.push(...relationshipFacts);
    console.log(`[Intelligent Extractor V2] Pass 2 (Relationships): ${relationshipFacts.length} facts`);

    // Pass 3: Risk identification
    const riskFacts = await this.extractRisks(documentText, documentType);
    allFacts.push(...riskFacts);
    console.log(`[Intelligent Extractor V2] Pass 3 (Risks): ${riskFacts.length} facts`);

    // Pass 4: Assumption and design parameter extraction
    const assumptionFacts = await this.extractAssumptions(documentText, documentType);
    allFacts.push(...assumptionFacts);
    console.log(`[Intelligent Extractor V2] Pass 4 (Assumptions): ${assumptionFacts.length} facts`);

    const extractionTime = Date.now() - startTime;
    console.log(`[Intelligent Extractor V2] Total: ${allFacts.length} facts in ${extractionTime}ms`);

    return {
      facts: allFacts,
      total_facts: allFacts.length,
      extraction_time_ms: extractionTime
    };
  }

  /**
   * Pass 1: Extract structured data as complete contextual statements
   */
  private async extractStructuredData(text: string, docType: string): Promise<ExtractedFact[]> {
    const prompt = `Extract structured information from this ${docType} document and present each fact as a complete, contextual statement.

Document text:
${text.substring(0, 50000)}

Extract information in these sections:
- Project_Overview: project identity, partners, ownership structure, location
- Technical_Design: capacity, technology, equipment specifications, configuration
- Grid_Infrastructure: connection details, voltage levels, distances, grid operator
- Site_Details: area, topography, access, geographical context
- Project_Timeline: key milestones with dates and descriptions
- Financial_Structure: ownership percentages, investment, commercial terms
- Regulatory_Compliance: permits, approvals, required studies

IMPORTANT: Each fact must be a complete, self-contained statement that makes sense on its own.

GOOD examples:
- "Marsa Solar Project is a 300 MWp DC solar facility located in AlWusta governorate near Duqm"
- "OQAE holds 51% ownership stake while TotalEnergies holds 49%"
- "ESIA Scoping study completion is scheduled for 7 August 2025"
- "Solar plant will connect via 132kV LILO at Clare Substation with future 400kV line 4km away"

BAD examples (avoid these):
- "7 Aug 2025" (missing context)
- "51%" (what does this percentage represent?)
- "300 MW" (DC or AC? What is this capacity for?)

For each fact, provide:
- section: one of the sections above
- statement: complete contextual sentence
- key: short identifier for reference (e.g., "project_name", "ownership_oqae", "esia_scoping_date")
- value: the core extracted value (for filtering/sorting)
- confidence: 0.0-1.0
- extraction_method: "llm_structured_v2"

Return a JSON array of facts.`;
    
    return await this.callLLMExtraction(prompt, "llm_structured_v2");
  }

  /**
   * Pass 2: Extract relationships and dependencies
   */
  private async extractRelationships(text: string, docType: string): Promise<ExtractedFact[]> {
    const prompt = `Identify critical relationships and dependencies in this ${docType} document.

Document text:
${text.substring(0, 50000)}

Identify:
1. Critical dependencies (what depends on what)
2. Timing constraints (sequencing requirements)
3. Capacity/sizing relationships (how components are sized relative to requirements)
4. Operational relationships (how systems interact)

IMPORTANT: Express each relationship as a complete statement explaining the dependency.

GOOD examples:
- "Solar plant COD must align with LNG facility COD (January 2028) to ensure carbon neutrality commitment is met"
- "Solar plant capacity of 300 MWp is sized to generate 700 GWh annually required by LNG facility"
- "Full ESIA study depends on completion of ESIA Scoping to define assessment scope and obtain preliminary NOC"

For each relationship, provide:
- section: "Dependencies"
- statement: complete relationship explanation
- key: short identifier (e.g., "solar_lng_cod_dependency")
- value: core dependency description
- confidence: 0.0-1.0
- extraction_method: "llm_relationships_v2"

Return a JSON array of facts.`;
    
    return await this.callLLMExtraction(prompt, "llm_relationships_v2");
  }

  /**
   * Pass 3: Extract risks and red flags
   */
  private async extractRisks(text: string, docType: string): Promise<ExtractedFact[]> {
    const prompt = `Identify risks, concerns, and potential issues in this ${docType} document.

Document text:
${text.substring(0, 50000)}

Look for:
1. Explicitly stated risks or concerns
2. Site changes or relocations (indicates previous problems)
3. Schedule pressure or tight timelines
4. Pending critical approvals
5. Technical constraints or limitations
6. Environmental or social challenges

IMPORTANT: Explain each risk clearly with context about why it matters.

GOOD examples:
- "Project site was relocated from Shinas to Duqm due to technical complexities and cost implications, indicating inadequate initial site assessment"
- "Solar COD must match LNG COD (January 2028) creating schedule risk where any solar delay jeopardizes LNG carbon neutrality goals"
- "Full ESIA not expected until 25 December 2025 leaves minimal time for issue mitigation if significant environmental concerns are discovered"

For each risk, provide:
- section: "Risks_And_Issues"
- statement: complete risk description with impact explanation
- key: risk identifier (e.g., "site_relocation_risk", "cod_schedule_risk")
- value: brief risk summary
- confidence: 0.0-1.0
- extraction_method: "llm_risks_v2"

Return a JSON array of facts.`;
    
    return await this.callLLMExtraction(prompt, "llm_risks_v2");
  }

  /**
   * Pass 4: Extract assumptions and design parameters
   */
  private async extractAssumptions(text: string, docType: string): Promise<ExtractedFact[]> {
    const prompt = `Extract design assumptions and engineering parameters from this ${docType} document.

Document text:
${text.substring(0, 50000)}

Identify:
1. Design assumptions and their rationale
2. Technology selections with justification
3. Performance estimates and calculation basis
4. Key engineering parameters

IMPORTANT: Provide context for each assumption or parameter.

GOOD examples:
- "Ground coverage ratio set at 35% to optimize land use while maintaining adequate spacing for maintenance access"
- "Bifacial solar modules selected to capture reflected light from ground surface and increase energy yield"
- "Single-axis tracking system chosen to maximize energy production throughout the day while balancing cost and complexity"
- "Specific yield estimated at 2,500 kWh/kWp/year based on local solar resource data and system design assumptions"

For each item, provide:
- section: one of ["Engineering_Assumptions", "Technology_Choices", "Design_Parameters", "Performance_Estimates"]
- statement: complete description with context
- key: parameter identifier (e.g., "gcr_assumption", "module_technology", "specific_yield")
- value: core parameter value
- confidence: 0.0-1.0
- extraction_method: "llm_assumptions_v2"

Return a JSON array of facts.`;
    
    return await this.callLLMExtraction(prompt, "llm_assumptions_v2");
  }

  /**
   * Helper method to call LLM and parse response
   */
  private async callLLMExtraction(prompt: string, method: string): Promise<ExtractedFact[]> {
    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are an expert at extracting structured information from renewable energy project documents. Extract facts as complete contextual statements in JSON format."
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
                      section: { type: "string" },
                      statement: { type: "string" },
                      key: { type: "string" },
                      value: { type: "string" },
                      confidence: { type: "number" },
                      extraction_method: { type: "string" }
                    },
                    required: ["section", "statement", "key", "value", "confidence", "extraction_method"],
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
      if (!content) {
        console.error(`[Intelligent Extractor V2] Empty response from LLM for method ${method}`);
        return [];
      }

      const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
      const parsed = JSON.parse(contentStr);
      return parsed.facts || [];
    } catch (error) {
      console.error(`[Intelligent Extractor V2] ${method} extraction failed:`, error);
      return [];
    }
  }
}
