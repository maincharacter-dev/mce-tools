/**
 * Performance & Financial Data Extractor
 * 
 * Specialized extraction for:
 * - Performance validation parameters (system design, location, assumptions, contractor claims)
 * - Financial data (CapEx/OpEx breakdown, normalized metrics)
 */

import { invokeLLM } from "./_core/llm";

export interface PerformanceParameters {
  // System design
  dc_capacity_mw?: string;
  ac_capacity_mw?: string;
  module_model?: string;
  module_power_watts?: string;
  module_count?: number;
  inverter_model?: string;
  inverter_power_kw?: string;
  inverter_count?: number;
  tracking_type?: string; // fixed_tilt, single_axis, dual_axis
  tilt_angle_degrees?: string;
  azimuth_degrees?: string;
  
  // Location
  latitude?: string;
  longitude?: string;
  site_name?: string;
  elevation_m?: string;
  timezone?: string;
  
  // Performance assumptions
  system_losses_percent?: string;
  degradation_rate_percent?: string;
  availability_percent?: string;
  soiling_loss_percent?: string;
  
  // Weather data
  weather_file_url?: string;
  ghi_annual_kwh_m2?: string;
  dni_annual_kwh_m2?: string;
  temperature_ambient_c?: string;
  
  // Contractor claims
  p50_generation_gwh?: string;
  p90_generation_gwh?: string;
  capacity_factor_percent?: string;
  specific_yield_kwh_kwp?: string;
  
  // Metadata
  confidence: number;
  extraction_method: string;
  notes?: string;
}

export interface FinancialData {
  // CapEx breakdown (in USD)
  total_capex_usd?: string;
  modules_usd?: string;
  inverters_usd?: string;
  trackers_usd?: string;
  civil_works_usd?: string;
  grid_connection_usd?: string;
  development_costs_usd?: string;
  other_capex_usd?: string;
  
  // OpEx breakdown (annual, in USD)
  total_opex_annual_usd?: string;
  om_usd?: string;
  insurance_usd?: string;
  land_lease_usd?: string;
  asset_management_usd?: string;
  other_opex_usd?: string;
  
  // Normalized metrics
  capex_per_watt_usd?: string;
  opex_per_mwh_usd?: string;
  
  // Currency and date
  original_currency?: string;
  exchange_rate_to_usd?: string;
  cost_year?: number;
  escalation_rate_percent?: string;
  
  // Metadata
  confidence: number;
  extraction_method: string;
  notes?: string;
}

export class PerformanceFinancialExtractor {
  /**
   * Extract performance parameters from document text
   */
  async extractPerformanceParameters(
    documentText: string,
    documentType: string
  ): Promise<PerformanceParameters | null> {
    console.log(`[Performance Extractor] Extracting performance parameters from ${documentType}`);
    
    const prompt = `You are extracting technical parameters for solar farm performance validation from a ${documentType} document.

Extract the following information if present in the document. Return ONLY a JSON object with these fields (use null for missing values):

{
  "dc_capacity_mw": "DC capacity in MW (e.g., '100.5')",
  "ac_capacity_mw": "AC capacity in MW (e.g., '80.0')",
  "module_model": "Solar module model name (e.g., 'Longi LR5-72HPH-550M')",
  "module_power_watts": "Module power rating in watts (e.g., '550')",
  "module_count": "Total number of modules (integer)",
  "inverter_model": "Inverter model name (e.g., 'Sungrow SG3125HV')",
  "inverter_power_kw": "Inverter power rating in kW (e.g., '3125')",
  "inverter_count": "Total number of inverters (integer)",
  "tracking_type": "Tracking system type: 'fixed_tilt', 'single_axis', or 'dual_axis'",
  "tilt_angle_degrees": "Module tilt angle in degrees (e.g., '25')",
  "azimuth_degrees": "Module azimuth in degrees (e.g., '180' for south-facing)",
  "latitude": "Site latitude (e.g., '35.7')",
  "longitude": "Site longitude (e.g., '14.5')",
  "site_name": "Project site name or location",
  "elevation_m": "Site elevation in meters (e.g., '120')",
  "timezone": "Site timezone (e.g., 'Europe/Malta')",
  "system_losses_percent": "Total system losses percentage (e.g., '12.5')",
  "degradation_rate_percent": "Annual degradation rate percentage (e.g., '0.5')",
  "availability_percent": "System availability percentage (e.g., '98.5')",
  "soiling_loss_percent": "Soiling losses percentage (e.g., '2.0')",
  "weather_file_url": "URL or reference to TMY/weather file",
  "ghi_annual_kwh_m2": "Annual global horizontal irradiation in kWh/m² (e.g., '1950')",
  "dni_annual_kwh_m2": "Annual direct normal irradiation in kWh/m² (e.g., '2200')",
  "temperature_ambient_c": "Average ambient temperature in °C (e.g., '19.5')",
  "p50_generation_gwh": "P50 annual generation estimate in GWh (e.g., '235.4')",
  "p90_generation_gwh": "P90 annual generation estimate in GWh (e.g., '220.1')",
  "capacity_factor_percent": "Expected capacity factor percentage (e.g., '26.8')",
  "specific_yield_kwh_kwp": "Specific yield in kWh/kWp (e.g., '1850')",
  "notes": "Any additional relevant notes or assumptions"
}

IMPORTANT:
- Extract exact values as they appear in the document
- Use null for any field not found in the document
- For tracking_type, standardize to: fixed_tilt, single_axis, or dual_axis
- For numeric fields, extract only the number (no units in the value)
- Return valid JSON only, no explanations

Document text:
${documentText.substring(0, 15000)}`;

    try {
      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are a technical data extraction assistant. Extract information accurately and return valid JSON only." },
          { role: "user", content: prompt }
        ],
        response_format: {
          type: "json_object"
        }
      });

      if (!response.choices || response.choices.length === 0) {
        console.log(`[Performance Extractor] No choices returned from LLM`);
        return null;
      }
      
      const content = response.choices[0].message.content;
      if (!content || typeof content !== 'string') {
        console.log(`[Performance Extractor] No content returned from LLM`);
        return null;
      }

      const extracted = JSON.parse(content);
      
      // Count non-null fields to calculate confidence
      const totalFields = Object.keys(extracted).length;
      const extractedFields = Object.values(extracted).filter(v => v !== null).length;
      const confidence = totalFields > 0 ? extractedFields / totalFields : 0;
      
      console.log(`[Performance Extractor] Extracted ${extractedFields}/${totalFields} performance parameters (confidence: ${(confidence * 100).toFixed(1)}%)`);
      
      return {
        ...extracted,
        confidence,
        extraction_method: 'llm'
      };
    } catch (error) {
      console.error(`[Performance Extractor] Extraction failed:`, error);
      return null;
    }
  }

  /**
   * Extract financial data from document text
   */
  async extractFinancialData(
    documentText: string,
    documentType: string
  ): Promise<FinancialData | null> {
    console.log(`[Financial Extractor] Extracting financial data from ${documentType}`);
    
    const prompt = `You are extracting financial data (CapEx and OpEx) from a ${documentType} document for solar farm benchmarking.

Extract the following information if present in the document. Return ONLY a JSON object with these fields (use null for missing values):

{
  "total_capex_usd": "Total capital expenditure in USD (e.g., '125000000')",
  "modules_usd": "Cost of solar modules in USD (e.g., '45000000')",
  "inverters_usd": "Cost of inverters in USD (e.g., '12000000')",
  "trackers_usd": "Cost of tracking systems in USD (e.g., '18000000')",
  "civil_works_usd": "Cost of civil works in USD (e.g., '15000000')",
  "grid_connection_usd": "Cost of grid connection in USD (e.g., '8000000')",
  "development_costs_usd": "Development costs in USD (e.g., '5000000')",
  "other_capex_usd": "Other CapEx costs in USD (e.g., '3000000')",
  "total_opex_annual_usd": "Total annual OpEx in USD (e.g., '2500000')",
  "om_usd": "Annual O&M costs in USD (e.g., '1500000')",
  "insurance_usd": "Annual insurance costs in USD (e.g., '500000')",
  "land_lease_usd": "Annual land lease costs in USD (e.g., '300000')",
  "asset_management_usd": "Annual asset management costs in USD (e.g., '150000')",
  "other_opex_usd": "Other annual OpEx in USD (e.g., '50000')",
  "capex_per_watt_usd": "CapEx per watt in USD (e.g., '1.25')",
  "opex_per_mwh_usd": "OpEx per MWh in USD (e.g., '10.5')",
  "original_currency": "Original currency code if not USD (e.g., 'EUR', 'GBP')",
  "exchange_rate_to_usd": "Exchange rate to USD if applicable (e.g., '1.08')",
  "cost_year": "Year of cost estimates (integer, e.g., 2024)",
  "escalation_rate_percent": "Annual cost escalation rate percentage (e.g., '2.5')",
  "notes": "Any additional relevant notes about costs"
}

IMPORTANT:
- Extract exact numeric values (no currency symbols or units)
- Convert all costs to USD if exchange rate is provided
- Use null for any field not found in the document
- For normalized metrics ($/W, $/MWh), calculate if raw data is available
- Return valid JSON only, no explanations

Document text:
${documentText.substring(0, 15000)}`;

    try {
      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are a financial data extraction assistant. Extract cost information accurately and return valid JSON only." },
          { role: "user", content: prompt }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "financial_data",
            strict: true,
            schema: {
              type: "object",
              properties: {
                total_capex_usd: { type: ["string", "null"] },
                modules_usd: { type: ["string", "null"] },
                inverters_usd: { type: ["string", "null"] },
                trackers_usd: { type: ["string", "null"] },
                civil_works_usd: { type: ["string", "null"] },
                grid_connection_usd: { type: ["string", "null"] },
                development_costs_usd: { type: ["string", "null"] },
                other_capex_usd: { type: ["string", "null"] },
                total_opex_annual_usd: { type: ["string", "null"] },
                om_usd: { type: ["string", "null"] },
                insurance_usd: { type: ["string", "null"] },
                land_lease_usd: { type: ["string", "null"] },
                asset_management_usd: { type: ["string", "null"] },
                other_opex_usd: { type: ["string", "null"] },
                capex_per_watt_usd: { type: ["string", "null"] },
                opex_per_mwh_usd: { type: ["string", "null"] },
                original_currency: { type: ["string", "null"] },
                exchange_rate_to_usd: { type: ["string", "null"] },
                cost_year: { type: ["integer", "null"] },
                escalation_rate_percent: { type: ["string", "null"] },
                notes: { type: ["string", "null"] }
              },
              required: [],
              additionalProperties: false
            }
          }
        }
      });

      if (!response.choices || response.choices.length === 0) {
        console.log(`[Financial Extractor] No choices returned from LLM`);
        return null;
      }
      
      const content = response.choices[0].message.content;
      if (!content || typeof content !== 'string') {
        console.log(`[Financial Extractor] No content returned from LLM`);
        return null;
      }

      const extracted = JSON.parse(content);
      
      // Count non-null fields to calculate confidence
      const totalFields = Object.keys(extracted).length;
      const extractedFields = Object.values(extracted).filter(v => v !== null).length;
      const confidence = totalFields > 0 ? extractedFields / totalFields : 0;
      
      console.log(`[Financial Extractor] Extracted ${extractedFields}/${totalFields} financial data points (confidence: ${(confidence * 100).toFixed(1)}%)`);
      
      return {
        ...extracted,
        confidence,
        extraction_method: 'llm'
      };
    } catch (error) {
      console.error(`[Financial Extractor] Extraction failed:`, error);
      return null;
    }
  }
}
