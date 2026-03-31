/**
 * AI-powered document type detection
 * Analyzes filename and document content to automatically categorize documents
 * Uses a two-stage approach:
 * 1. Fast keyword-based classification (no API calls)
 * 2. LLM-based classification for uncertain cases
 */

import { invokeLLM } from './_core/llm';
import { extractTextFromDocument } from './document-extractor';
import { classifyByFilename, classifyByContent, type ClassificationResult } from './document-classifier';

export type DocumentType = 'IM' | 'DD_PACK' | 'CONTRACT' | 'GRID_STUDY' | 'CONCEPT_DESIGN' | 'WEATHER_FILE' | 'OTHER';

/**
 * Normalize document type from classifier to valid DocumentType
 * Maps extended types back to the core set
 */
function normalizeDocType(type: string): DocumentType {
  const typeMap: Record<string, DocumentType> = {
    'IM': 'IM',
    'DD_PACK': 'DD_PACK',
    'CONTRACT': 'CONTRACT',
    'GRID_STUDY': 'GRID_STUDY',
    'CONCEPT_DESIGN': 'CONCEPT_DESIGN',
    'WEATHER_FILE': 'WEATHER_FILE',
    'WEATHER_DATA': 'WEATHER_FILE', // Map to WEATHER_FILE
    'FINANCIAL_MODEL': 'DD_PACK', // Financial models are part of DD packs
    'OTHER': 'OTHER',
  };
  return typeMap[type] || 'OTHER';
}

/**
 * Detect document type using hybrid approach (keywords + AI)
 * @param filePath Path to the uploaded document
 * @param fileName Original filename
 * @returns Detected document type
 */
export async function detectDocumentType(filePath: string, fileName: string): Promise<DocumentType> {
  try {
    console.log(`[Document Type Detector] Analyzing: ${fileName}`);

    // Stage 1: Try fast keyword-based classification by filename
    const filenameResult = classifyByFilename(fileName);
    if (filenameResult && filenameResult.confidence === 'high') {
      console.log(`[Document Type Detector] Fast classification by filename: ${filenameResult.suggestedType} (high confidence)`);
      return normalizeDocType(filenameResult.suggestedType);
    }

    // Extract first page of text for analysis
    let textSample = '';
    try {
      const extractionResult = await extractTextFromDocument(filePath);
      // Take first 2000 characters for analysis
      textSample = extractionResult.text.substring(0, 2000);
      
      // Stage 2: Try keyword-based classification by content
      const contentResult = classifyByContent(extractionResult.text);
      if (contentResult.confidence === 'high') {
        console.log(`[Document Type Detector] Fast classification by content: ${contentResult.suggestedType} (high confidence, keywords: ${contentResult.matchedKeywords.join(', ')})`);
        return normalizeDocType(contentResult.suggestedType);
      }
      
      // If medium confidence and filename also matched, use it
      if (contentResult.confidence === 'medium' && filenameResult) {
        console.log(`[Document Type Detector] Combined classification: ${contentResult.suggestedType} (medium confidence)`);
        return normalizeDocType(contentResult.suggestedType);
      }
    } catch (error) {
      console.warn(`[Document Type Detector] Text extraction failed, using filename only:`, error);
    }

    // Prepare prompt for LLM
    const prompt = `You are a document classification expert for renewable energy projects. Analyze the following document and classify it into ONE of these categories:

**Categories:**
- IM: Information Memorandum (project overview, investment summary, executive summary)
- DD_PACK: Due Diligence Pack (comprehensive project data, technical specifications, financial models)
- CONTRACT: Contracts and agreements (PPAs, land leases, EPC contracts, O&M agreements)
- GRID_STUDY: Grid connection studies (grid impact assessment, connection agreement, network studies)
- PLANNING: Planning and permitting documents (development applications, environmental approvals, permits)
- CONCEPT_DESIGN: Concept designs and layouts (site plans, electrical diagrams, preliminary designs)
- WEATHER_FILE: Weather data files (TMY, EPW, CSV with solar irradiance data, PVGIS data)
- OTHER: Any other document type

**Document to classify:**
Filename: ${fileName}
${textSample ? `\nFirst page content:\n${textSample}` : ''}

**Instructions:**
1. Analyze the filename and content carefully
2. Look for key indicators like document titles, section headings, terminology
3. Return ONLY the category code (IM, DD_PACK, CONTRACT, GRID_STUDY, PLANNING, CONCEPT_DESIGN, WEATHER_FILE, or OTHER)
4. Do not include any explanation or additional text

Category:`;

    // Call LLM
    const response = await invokeLLM({
      _usageSource: "doc_type_detection",
      messages: [
        { role: 'user', content: prompt }
      ]
    });

    const content = response.choices[0].message.content;
    const detectedType = (typeof content === 'string' ? content : '').trim().toUpperCase();

    // Validate response
    const validTypes: DocumentType[] = [
      'IM',
      'DD_PACK',
      'CONTRACT',
      'GRID_STUDY',
      'CONCEPT_DESIGN',
      'WEATHER_FILE',
      'OTHER'
    ];
    
    if (validTypes.includes(detectedType as DocumentType)) {
      console.log(`[Document Type Detector] Detected type: ${detectedType}`);
      return detectedType as DocumentType;
    } else {
      console.warn(`[Document Type Detector] Invalid response: ${detectedType}, defaulting to OTHER`);
      return 'OTHER';
    }

  } catch (error) {
    console.error(`[Document Type Detector] Error:`, error);
    return 'OTHER';
  }
}

/**
 * Get human-readable label for document type
 */
export function getDocumentTypeLabel(type: DocumentType): string {
  const labels: Record<DocumentType, string> = {
    'IM': 'Information Memorandum',
    'DD_PACK': 'Due Diligence Pack',
    'CONTRACT': 'Contract',
    'GRID_STUDY': 'Grid Study',
    'CONCEPT_DESIGN': 'Concept Design',
    'WEATHER_FILE': 'Weather File',
    'OTHER': 'Other'
  };
  return labels[type] || 'Other';
}
