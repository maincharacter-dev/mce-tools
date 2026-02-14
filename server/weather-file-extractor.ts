/**
 * Weather File Extractor
 * 
 * Extracts weather file references from project documents and downloads them.
 * Supports:
 * - Direct URLs to weather files (.csv, .epw, .tm2, .tm3)
 * - References to PVGIS/NSRDB/SolarAnywhere data
 * - Embedded weather data tables
 * 
 * Author: Manus AI
 * Date: January 24, 2026
 */

import { invokeLLM } from "./_core/llm.js";
import { storagePut } from "./storage";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";

export interface WeatherFileReference {
  type: 'url' | 'embedded' | 'reference';
  url?: string;
  description: string;
  format?: string; // pvgis, tmy3, epw, pvsyst, solaranywhere
  location?: string;
  confidence: number;
  sourceLocation: string; // Page number or section
}

export interface ExtractedWeatherData {
  references: WeatherFileReference[];
  extractionMethod: string;
  confidence: number;
}

export class WeatherFileExtractor {
  /**
   * Extract weather file references from document text
   */
  async extractWeatherReferences(
    documentText: string,
    documentId: string,
    fileName: string
  ): Promise<ExtractedWeatherData> {
    const prompt = `You are analyzing a solar project document to find weather data references.

DOCUMENT: ${fileName}

Extract ALL weather file references, including:
1. Direct URLs to weather files (.csv, .epw, .tm2, .tm3, .wth)
2. References to weather data sources (PVGIS, NSRDB, SolarAnywhere, Meteonorm, PVsyst)
3. Mentions of TMY (Typical Meteorological Year) data
4. Weather file names or identifiers
5. Embedded weather data tables (if present)

For each reference, provide:
- type: "url" | "embedded" | "reference"
- url: Direct URL if available
- description: What the reference says
- format: Detected format (pvgis, tmy3, epw, pvsyst, solaranywhere, meteonorm, unknown)
- location: Geographic location mentioned
- confidence: 0.0-1.0 confidence score
- sourceLocation: Page number or section where found

Return JSON:
{
  "references": [
    {
      "type": "url",
      "url": "https://example.com/weather.csv",
      "description": "PVGIS TMY data for Malta",
      "format": "pvgis",
      "location": "Malta, 35.9°N 14.4°E",
      "confidence": 0.95,
      "sourceLocation": "Page 12, Section 3.2"
    }
  ]
}

DOCUMENT TEXT (first 50,000 characters):
${documentText.substring(0, 50000)}`;

    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are a technical document analyzer specializing in solar energy project data extraction. Return valid JSON only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "weather_references",
            strict: true,
            schema: {
              type: "object",
              properties: {
                references: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: {
                        type: "string",
                        enum: ["url", "embedded", "reference"]
                      },
                      url: {
                        type: "string"
                      },
                      description: {
                        type: "string"
                      },
                      format: {
                        type: "string"
                      },
                      location: {
                        type: "string"
                      },
                      confidence: {
                        type: "number"
                      },
                      sourceLocation: {
                        type: "string"
                      }
                    },
                    required: ["type", "description", "confidence", "sourceLocation"],
                    additionalProperties: false
                  }
                }
              },
              required: ["references"],
              additionalProperties: false
            }
          }
        }
      });

      const content = response.choices[0].message.content;
      if (!content || typeof content !== 'string') {
        throw new Error("Empty or invalid response from LLM");
      }

      const parsed = JSON.parse(content);
      
      return {
        references: parsed.references || [],
        extractionMethod: "llm",
        confidence: parsed.references.length > 0 
          ? parsed.references.reduce((sum: number, ref: WeatherFileReference) => sum + ref.confidence, 0) / parsed.references.length
          : 0
      };
    } catch (error) {
      console.error("Weather file extraction error:", error);
      return {
        references: [],
        extractionMethod: "llm",
        confidence: 0
      };
    }
  }

  /**
   * Download weather file from URL
   */
  async downloadWeatherFile(
    url: string,
    projectId: number,
    documentId: string
  ): Promise<{
    fileKey: string;
    fileUrl: string;
    fileName: string;
    fileSizeBytes: number;
    content: string;
  } | null> {
    try {
      console.log(`Downloading weather file from: ${url}`);
      
      const response = await axios.get(url, {
        timeout: 60000, // 60 second timeout
        maxContentLength: 50 * 1024 * 1024, // 50MB max
        responseType: 'text'
      });

      const content = response.data;
      const fileSizeBytes = Buffer.byteLength(content, 'utf8');
      
      // Extract filename from URL or generate one
      const urlParts = url.split('/');
      const urlFileName = urlParts[urlParts.length - 1] || 'weather_data.csv';
      const fileName = urlFileName.split('?')[0]; // Remove query params
      
      // Upload to S3
      const fileKey = `project-${projectId}/weather/${documentId}/${uuidv4()}-${fileName}`;
      const { url: fileUrl } = await storagePut(
        fileKey,
        content,
        'text/csv'
      );

      console.log(`Weather file downloaded and uploaded to S3: ${fileKey}`);
      
      return {
        fileKey,
        fileUrl,
        fileName,
        fileSizeBytes,
        content
      };
    } catch (error) {
      console.error(`Failed to download weather file from ${url}:`, error);
      return null;
    }
  }

  /**
   * Process weather file: download, convert, validate
   */
  async processWeatherFile(
    reference: WeatherFileReference,
    projectId: number,
    documentId: string
  ): Promise<{
    fileKey: string;
    fileUrl: string;
    fileName: string;
    fileSizeBytes: number;
    originalFormat: string;
    content: string;
  } | null> {
    if (reference.type !== 'url' || !reference.url) {
      console.log(`Skipping non-URL reference: ${reference.description}`);
      return null;
    }

    // Download the file
    const downloadResult = await this.downloadWeatherFile(
      reference.url,
      projectId,
      documentId
    );

    if (!downloadResult) {
      return null;
    }

    return {
      ...downloadResult,
      originalFormat: reference.format || 'unknown'
    };
  }
}


/**
 * Monthly irradiance data structure
 */
export interface MonthlyIrradiance {
  month: number;
  monthName: string;
  ghi_kwh_m2: number;
  dni_kwh_m2: number;
  dhi_kwh_m2: number;
  temperature_avg_c: number;
}

export interface ParsedWeatherData {
  location: {
    latitude: number;
    longitude: number;
    elevation_m?: number;
    timezone?: string;
  };
  monthlyData: MonthlyIrradiance[];
  annualSummary: {
    ghi_total_kwh_m2: number;
    dni_total_kwh_m2: number;
    dhi_total_kwh_m2: number;
    temperature_avg_c: number;
  };
  dataSource?: string;
  dataYear?: number;
}

/**
 * Parse TMY CSV file and extract monthly irradiance data
 * Supports PVGIS TMY format and generic hourly weather data
 */
export function parseWeatherFile(csvContent: string, fileName: string): ParsedWeatherData | null {
  try {
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length < 10) {
      console.log('[Weather Parser] File too short to be valid weather data');
      return null;
    }

    // Try to detect format and parse header
    let latitude = 0, longitude = 0, elevation = 0;
    let dataStartLine = 0;
    let ghiCol = -1, dniCol = -1, dhiCol = -1, tempCol = -1;
    
    // Check for PVGIS format (has metadata header)
    for (let i = 0; i < Math.min(20, lines.length); i++) {
      const line = lines[i].toLowerCase();
      
      // PVGIS metadata
      if (line.includes('latitude')) {
        const match = lines[i].match(/latitude[:\s,]+([\-\d.]+)/i);
        if (match) latitude = parseFloat(match[1]);
      }
      if (line.includes('longitude')) {
        const match = lines[i].match(/longitude[:\s,]+([\-\d.]+)/i);
        if (match) longitude = parseFloat(match[1]);
      }
      if (line.includes('elevation')) {
        const match = lines[i].match(/elevation[:\s,]+([\-\d.]+)/i);
        if (match) elevation = parseFloat(match[1]);
      }
      
      // Find header row - check for various irradiance column naming conventions
      // PVGIS uses: G(h) = GHI, Gb(n) = DNI, Gd(h) = DHI
      // Other formats use: GHI, DNI, DHI or Global, Direct, Diffuse
      if (line.includes('ghi') || line.includes('global') || line.includes('g(h)') || line.includes('gb(n)') || line.includes('gd(h)')) {
        dataStartLine = i + 1;
        const cols = lines[i].split(',').map(c => c.toLowerCase().trim());
        
        // GHI column detection - G(h), GHI, Global Horizontal
        ghiCol = cols.findIndex(c => 
          c === 'g(h)' || 
          c.includes('ghi') || 
          c === 'global' || 
          c === 'global_horizontal' ||
          c === 'shortwave_radiation'
        );
        
        // DNI column detection - Gb(n), DNI, Direct Normal, Direct Beam
        dniCol = cols.findIndex(c => 
          c === 'gb(n)' || 
          c.includes('dni') || 
          c === 'direct' ||
          c === 'direct_normal' ||
          c === 'direct_normal_irradiance' ||
          c === 'bn(h)' ||
          c.includes('beam')
        );
        
        // DHI column detection - Gd(h), DHI, Diffuse Horizontal
        dhiCol = cols.findIndex(c => 
          c === 'gd(h)' || 
          c.includes('dhi') || 
          c === 'diffuse' ||
          c === 'diffuse_horizontal' ||
          c === 'diffuse_radiation' ||
          c === 'd(h)'
        );
        
        // Temperature column detection - T2m, Temp, Tamb
        tempCol = cols.findIndex(c => 
          c === 't2m' ||
          c.includes('temp') || 
          c === 'tamb' ||
          c === 'temperature_2m' ||
          c.includes('air_temp')
        );
        
        console.log(`[Weather Parser] Detected columns - GHI: ${ghiCol}, DNI: ${dniCol}, DHI: ${dhiCol}, Temp: ${tempCol}`);
        console.log(`[Weather Parser] Column names: ${cols.join(', ')}`);
        
        break;
      }
    }

    // If no header found, try generic format (assume columns)
    if (ghiCol === -1) {
      // Try to infer from filename or first data row
      const firstDataRow = lines[1]?.split(',');
      if (firstDataRow && firstDataRow.length >= 4) {
        // Assume: date, GHI, DNI, DHI, Temp format
        ghiCol = 1;
        dniCol = 2;
        dhiCol = 3;
        tempCol = 4;
        dataStartLine = 1;
      }
    }

    if (ghiCol === -1) {
      console.log('[Weather Parser] Could not identify GHI column');
      return null;
    }

    // Parse hourly data and aggregate by month
    const monthlyData: { [month: number]: { ghi: number[], dni: number[], dhi: number[], temp: number[] } } = {};
    for (let m = 1; m <= 12; m++) {
      monthlyData[m] = { ghi: [], dni: [], dhi: [], temp: [] };
    }

    for (let i = dataStartLine; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length < Math.max(ghiCol, dniCol, dhiCol, tempCol) + 1) continue;

      // Try to extract month from date column or row index
      let month = 1;
      const dateStr = cols[0];
      
      // Try various date formats
      // PVGIS format: YYYYMMDD:HHMM (e.g., 20180101:0000)
      // Standard formats: YYYY-MM-DD, DD/MM/YYYY, etc.
      const pvgisMatch = dateStr.match(/^(\d{4})(\d{2})(\d{2}):(\d{4})$/);
      const isoMatch = dateStr.match(/(\d{4})[\-\/](\d{1,2})[\-\/](\d{1,2})/);
      const euroMatch = dateStr.match(/(\d{1,2})[\-\/](\d{1,2})[\-\/](\d{4})/);
      const simpleMatch = dateStr.match(/^(\d{1,2})/);
      
      if (pvgisMatch) {
        // PVGIS format: YYYYMMDD:HHMM
        month = parseInt(pvgisMatch[2]);
      } else if (isoMatch) {
        // ISO format: YYYY-MM-DD
        month = parseInt(isoMatch[2]);
      } else if (euroMatch) {
        // European format: DD/MM/YYYY or MM/DD/YYYY
        month = parseInt(euroMatch[2]);
      } else if (simpleMatch) {
        month = parseInt(simpleMatch[1]);
      } else {
        // Estimate month from row position (8760 hours / 12 months)
        const hourOfYear = i - dataStartLine;
        month = Math.floor(hourOfYear / 730) + 1;
      }

      if (month < 1 || month > 12) month = 1;

      // Parse values
      const ghi = parseFloat(cols[ghiCol]) || 0;
      const dni = dniCol >= 0 ? parseFloat(cols[dniCol]) || 0 : 0;
      const dhi = dhiCol >= 0 ? parseFloat(cols[dhiCol]) || 0 : 0;
      const temp = tempCol >= 0 ? parseFloat(cols[tempCol]) || 0 : 0;

      if (ghi >= 0 && ghi < 2000) { // Sanity check
        monthlyData[month].ghi.push(ghi);
        monthlyData[month].dni.push(dni);
        monthlyData[month].dhi.push(dhi);
        monthlyData[month].temp.push(temp);
      }
    }

    // Calculate monthly totals (convert hourly W/m² to monthly kWh/m²)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const result: MonthlyIrradiance[] = [];
    
    let totalGhi = 0, totalDni = 0, totalDhi = 0, tempSum = 0, tempCount = 0;

    for (let m = 1; m <= 12; m++) {
      const data = monthlyData[m];
      if (data.ghi.length === 0) continue;

      // Sum hourly values and convert to kWh/m² (divide by 1000)
      const ghiSum = data.ghi.reduce((a, b) => a + b, 0) / 1000;
      const dniSum = data.dni.reduce((a, b) => a + b, 0) / 1000;
      const dhiSum = data.dhi.reduce((a, b) => a + b, 0) / 1000;
      const tempAvg = data.temp.length > 0 ? data.temp.reduce((a, b) => a + b, 0) / data.temp.length : 0;

      result.push({
        month: m,
        monthName: monthNames[m - 1],
        ghi_kwh_m2: Math.round(ghiSum * 10) / 10,
        dni_kwh_m2: Math.round(dniSum * 10) / 10,
        dhi_kwh_m2: Math.round(dhiSum * 10) / 10,
        temperature_avg_c: Math.round(tempAvg * 10) / 10
      });

      totalGhi += ghiSum;
      totalDni += dniSum;
      totalDhi += dhiSum;
      tempSum += tempAvg;
      tempCount++;
    }

    return {
      location: {
        latitude,
        longitude,
        elevation_m: elevation || undefined
      },
      monthlyData: result,
      annualSummary: {
        ghi_total_kwh_m2: Math.round(totalGhi),
        dni_total_kwh_m2: Math.round(totalDni),
        dhi_total_kwh_m2: Math.round(totalDhi),
        temperature_avg_c: tempCount > 0 ? Math.round(tempSum / tempCount * 10) / 10 : 0
      },
      dataSource: fileName
    };
  } catch (error) {
    console.error('[Weather Parser] Error parsing weather file:', error);
    return null;
  }
}
