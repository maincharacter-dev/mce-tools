/**
 * Location Service
 * 
 * Handles location extraction, geocoding, and consolidation from multiple sources:
 * - Weather file headers (lat/lon from PVGIS/EPW metadata)
 * - Document text (coordinates, addresses, city names)
 * - Geocoding fallback for city/address to coordinates
 */

import { invokeLLM } from './_core/llm';
import { makeRequest } from './_core/map';

export interface LocationSource {
  latitude: number;
  longitude: number;
  source: 'weather_file' | 'document' | 'geocoded';
  confidence: number;
  details?: string; // City name, address, or description
}

export interface ConsolidatedLocation {
  latitude: number;
  longitude: number;
  source: string;
  confidence: number;
  city?: string;
  country?: string;
  address?: string;
}

export class LocationService {
  /**
   * Extract location mentions from document facts using LLM
   */
  async extractLocationFromFacts(factsSummary: string): Promise<LocationSource | null> {
    try {
      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: 'You are a location extraction specialist. Extract geographic coordinates, addresses, or city names from project documents.'
          },
          {
            role: 'user',
            content: `Extract the project site location from these facts. Look for:
- Explicit coordinates (latitude/longitude)
- Site address or location description
- City/region/country names
- Any geographic references

Facts:
${factsSummary.substring(0, 10000)}

Return JSON with the most specific location information available.`
          }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'location_extraction',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                has_location: {
                  type: 'boolean',
                  description: 'Whether any location information was found'
                },
                latitude: {
                  type: ['number', 'null'],
                  description: 'Latitude in decimal degrees, or null if not found'
                },
                longitude: {
                  type: ['number', 'null'],
                  description: 'Longitude in decimal degrees, or null if not found'
                },
                city: {
                  type: ['string', 'null'],
                  description: 'City name if mentioned'
                },
                country: {
                  type: ['string', 'null'],
                  description: 'Country name if mentioned'
                },
                address: {
                  type: ['string', 'null'],
                  description: 'Full address or location description'
                },
                confidence: {
                  type: 'number',
                  description: 'Confidence score 0.0-1.0'
                }
              },
              required: ['has_location', 'latitude', 'longitude', 'city', 'country', 'address', 'confidence'],
              additionalProperties: false
            }
          }
        }
      });

      const content = response.choices[0].message.content;
      if (!content || typeof content !== 'string') {
        return null;
      }

      const parsed = JSON.parse(content);
      
      if (!parsed.has_location) {
        return null;
      }

      // If we have explicit coordinates, return them
      if (parsed.latitude !== null && parsed.longitude !== null) {
        return {
          latitude: parsed.latitude,
          longitude: parsed.longitude,
          source: 'document',
          confidence: parsed.confidence,
          details: parsed.address || parsed.city || 'Extracted from documents'
        };
      }

      // If we only have city/address, try geocoding
      const locationString = parsed.address || (parsed.city && parsed.country ? `${parsed.city}, ${parsed.country}` : parsed.city);
      if (locationString) {
        const geocoded = await this.geocodeLocation(locationString);
        if (geocoded) {
          return {
            ...geocoded,
            source: 'document',
            details: locationString
          };
        }
      }

      return null;
    } catch (error) {
      console.error('[LocationService] Failed to extract location from facts:', error);
      return null;
    }
  }

  /**
   * Geocode a city name or address to coordinates using Google Maps Geocoding API
   */
  async geocodeLocation(locationString: string): Promise<LocationSource | null> {
    try {
      console.log(`[LocationService] Geocoding: ${locationString}`);
      
      const response: any = await makeRequest(
        '/maps/api/geocode/json',
        {
          address: locationString
        }
      );

      if (response.status === 'OK' && response.results && response.results.length > 0) {
        const result = response.results[0];
        const location = result.geometry.location;
        
        console.log(`[LocationService] Geocoded to: ${location.lat}, ${location.lng}`);
        
        return {
          latitude: location.lat,
          longitude: location.lng,
          source: 'geocoded',
          confidence: 0.8, // Geocoding is generally reliable
          details: result.formatted_address
        };
      }

      console.log('[LocationService] Geocoding failed: No results');
      return null;
    } catch (error) {
      console.error('[LocationService] Geocoding error:', error);
      return null;
    }
  }

  /**
   * Consolidate location from multiple sources and pick the best one
   * Priority: explicit coordinates > weather file > geocoded city
   */
  consolidateLocations(sources: LocationSource[]): ConsolidatedLocation | null {
    if (sources.length === 0) {
      return null;
    }

    // Sort by priority: document coordinates > weather file > geocoded
    const priorityOrder = { document: 3, weather_file: 2, geocoded: 1 };
    const sorted = sources.sort((a, b) => {
      const priorityDiff = priorityOrder[b.source] - priorityOrder[a.source];
      if (priorityDiff !== 0) return priorityDiff;
      return b.confidence - a.confidence;
    });

    const best = sorted[0];
    
    return {
      latitude: best.latitude,
      longitude: best.longitude,
      source: best.source,
      confidence: best.confidence,
      address: best.details
    };
  }
}
