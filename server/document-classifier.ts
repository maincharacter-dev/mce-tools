/**
 * Document Classifier Service
 * 
 * Automatically classifies documents based on:
 * 1. Filename patterns
 * 2. First-page keyword scanning
 */

import { promises as fs } from 'fs';
import path from 'path';
import { extractTextFromDocument } from './document-extractor';

export interface ClassificationResult {
  suggestedType: string;
  confidence: 'high' | 'medium' | 'low';
  matchedKeywords: string[];
  source: 'filename' | 'content' | 'fallback';
}

// Document type definitions with keywords and filename patterns
const DOCUMENT_TYPE_PATTERNS: Record<string, {
  filenamePatterns: RegExp[];
  keywords: string[];
  priority: number;
}> = {
  IM: {
    filenamePatterns: [
      /(?:^|[_\s-])IM(?:[_\s-.]|$)/i,
      /investment[_\s-]*memo/i,
      /information[_\s-]*memo/i,
      /teaser/i,
    ],
    keywords: [
      'investment memorandum',
      'information memorandum',
      'confidential information',
      'executive summary',
      'investment opportunity',
      'project overview',
      'indicative terms',
      'investment highlights',
      'target irr',
      'equity investment',
    ],
    priority: 1,
  },
  DD_PACK: {
    filenamePatterns: [
      /(?:^|[_\s-])DD(?:[_\s-.]|$)/i,
      /due[_\s-]*diligence/i,
      /diligence[_\s-]*pack/i,
      /data[_\s-]*room/i,
    ],
    keywords: [
      'due diligence',
      'technical due diligence',
      'legal due diligence',
      'financial due diligence',
      'environmental due diligence',
      'data room',
      'diligence report',
      'site investigation',
      'technical assessment',
      'risk assessment',
    ],
    priority: 2,
  },
  CONTRACT: {
    filenamePatterns: [
      /contract/i,
      /agreement/i,
      /\bPPA\b/i,
      /\bEPC\b/i,
      /\bO&M\b/i,
      /\bLOI\b/i,
      /lease/i,
    ],
    keywords: [
      'power purchase agreement',
      'ppa',
      'epc contract',
      'engineering procurement construction',
      'operation and maintenance',
      'o&m agreement',
      'lease agreement',
      'land lease',
      'offtake agreement',
      'connection agreement',
      'grid connection agreement',
      'parties agree',
      'terms and conditions',
      'effective date',
      'termination',
    ],
    priority: 3,
  },
  GRID_STUDY: {
    filenamePatterns: [
      /grid[_\s-]*study/i,
      /grid[_\s-]*connection/i,
      /connection[_\s-]*study/i,
      /network[_\s-]*study/i,
      /feasibility[_\s-]*study/i,
      /\bGCA\b/i,
    ],
    keywords: [
      'grid connection',
      'grid study',
      'connection study',
      'network study',
      'feasibility study',
      'point of connection',
      'poc',
      'substation',
      'transmission line',
      'grid capacity',
      'curtailment',
      'power flow',
      'voltage study',
      'fault level',
      'short circuit',
      'reactive power',
    ],
    priority: 4,
  },
  CONCEPT_DESIGN: {
    filenamePatterns: [
      /concept[_\s-]*design/i,
      /preliminary[_\s-]*design/i,
      /basic[_\s-]*design/i,
      /layout/i,
      /site[_\s-]*plan/i,
    ],
    keywords: [
      'concept design',
      'preliminary design',
      'basic design',
      'site layout',
      'plant layout',
      'general arrangement',
      'single line diagram',
      'sld',
      'equipment list',
      'bill of quantities',
      'boq',
      'design basis',
      'technical specification',
    ],
    priority: 5,
  },
  WEATHER_DATA: {
    filenamePatterns: [
      /weather/i,
      /\bTMY\b/i,
      /\bEPW\b/i,
      /solar[_\s-]*resource/i,
      /irradiance/i,
      /meteo/i,
    ],
    keywords: [
      'weather data',
      'typical meteorological year',
      'tmy',
      'global horizontal irradiance',
      'ghi',
      'direct normal irradiance',
      'dni',
      'diffuse horizontal irradiance',
      'dhi',
      'wind speed',
      'ambient temperature',
      'solar resource',
    ],
    priority: 6,
  },
  FINANCIAL_MODEL: {
    filenamePatterns: [
      /financial[_\s-]*model/i,
      /\bFM\b/i,
      /cashflow/i,
      /cash[_\s-]*flow/i,
      /proforma/i,
    ],
    keywords: [
      'financial model',
      'cash flow',
      'cashflow',
      'irr',
      'internal rate of return',
      'npv',
      'net present value',
      'lcoe',
      'levelized cost',
      'debt service',
      'dscr',
      'equity return',
      'revenue projection',
    ],
    priority: 7,
  },
};

/**
 * Classify a document based on filename
 */
export function classifyByFilename(filename: string): ClassificationResult | null {
  const normalizedFilename = filename.toLowerCase();
  
  for (const [docType, patterns] of Object.entries(DOCUMENT_TYPE_PATTERNS)) {
    for (const pattern of patterns.filenamePatterns) {
      if (pattern.test(normalizedFilename)) {
        return {
          suggestedType: docType,
          confidence: 'high',
          matchedKeywords: [pattern.source],
          source: 'filename',
        };
      }
    }
  }
  
  return null;
}

/**
 * Classify a document based on content keywords
 */
export function classifyByContent(text: string): ClassificationResult {
  const normalizedText = text.toLowerCase();
  const firstChunk = normalizedText.slice(0, 3000); // First ~3000 chars
  
  const scores: Record<string, { score: number; matches: string[] }> = {};
  
  for (const [docType, patterns] of Object.entries(DOCUMENT_TYPE_PATTERNS)) {
    scores[docType] = { score: 0, matches: [] };
    
    for (const keyword of patterns.keywords) {
      if (firstChunk.includes(keyword.toLowerCase())) {
        scores[docType].score += 1;
        scores[docType].matches.push(keyword);
      }
    }
  }
  
  // Find the best match
  let bestType = 'OTHER';
  let bestScore = 0;
  let bestMatches: string[] = [];
  
  for (const [docType, result] of Object.entries(scores)) {
    if (result.score > bestScore) {
      bestScore = result.score;
      bestType = docType;
      bestMatches = result.matches;
    }
  }
  
  // Determine confidence based on number of matches
  let confidence: 'high' | 'medium' | 'low';
  if (bestScore >= 3) {
    confidence = 'high';
  } else if (bestScore >= 1) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }
  
  return {
    suggestedType: bestType,
    confidence,
    matchedKeywords: bestMatches,
    source: bestScore > 0 ? 'content' : 'fallback',
  };
}

/**
 * Classify a document using both filename and content analysis
 */
export async function classifyDocument(
  filePath: string,
  filename?: string
): Promise<ClassificationResult> {
  const actualFilename = filename || path.basename(filePath);
  
  // First try filename classification
  const filenameResult = classifyByFilename(actualFilename);
  if (filenameResult && filenameResult.confidence === 'high') {
    console.log(`[Document Classifier] Classified by filename: ${filenameResult.suggestedType}`);
    return filenameResult;
  }
  
  // Try content-based classification
  try {
    const extraction = await extractTextFromDocument(filePath);
    const contentResult = classifyByContent(extraction.text);
    
    // If filename gave a medium confidence match, prefer it over low content match
    if (filenameResult && filenameResult.confidence === 'medium' && contentResult.confidence === 'low') {
      console.log(`[Document Classifier] Using filename classification: ${filenameResult.suggestedType}`);
      return filenameResult;
    }
    
    console.log(`[Document Classifier] Classified by content: ${contentResult.suggestedType} (${contentResult.confidence})`);
    return contentResult;
  } catch (error) {
    console.error(`[Document Classifier] Content extraction failed:`, error);
    
    // Fall back to filename result or OTHER
    if (filenameResult) {
      return filenameResult;
    }
    
    return {
      suggestedType: 'OTHER',
      confidence: 'low',
      matchedKeywords: [],
      source: 'fallback',
    };
  }
}

/**
 * Quick classification for upload preview (filename only, no file access)
 */
export function quickClassify(filename: string): ClassificationResult {
  const filenameResult = classifyByFilename(filename);
  
  if (filenameResult) {
    return filenameResult;
  }
  
  return {
    suggestedType: 'OTHER',
    confidence: 'low',
    matchedKeywords: [],
    source: 'fallback',
  };
}
