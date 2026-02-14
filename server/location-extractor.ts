/**
 * Location Extractor
 * 
 * Extracts location information from document text during Phase 1 (upload/scan)
 * - Coordinates (latitude, longitude)
 * - City names, addresses
 * - Site names
 */

import { invokeLLM } from "./_core/llm";

export interface ExtractedLocation {
  latitude?: number;
  longitude?: number;
  city?: string;
  country?: string;
  site_name?: string;
  address?: string;
  confidence: number;
  extraction_method: string;
}

export class LocationExtractor {
  /**
   * Extract location from document text
   */
  async extractLocation(documentText: string): Promise<ExtractedLocation | null> {
    console.log(`[Location Extractor] Extracting location from document`);
    
    const prompt = `Extract location information from this document. Look for:
- Exact coordinates (latitude, longitude)
- City or town names
- Country
- Site name or project location
- Street address or region

Return ONLY a JSON object with these fields (use null for missing values):

{
  "latitude": 19.638,
  "longitude": 56.884,
  "city": "Muscat",
  "country": "Oman",
  "site_name": "Marsa Solar Farm",
  "address": "Al Batinah Region"
}

IMPORTANT:
- latitude and longitude must be numbers (not strings)
- Extract exact coordinates if mentioned
- If only city/region is mentioned, do NOT guess coordinates (leave null)
- Return valid JSON only, no explanations

Document text (first 10000 characters):
${documentText.substring(0, 10000)}`;

    try {
      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are a location extraction assistant. Extract location information accurately and return valid JSON only." },
          { role: "user", content: prompt }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "location_info",
            strict: true,
            schema: {
              type: "object",
              properties: {
                latitude: { type: ["number", "null"] },
                longitude: { type: ["number", "null"] },
                city: { type: ["string", "null"] },
                country: { type: ["string", "null"] },
                site_name: { type: ["string", "null"] },
                address: { type: ["string", "null"] }
              },
              required: [],
              additionalProperties: false
            }
          }
        }
      });

      if (!response.choices || response.choices.length === 0) {
        console.log(`[Location Extractor] No choices returned from LLM`);
        return null;
      }

      const content = response.choices[0].message.content;
      if (!content) {
        console.log(`[Location Extractor] No content in LLM response`);
        return null;
      }

      const locationData = JSON.parse(typeof content === 'string' ? content : JSON.stringify(content));
      
      // Calculate confidence based on what was found
      let confidence = 0;
      if (locationData.latitude && locationData.longitude) confidence += 0.6;
      if (locationData.city) confidence += 0.2;
      if (locationData.country) confidence += 0.1;
      if (locationData.site_name) confidence += 0.1;
      
      if (confidence === 0) {
        console.log(`[Location Extractor] No location information found`);
        return null;
      }

      console.log(`[Location Extractor] Extracted location (confidence: ${(confidence * 100).toFixed(1)}%):`, {
        coords: locationData.latitude && locationData.longitude ? `${locationData.latitude}, ${locationData.longitude}` : 'N/A',
        city: locationData.city || 'N/A',
        country: locationData.country || 'N/A'
      });

      return {
        ...locationData,
        confidence,
        extraction_method: 'llm'
      };
    } catch (error) {
      console.error(`[Location Extractor] Error extracting location:`, error);
      return null;
    }
  }
}
