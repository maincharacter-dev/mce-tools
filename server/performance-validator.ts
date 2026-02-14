import { v4 as uuidv4 } from 'uuid';

/**
 * Performance Validation Calculator
 * 
 * Implements a simplified PVWatts-style calculation for solar PV systems.
 * Uses extracted parameters + weather file data and fills gaps with industry-standard assumptions.
 */

interface PerformanceParameters {
  dc_capacity_mw?: string | null;
  ac_capacity_mw?: string | null;
  tracking_type?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  system_losses_percent?: string | null;
  degradation_rate_percent?: string | null;
  availability_percent?: string | null;
  soiling_loss_percent?: string | null;
  ghi_annual_kwh_m2?: string | null;
  p50_generation_gwh?: string | null;
}

interface WeatherData {
  ghi_total_kwh_m2?: number;
  dni_total_kwh_m2?: number;
  temperature_avg_c?: number;
}

interface ValidationResult {
  id: string;
  project_id: number;
  calculation_id: string;
  
  // Results
  annual_generation_gwh: string;
  capacity_factor_percent: string;
  specific_yield_kwh_kwp: string;
  
  // Comparison
  contractor_claim_gwh: string | null;
  variance_percent: string | null;
  variance_gwh: string | null;
  flag_triggered: number;
  confidence_level: string;
  
  // Inputs used
  dc_capacity_mw: string;
  ac_capacity_mw: string;
  tracking_type: string;
  total_system_losses_percent: string;
  parameters_extracted_count: number;
  parameters_assumed_count: number;
  
  // Weather
  ghi_annual_kwh_m2: string;
  
  // Assumptions
  assumptions: string[];
  warnings: string[];
}

/**
 * Run performance validation calculation
 */
export async function runPerformanceValidation(
  projectId: number,
  params: PerformanceParameters,
  weatherData?: WeatherData | null
): Promise<ValidationResult> {
  console.log(`[Performance Validator] Starting validation for project ${projectId}`);
  
  const assumptions: string[] = [];
  const warnings: string[] = [];
  let extractedCount = 0;
  let assumedCount = 0;
  
  // Parse and validate DC capacity (required)
  const dcCapacityMw = parseFloat(params.dc_capacity_mw || '0');
  if (!dcCapacityMw || dcCapacityMw <= 0) {
    throw new Error('DC capacity is required for performance validation');
  }
  extractedCount++;
  
  // Parse AC capacity (use DC if missing, with warning)
  let acCapacityMw = parseFloat(params.ac_capacity_mw || '0');
  if (!acCapacityMw || acCapacityMw <= 0) {
    acCapacityMw = dcCapacityMw * 0.85; // Assume 1.18 DC/AC ratio
    assumptions.push(`AC capacity assumed as ${acCapacityMw.toFixed(1)} MW (85% of DC capacity, typical for utility-scale)`);
    assumedCount++;
  } else {
    extractedCount++;
  }
  
  // Parse tracking type
  const trackingType = params.tracking_type || 'single_axis';
  if (!params.tracking_type) {
    assumptions.push('Single-axis tracking assumed (most common for utility-scale solar)');
    assumedCount++;
  } else {
    extractedCount++;
  }
  
  // Parse or use weather file GHI
  let ghiAnnual = 0;
  if (weatherData?.ghi_total_kwh_m2) {
    ghiAnnual = weatherData.ghi_total_kwh_m2;
    extractedCount++;
    console.log(`[Performance Validator] Using weather file GHI: ${ghiAnnual} kWh/m²`);
  } else if (params.ghi_annual_kwh_m2) {
    ghiAnnual = parseFloat(params.ghi_annual_kwh_m2);
    extractedCount++;
  } else {
    // Estimate based on latitude
    const latitude = parseFloat(params.latitude || '0');
    ghiAnnual = estimateGHI(latitude);
    assumptions.push(`Annual GHI estimated as ${ghiAnnual} kWh/m² based on latitude ${latitude.toFixed(2)}°`);
    assumedCount++;
  }
  
  // Parse system losses or use defaults
  let systemLosses = parseFloat(params.system_losses_percent || '0');
  if (!systemLosses || systemLosses <= 0) {
    systemLosses = 14.0; // Industry standard for well-designed systems
    assumptions.push('System losses assumed as 14% (industry standard for utility-scale PV)');
    assumedCount++;
  } else {
    extractedCount++;
  }
  
  // Parse availability
  let availability = parseFloat(params.availability_percent || '0');
  if (!availability || availability <= 0) {
    availability = 98.0;
    assumptions.push('System availability assumed as 98% (typical for utility-scale with O&M)');
    assumedCount++;
  } else {
    extractedCount++;
  }
  
  // Parse soiling
  let soiling = parseFloat(params.soiling_loss_percent || '0');
  if (!soiling || soiling <= 0) {
    soiling = 2.0; // Moderate soiling
    assumptions.push('Soiling losses assumed as 2% (moderate desert environment)');
    assumedCount++;
  } else {
    extractedCount++;
  }
  
  // Calculate total losses
  const totalLosses = systemLosses + soiling;
  
  // Calculate POA irradiance based on tracking type
  let poaMultiplier = 1.0;
  switch (trackingType.toLowerCase()) {
    case 'single_axis':
      poaMultiplier = 1.25; // Single-axis tracking typically captures 25% more than GHI
      break;
    case 'dual_axis':
      poaMultiplier = 1.35; // Dual-axis tracking captures 35% more
      break;
    case 'fixed_tilt':
    case 'fixed':
      poaMultiplier = 1.05; // Fixed tilt at optimal angle captures ~5% more
      break;
  }
  
  const poaAnnual = ghiAnnual * poaMultiplier;
  
  // PVWatts-style calculation
  // The DC capacity rating is measured at Standard Test Conditions (STC): 1000 W/m² irradiance
  // Energy = DC Capacity (kW) × Annual POA Irradiance (kWh/m²) × Performance Ratio / STC Irradiance (1000 W/m² = 1 kW/m²)
  // This gives us: kW × (kWh/m²) / (kW/m²) = kWh
  const performanceRatio = (1 - totalLosses / 100) * (availability / 100);
  
  // DC energy before inverter clipping
  // Formula: DC_kW × POA_annual_kWh_per_m2 × PR / 1 kW_per_m2
  // Example: 300,000 kW × 2968 kWh/m² × 0.82 / 1 = 730,176,000 kWh = 730 GWh
  const dcEnergyKwh = (dcCapacityMw * 1000) * poaAnnual * performanceRatio;
  const dcEnergyGwh = dcEnergyKwh / 1e6;
  
  // AC energy after inverter clipping
  const dcAcRatio = dcCapacityMw / acCapacityMw;
  let clippingLossFactor = 1.0;
  if (dcAcRatio > 1.2) {
    clippingLossFactor = 0.98; // ~2% clipping loss for high DC/AC ratios
    warnings.push(`DC/AC ratio of ${dcAcRatio.toFixed(2)} may result in inverter clipping (~2% loss)`);
  }
  
  const acEnergyGwh = dcEnergyGwh * clippingLossFactor * 0.985; // 98.5% inverter efficiency
  
  // Calculate capacity factor
  const capacityFactor = (acEnergyGwh * 1000) / (acCapacityMw * 8760) * 100;
  
  // Calculate specific yield
  const specificYield = (acEnergyGwh * 1e6) / (dcCapacityMw * 1000);
  
  // Compare with contractor claim
  const contractorClaimGwh = parseFloat(params.p50_generation_gwh || '0');
  let variancePercent: number | null = null;
  let varianceGwh: number | null = null;
  let flagTriggered = 0;
  
  if (contractorClaimGwh > 0) {
    varianceGwh = acEnergyGwh - contractorClaimGwh;
    variancePercent = (varianceGwh / contractorClaimGwh) * 100;
    
    // Flag if variance > 10%
    if (Math.abs(variancePercent) > 10) {
      flagTriggered = 1;
      warnings.push(`Calculated generation differs from contractor claim by ${Math.abs(variancePercent).toFixed(1)}% (${Math.abs(varianceGwh).toFixed(1)} GWh)`);
    }
  }
  
  // Determine confidence level
  const extractionRatio = extractedCount / (extractedCount + assumedCount);
  let confidenceLevel = 'LOW';
  if (extractionRatio >= 0.7) {
    confidenceLevel = 'HIGH';
  } else if (extractionRatio >= 0.4) {
    confidenceLevel = 'MEDIUM';
  }
  
  console.log(`[Performance Validator] Calculation complete:`);
  console.log(`  - Annual generation: ${acEnergyGwh.toFixed(1)} GWh`);
  console.log(`  - Capacity factor: ${capacityFactor.toFixed(1)}%`);
  console.log(`  - Specific yield: ${specificYield.toFixed(0)} kWh/kWp`);
  console.log(`  - Extracted: ${extractedCount}, Assumed: ${assumedCount}`);
  console.log(`  - Confidence: ${confidenceLevel}`);
  
  return {
    id: uuidv4(),
    project_id: projectId,
    calculation_id: `CALC_${Date.now()}`,
    annual_generation_gwh: acEnergyGwh.toFixed(2),
    capacity_factor_percent: capacityFactor.toFixed(1),
    specific_yield_kwh_kwp: specificYield.toFixed(0),
    contractor_claim_gwh: contractorClaimGwh > 0 ? contractorClaimGwh.toFixed(2) : null,
    variance_percent: variancePercent !== null ? variancePercent.toFixed(1) : null,
    variance_gwh: varianceGwh !== null ? varianceGwh.toFixed(2) : null,
    flag_triggered: flagTriggered,
    confidence_level: confidenceLevel,
    dc_capacity_mw: dcCapacityMw.toFixed(1),
    ac_capacity_mw: acCapacityMw.toFixed(1),
    tracking_type: trackingType,
    total_system_losses_percent: totalLosses.toFixed(1),
    parameters_extracted_count: extractedCount,
    parameters_assumed_count: assumedCount,
    ghi_annual_kwh_m2: ghiAnnual.toFixed(0),
    assumptions,
    warnings
  };
}

/**
 * Estimate annual GHI based on latitude
 */
function estimateGHI(latitude: number): number {
  const absLat = Math.abs(latitude);
  
  if (absLat < 15) {
    return 1900; // Equatorial
  } else if (absLat < 25) {
    return 2100; // Subtropical (Oman is here)
  } else if (absLat < 35) {
    return 1800; // Mid-latitude
  } else if (absLat < 45) {
    return 1500; // Higher latitude
  } else {
    return 1200; // Northern/Southern regions
  }
}
