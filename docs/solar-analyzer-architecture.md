# Solar Analyzer Integration Architecture
## Performance Validation Layer for OE Toolkit

**Author:** Manus AI  
**Date:** January 23, 2026  
**Version:** 1.0  
**Status:** Design Document

---

## Executive Summary

This document defines the architecture for integrating **NREL PySAM** (System Advisor Model) into the OE Toolkit's Technical Advisory workflow to provide independent performance validation of contractor claims. The integration enables automated benchmarking of solar farm performance estimates against industry-standard calculations, with comprehensive assumption tracking and uncertainty quantification.

The system replaces custom IEC 61724 calculations with NREL's proven modeling engine, providing access to 20,000+ equipment specifications, standardized loss factors, and P50/P90/P95 exceedance probability calculations used by developers, banks, and insurers worldwide.

---

## 1. System Context

### 1.1 Current State

The **Project Ingestion Engine** currently extracts technical insights from project documents using a 6-stage processing pipeline:

1. **Text Extraction** - PDF/DOCX/XLSX parsing with OCR fallback
2. **Deterministic Extraction** - Regex patterns for structured data (capacity, voltage, dates)
3. **LLM Extraction** - Contextual insight extraction via OpenAI (4-pass strategy)
4. **Insight Reconciliation** - Semantic similarity matching across documents (>95% exact, 70-95% merge, <70% conflict)
5. **Saving** - Store insights in per-project SQLite database
6. **Narrative Generation** - Synthesize flowing paragraphs for executive review

This produces a **Project Intelligence Base** with structured insights organized into six canonical sections: Project Overview, Financial Structure, Technical Design, Dependencies, Risks & Issues, and Engineering Assumptions.

### 1.2 Gap Analysis

**Missing capability:** The system extracts contractor performance claims (e.g., "Expected annual generation: 250 GWh") but cannot validate whether these claims are reasonable given the project's technical specifications, location, and equipment choices.

**Business impact:** Technical Advisory teams must manually validate performance claims using spreadsheets, external tools, or third-party consultants, introducing delays and inconsistency.

### 1.3 Target State

The enhanced system will automatically:

- Extract technical parameters from documents (module specs, inverter specs, array design, loss assumptions)
- Fill gaps with industry-standard defaults (PVsyst loss factors, NREL equipment database)
- Calculate independent performance estimates using NREL PySAM
- Compare contractor claims against independent calculations
- Flag discrepancies exceeding configurable thresholds (e.g., >10% variance)
- Track assumption provenance (extracted vs. assumed) for uncertainty quantification
- Benchmark weather data against free satellite sources (PVGIS)

---

## 2. Architecture Overview

### 2.1 System Components

The integration introduces four new components:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Project Ingestion Engine                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Document Processing Pipeline (Existing)                   │ │
│  │  • Text extraction → Deterministic → LLM → Reconciliation  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↓                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  NEW: Technical Parameter Extraction & Assumption Engine   │ │
│  │  • Extract module/inverter specs from insights             │ │
│  │  • Query Equipment Knowledge Base for missing specs        │ │
│  │  • Apply PVsyst default loss factors                       │ │
│  │  • Track provenance: extracted | assumed | knowledge_base  │ │
│  │  • Calculate confidence score (% parameters extracted)     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↓                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  NEW: Solar Analyzer Client                                │ │
│  │  • Build PySAM input schema with assumption tracking       │ │
│  │  • Call Solar Analyzer API endpoint                        │ │
│  │  • Parse performance results (annual GWh, CF, PR, P50/P90) │ │
│  │  • Compare against contractor claims                       │ │
│  │  • Flag discrepancies as red flags                         │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↓ HTTP POST
┌─────────────────────────────────────────────────────────────────┐
│                    Solar Analyzer Service                        │
│                    (MCE-tools/performance-assessment)            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  NEW: PySAM API Endpoint                                   │ │
│  │  POST /api/v1/performance/estimate                         │ │
│  │  • Validate input schema                                   │ │
│  │  • Fetch weather data (uploaded TMY or PVGIS API)          │ │
│  │  • Configure PySAM PVWatts or Detailed PV model            │ │
│  │  • Run annual simulation                                   │ │
│  │  • Return: annual_generation_gwh, capacity_factor,         │ │
│  │            performance_ratio, p50/p90/p95, monthly_profile │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↓                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  PySAM Core (NREL System Advisor Model)                   │ │
│  │  • PVWatts model (fast, simplified)                        │ │
│  │  • Detailed PV model (physics-based, slower)               │ │
│  │  • Built-in CEC equipment database (20k+ modules/inverters)│ │
│  │  • Weather data integration (TMY, NSRDB, custom)           │ │
│  │  • Financial calculations (LCOE, NPV, IRR)                 │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              External Data Sources (Free APIs)                   │
│  • PVGIS (EU Joint Research Centre) - Global solar resource     │
│  • NASA POWER - Global meteorological data                      │
│  • Future: Solcast (paid) - High-resolution forecasts           │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

**Stage 1: Document Processing (Existing)**
1. User uploads project documents (IM, DD Pack, Grid Study, Technical Specifications)
2. System extracts text and generates structured insights
3. Insights stored in per-project database with reconciliation

**Stage 2: Technical Parameter Extraction (New)**
1. System scans insights for technical parameters:
   - Module specifications (manufacturer, model, rated power, efficiency, temp coefficients)
   - Inverter specifications (manufacturer, model, efficiency curve, voltage ratings)
   - Array design (DC capacity, AC capacity, tilt, azimuth, tracking type)
   - Loss assumptions (soiling, wiring, transformer, availability)
   - Location (latitude, longitude, elevation)
   - Contractor performance claims (annual GWh, capacity factor, performance ratio)

2. For missing parameters, system applies defaults:
   - **Equipment specs**: Query Equipment Knowledge Base (future) or PySAM CEC database
   - **Loss factors**: Apply PVsyst defaults based on climate zone and technology
   - **Weather data**: Fetch PVGIS satellite data for location

3. Track provenance for every parameter:
   ```json
   {
     "module_efficiency": {
       "value": 0.213,
       "source": "extracted",
       "confidence": 0.95,
       "source_document": "Technical Specifications v2.3",
       "source_page": 12
     },
     "soiling_loss_annual": {
       "value": 0.02,
       "source": "assumed",
       "assumption_basis": "PVsyst default for semi-arid climate",
       "confidence": 0.60
     }
   }
   ```

**Stage 3: Performance Validation (New)**
1. System builds PySAM input schema with all parameters and provenance
2. Calls Solar Analyzer API: `POST /api/v1/performance/estimate`
3. Solar Analyzer:
   - Validates input schema
   - Fetches weather data (PVGIS or uploaded TMY)
   - Configures PySAM model (PVWatts for speed, Detailed PV for accuracy)
   - Runs annual simulation
   - Returns performance metrics

4. System compares results:
   ```
   Contractor Claim:     250 GWh/year (CF: 28.5%)
   Independent Estimate: 235 GWh/year (CF: 26.8%)
   Variance:            +6.4% (contractor optimistic)
   Confidence:          Medium (40% parameters assumed)
   ```

5. If variance exceeds threshold (e.g., >10%), create red flag:
   ```
   SEVERITY: High
   CATEGORY: Technical - Performance Claims
   TITLE: Contractor generation estimate 6.4% above independent calculation
   DESCRIPTION: Contractor claims 250 GWh/year, but independent PySAM 
                calculation using PVGIS weather data estimates 235 GWh/year.
                Discrepancy may be due to optimistic loss assumptions or 
                weather data differences.
   EVIDENCE: 
     - Contractor claim: Technical Specifications v2.3, page 45
     - Independent calculation: PySAM PVWatts model with PVGIS weather
     - Confidence: Medium (40% parameters assumed from PVsyst defaults)
   ```

---

## 3. Technical Design

### 3.1 Input Schema

The Solar Analyzer API accepts a comprehensive input schema with assumption tracking:

```typescript
interface PerformanceEstimateRequest {
  // Project identification
  project_id: string;
  calculation_id: string;
  
  // Location
  location: {
    latitude: number;
    longitude: number;
    elevation_m?: number;
    timezone?: string;
  };
  
  // System sizing
  system: {
    dc_capacity_mw: ParameterWithProvenance<number>;
    ac_capacity_mw: ParameterWithProvenance<number>;
    dc_ac_ratio?: ParameterWithProvenance<number>;
  };
  
  // Module specifications
  modules: {
    manufacturer: ParameterWithProvenance<string>;
    model: ParameterWithProvenance<string>;
    rated_power_w: ParameterWithProvenance<number>;
    efficiency_stc: ParameterWithProvenance<number>;
    temp_coeff_pmax: ParameterWithProvenance<number>; // %/°C
    temp_coeff_voc: ParameterWithProvenance<number>;  // %/°C
    degradation_annual: ParameterWithProvenance<number>; // %/year
    bifacial?: ParameterWithProvenance<boolean>;
    bifaciality?: ParameterWithProvenance<number>;
  };
  
  // Inverter specifications
  inverters: {
    manufacturer: ParameterWithProvenance<string>;
    model: ParameterWithProvenance<string>;
    efficiency_euro: ParameterWithProvenance<number>;
    efficiency_cec: ParameterWithProvenance<number>;
    max_ac_power_kw: ParameterWithProvenance<number>;
    vdcmax: ParameterWithProvenance<number>; // V
    mppt_low: ParameterWithProvenance<number>; // V
    mppt_high: ParameterWithProvenance<number>; // V
  };
  
  // Array design
  array: {
    tilt_deg: ParameterWithProvenance<number>;
    azimuth_deg: ParameterWithProvenance<number>; // 0=North, 180=South
    tracking_type: ParameterWithProvenance<'fixed' | 'single_axis' | 'dual_axis'>;
    gcr?: ParameterWithProvenance<number>; // Ground coverage ratio
    axis_tilt?: ParameterWithProvenance<number>; // For single-axis tracking
    max_rotation?: ParameterWithProvenance<number>; // For single-axis tracking
  };
  
  // Loss factors (all as decimal fractions, e.g., 0.02 = 2%)
  losses: {
    soiling_annual: ParameterWithProvenance<number>;
    soiling_monthly?: ParameterWithProvenance<number[]>; // 12 values
    shading: ParameterWithProvenance<number>;
    snow: ParameterWithProvenance<number>;
    mismatch: ParameterWithProvenance<number>;
    dc_wiring: ParameterWithProvenance<number>;
    ac_wiring: ParameterWithProvenance<number>;
    transformer: ParameterWithProvenance<number>;
    availability: ParameterWithProvenance<number>;
    degradation_year1: ParameterWithProvenance<number>;
  };
  
  // Grid connection
  grid: {
    connection_type: ParameterWithProvenance<'grid_tied' | 'off_grid'>;
    curtailment_annual?: ParameterWithProvenance<number>; // Expected curtailment %
    export_limit_mw?: ParameterWithProvenance<number>;
  };
  
  // Weather data
  weather: {
    // Option 1: Use uploaded project data
    project_data?: {
      file_id: string; // Reference to uploaded TMY file
      format: 'tmy2' | 'tmy3' | 'epw' | 'csv';
      source: string; // e.g., "Contractor-provided TMY from Solargis"
    };
    
    // Option 2: Fetch from free API (always included for benchmarking)
    benchmark_data: {
      source: 'pvgis' | 'nasa_power';
      fetch_automatically: boolean;
    };
    
    // Comparison settings
    comparison: {
      flag_if_variance_exceeds_percent: number; // e.g., 10
    };
  };
  
  // Calculation options
  options: {
    model_type: 'pvwatts' | 'detailed_pv'; // PVWatts=fast, Detailed=accurate
    simulation_years: number; // Typically 1 for annual estimate
    timestep_hours: number; // 1 or 0.5 for hourly/30-min resolution
    calculate_exceedance: boolean; // Calculate P50/P90/P95
    calculate_monthly_profile: boolean;
  };
  
  // Contractor claims (for comparison)
  contractor_claims?: {
    annual_generation_gwh: number;
    capacity_factor_percent: number;
    performance_ratio_percent: number;
    source_document: string;
    source_page?: number;
  };
}

// Generic parameter with provenance tracking
interface ParameterWithProvenance<T> {
  value: T;
  source: 'extracted' | 'assumed' | 'knowledge_base' | 'web_search' | 'user_input';
  confidence: number; // 0.0 to 1.0
  assumption_basis?: string; // e.g., "PVsyst default for mono-Si modules"
  source_document?: string;
  source_page?: number;
}
```

### 3.2 Output Schema

```typescript
interface PerformanceEstimateResponse {
  calculation_id: string;
  timestamp: string; // ISO 8601
  status: 'success' | 'error';
  
  // Performance results
  results: {
    annual_generation_gwh: number;
    capacity_factor_percent: number;
    performance_ratio_percent: number;
    specific_yield_kwh_kwp: number;
    
    // Exceedance probabilities (if requested)
    exceedance?: {
      p50_gwh: number; // 50% probability of exceeding
      p75_gwh: number;
      p90_gwh: number;
      p95_gwh: number;
      p99_gwh: number;
    };
    
    // Monthly profile (if requested)
    monthly_profile?: Array<{
      month: number; // 1-12
      generation_gwh: number;
      capacity_factor_percent: number;
      poa_irradiation_kwh_m2: number;
    }>;
    
    // Weather data summary
    weather_summary: {
      ghi_annual_kwh_m2: number;
      poa_annual_kwh_m2: number;
      ambient_temp_avg_c: number;
      source: string; // "PVGIS satellite data 2005-2020" or "Uploaded TMY file"
    };
  };
  
  // Comparison with contractor claims (if provided)
  comparison?: {
    contractor_claim_gwh: number;
    independent_estimate_gwh: number;
    variance_percent: number; // Positive = contractor optimistic
    variance_gwh: number;
    flag_triggered: boolean; // True if variance exceeds threshold
    confidence_level: 'high' | 'medium' | 'low'; // Based on % assumed parameters
  };
  
  // Weather data comparison (project vs benchmark)
  weather_comparison?: {
    project_ghi_kwh_m2: number;
    benchmark_ghi_kwh_m2: number;
    variance_percent: number;
    flag_triggered: boolean;
    benchmark_source: string; // e.g., "PVGIS satellite data"
  };
  
  // Input summary (for audit trail)
  input_summary: {
    dc_capacity_mw: number;
    ac_capacity_mw: number;
    module_model: string;
    inverter_model: string;
    tracking_type: string;
    total_system_losses_percent: number;
    parameters_extracted_count: number;
    parameters_assumed_count: number;
    confidence_score: number; // 0.0 to 1.0
  };
  
  // Warnings and recommendations
  warnings: Array<{
    severity: 'info' | 'warning' | 'error';
    message: string;
    parameter?: string;
  }>;
  
  // Calculation metadata
  metadata: {
    model_used: 'pvwatts' | 'detailed_pv';
    pysam_version: string;
    calculation_time_seconds: number;
    weather_data_source: string;
    weather_data_years: string; // e.g., "2005-2020"
  };
}
```

### 3.3 Assumption Tracking System

**Confidence Scoring Algorithm:**

```typescript
function calculateConfidenceScore(parameters: ParameterWithProvenance[]): number {
  // Define parameter importance weights
  const weights = {
    critical: 1.0,  // DC capacity, location, module efficiency
    high: 0.8,      // Inverter efficiency, tilt, azimuth, tracking
    medium: 0.5,    // Loss factors, degradation
    low: 0.2        // Optional parameters
  };
  
  let totalWeight = 0;
  let extractedWeight = 0;
  
  for (const param of parameters) {
    const weight = getParameterWeight(param.name);
    totalWeight += weight;
    
    if (param.source === 'extracted') {
      extractedWeight += weight * param.confidence;
    } else if (param.source === 'knowledge_base') {
      extractedWeight += weight * 0.8; // Knowledge base is reliable but not project-specific
    } else if (param.source === 'assumed') {
      extractedWeight += weight * 0.5; // Assumptions have moderate confidence
    }
  }
  
  return extractedWeight / totalWeight;
}

function getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.80) return 'high';   // 80%+ critical parameters extracted
  if (score >= 0.60) return 'medium'; // 60-80% extracted
  return 'low';                        // <60% extracted
}
```

**Parameter Importance Classification:**

| Parameter | Importance | Rationale |
|-----------|-----------|-----------|
| DC Capacity | Critical | Directly scales output |
| Location (lat/lon) | Critical | Determines solar resource |
| Module Efficiency | Critical | Core performance driver |
| Inverter Efficiency | High | 2-3% impact on output |
| Tilt/Azimuth | High | 5-15% impact depending on location |
| Tracking Type | High | 20-30% impact if single-axis |
| Soiling Loss | Medium | 2-5% impact, highly variable |
| DC Wiring Loss | Medium | 1-2% impact |
| Availability | Medium | 1-3% impact |
| Degradation | Medium | Long-term impact only |
| Bifaciality | Low | 5-10% gain if applicable |
| Snow Loss | Low | Location-dependent |

### 3.4 Weather Data Strategy

**Dual-Source Approach:**

1. **Project Data (Primary)**: If contractor provides TMY file, use it as primary source
2. **Benchmark Data (Always Fetch)**: Always fetch PVGIS data for comparison

**Comparison Logic:**

```python
def compare_weather_data(project_ghi: float, benchmark_ghi: float) -> dict:
    """
    Compare project weather data against free API benchmark.
    
    Args:
        project_ghi: Annual GHI from contractor TMY (kWh/m²)
        benchmark_ghi: Annual GHI from PVGIS (kWh/m²)
    
    Returns:
        Comparison results with flag if variance exceeds threshold
    """
    variance_percent = ((project_ghi - benchmark_ghi) / benchmark_ghi) * 100
    
    flag_triggered = abs(variance_percent) > 10  # Configurable threshold
    
    return {
        'project_ghi_kwh_m2': project_ghi,
        'benchmark_ghi_kwh_m2': benchmark_ghi,
        'variance_percent': variance_percent,
        'flag_triggered': flag_triggered,
        'interpretation': get_interpretation(variance_percent)
    }

def get_interpretation(variance: float) -> str:
    """Provide human-readable interpretation of weather data variance."""
    if abs(variance) < 5:
        return "Weather data closely matches satellite benchmark (within 5%)"
    elif variance > 10:
        return "Contractor weather data is significantly more optimistic than satellite data"
    elif variance < -10:
        return "Contractor weather data is significantly more conservative than satellite data"
    else:
        return "Weather data shows moderate variance from satellite benchmark"
```

**PVGIS API Integration:**

```python
import requests

def fetch_pvgis_data(latitude: float, longitude: float) -> dict:
    """
    Fetch annual solar resource data from PVGIS API.
    
    PVGIS provides free satellite-derived solar radiation data globally
    from 2005-2020 (SARAH2 database for Europe/Africa, NSRDB for Americas).
    
    API Documentation: https://joint-research-centre.ec.europa.eu/pvgis_en
    """
    url = "https://re.jrc.ec.europa.eu/api/v5_2/seriescalc"
    
    params = {
        'lat': latitude,
        'lon': longitude,
        'outputformat': 'json',
        'startyear': 2005,
        'endyear': 2020,
        'pvcalculation': 1,  # Request PV calculation
        'peakpower': 1,      # 1 kWp for normalization
        'loss': 0,           # No losses (we'll apply our own)
        'angle': 0,          # Will be overridden by actual tilt
        'aspect': 0          # Will be overridden by actual azimuth
    }
    
    response = requests.get(url, params=params, timeout=30)
    response.raise_for_status()
    
    data = response.json()
    
    # Extract annual GHI and POA irradiation
    annual_ghi = sum(month['H(h)_m'] for month in data['outputs']['monthly']['fixed'])
    
    return {
        'ghi_annual_kwh_m2': annual_ghi,
        'source': 'PVGIS SARAH2 satellite data 2005-2020',
        'data_quality': 'satellite_derived',
        'uncertainty_percent': 5  # Typical PVGIS uncertainty
    }
```

---

## 4. Equipment Knowledge Base

### 4.1 Data Sources

**Phase 1 (Immediate): Use PySAM Built-in Database**
- **CEC Module Database**: 20,000+ PV modules with full electrical specifications
- **CEC Inverter Database**: 5,000+ inverters with efficiency curves
- **Source**: California Energy Commission (CEC) certification database
- **Access**: Via PySAM Python API (`PySAM.CEC_Modules`, `PySAM.CEC_Inverters`)

**Phase 2 (Future): Build Custom Equipment Database**
- **Purpose**: Regional equipment not in CEC database, custom specifications
- **Schema**:
  ```sql
  CREATE TABLE equipment_modules (
    id INTEGER PRIMARY KEY,
    manufacturer TEXT NOT NULL,
    model TEXT NOT NULL,
    rated_power_w REAL NOT NULL,
    efficiency_stc REAL NOT NULL,
    temp_coeff_pmax REAL NOT NULL,
    temp_coeff_voc REAL NOT NULL,
    voc REAL NOT NULL,
    isc REAL NOT NULL,
    vmpp REAL NOT NULL,
    impp REAL NOT NULL,
    degradation_annual REAL DEFAULT 0.005,
    bifacial BOOLEAN DEFAULT 0,
    bifaciality REAL,
    technology TEXT, -- mono-Si, poly-Si, CdTe, etc.
    datasheet_url TEXT,
    last_updated TEXT,
    UNIQUE(manufacturer, model)
  );
  
  CREATE TABLE equipment_inverters (
    id INTEGER PRIMARY KEY,
    manufacturer TEXT NOT NULL,
    model TEXT NOT NULL,
    max_ac_power_kw REAL NOT NULL,
    efficiency_euro REAL NOT NULL,
    efficiency_cec REAL NOT NULL,
    vdcmax REAL NOT NULL,
    mppt_low REAL NOT NULL,
    mppt_high REAL NOT NULL,
    mppt_channels INTEGER,
    datasheet_url TEXT,
    last_updated TEXT,
    UNIQUE(manufacturer, model)
  );
  ```

**Phase 3 (Future): Web Scraping Fallback**
- If equipment not found in CEC or custom database, scrape manufacturer websites
- Extract specifications from PDF datasheets using LLM
- Store in custom database for future use

### 4.2 Lookup Strategy

```python
def get_module_specs(manufacturer: str, model: str) -> dict:
    """
    Retrieve module specifications with fallback strategy.
    
    Priority:
    1. PySAM CEC database (most reliable)
    2. Custom equipment database (if built)
    3. Web scraping (last resort)
    4. Generic defaults by technology type
    """
    # Try PySAM CEC database first
    try:
        cec_module = PySAM.CEC_Modules.get_module(manufacturer, model)
        return {
            'source': 'knowledge_base',
            'database': 'CEC',
            'confidence': 0.95,
            **cec_module
        }
    except KeyError:
        pass
    
    # Try custom database (future)
    custom_spec = query_custom_database(manufacturer, model)
    if custom_spec:
        return {
            'source': 'knowledge_base',
            'database': 'custom',
            'confidence': 0.85,
            **custom_spec
        }
    
    # Try web scraping (future)
    scraped_spec = scrape_manufacturer_website(manufacturer, model)
    if scraped_spec:
        return {
            'source': 'web_search',
            'confidence': 0.70,
            **scraped_spec
        }
    
    # Fall back to generic defaults
    return get_generic_defaults_by_technology('mono-Si')
```

---

## 5. Loss Factor Defaults

### 5.1 PVsyst Standard Loss Factors

PVsyst is the industry-standard software for solar PV simulation. Its default loss factors are widely accepted by developers, lenders, and insurers.

| Loss Category | PVsyst Default | Range | Notes |
|---------------|----------------|-------|-------|
| **Soiling** | 2% annual | 1-8% | Highly site-specific; 1% for frequently cleaned, 8% for desert with no cleaning |
| **Shading** | 0-3% | 0-20% | Depends on terrain and nearby obstructions |
| **Snow** | 0-5% | 0-20% | Location-dependent; 0% for tropical, 5%+ for northern latitudes |
| **Mismatch** | 2% | 1-3% | Module parameter variation |
| **DC Wiring** | 1.5% | 1-2% | Resistive losses in DC cables |
| **AC Wiring** | 1% | 0.5-1.5% | Resistive losses in AC cables |
| **Transformer** | 1% | 0.5-2% | Transformer losses (if present) |
| **Availability** | 2% | 1-3% | Downtime for maintenance, grid outages |
| **Degradation (Year 1)** | 2% | 1-3% | Light-induced degradation in first year |
| **Degradation (Annual)** | 0.5% | 0.3-0.7% | Annual degradation after Year 1 |

**Total System Losses**: Typically 10-15% combined (not additive; calculated as cascading losses)

### 5.2 Climate-Specific Adjustments

```python
LOSS_DEFAULTS_BY_CLIMATE = {
    'tropical': {
        'soiling': 0.03,  # High humidity, frequent rain
        'snow': 0.0,
        'availability': 0.02
    },
    'arid': {
        'soiling': 0.05,  # Dust accumulation, infrequent rain
        'snow': 0.0,
        'availability': 0.02
    },
    'temperate': {
        'soiling': 0.02,
        'snow': 0.01,
        'availability': 0.02
    },
    'cold': {
        'soiling': 0.015,  # Snow cleans panels
        'snow': 0.05,
        'availability': 0.025  # Higher maintenance needs
    }
}

def get_climate_zone(latitude: float) -> str:
    """Classify climate zone by latitude (simplified)."""
    abs_lat = abs(latitude)
    if abs_lat < 23.5:
        return 'tropical'
    elif abs_lat < 35:
        return 'arid'  # Subtropical, often arid
    elif abs_lat < 50:
        return 'temperate'
    else:
        return 'cold'
```

---

## 6. PySAM Integration

### 6.1 Why PySAM?

**NREL System Advisor Model (SAM)** is the industry-standard tool for renewable energy performance and financial modeling. PySAM is the official Python wrapper.

**Advantages over custom IEC 61724 implementation:**

| Feature | Custom IEC 61724 | PySAM |
|---------|------------------|-------|
| **Equipment Database** | None (manual entry) | 20,000+ modules, 5,000+ inverters |
| **Calculation Engine** | Simplified physics | Full physics-based model |
| **Weather Integration** | Manual TMY upload | NSRDB, TMY2/3, EPW, SAM CSV |
| **Validation** | Custom implementation | NREL-validated, peer-reviewed |
| **Industry Acceptance** | Low (custom tool) | High (used by banks, insurers) |
| **Maintenance** | Custom (us) | NREL (active development) |
| **Financial Modeling** | None | LCOE, NPV, IRR, PPA pricing |
| **Exceedance (P50/P90)** | Manual calculation | Built-in Monte Carlo |
| **Model Complexity** | Single model | PVWatts (fast) + Detailed PV (accurate) |

**Decision: Use PySAM for all performance calculations**

### 6.2 PySAM Model Selection

PySAM provides two PV models:

**PVWatts (Recommended for API)**
- **Speed**: 10-50ms per simulation
- **Accuracy**: ±5% for typical systems
- **Inputs**: Simplified (DC capacity, module type, array type, losses)
- **Use Case**: Quick estimates, API endpoints, bulk calculations
- **Limitations**: No detailed inverter modeling, simplified temperature model

**Detailed PV Model**
- **Speed**: 100-500ms per simulation
- **Accuracy**: ±2% for typical systems
- **Inputs**: Detailed (full module I-V curve, inverter efficiency curve, string layout)
- **Use Case**: Final investment decisions, detailed engineering
- **Limitations**: Slower, requires more input parameters

**Recommendation**: Use **PVWatts** for API endpoint to ensure fast response times (<1 second). Provide option to run Detailed PV model for high-stakes projects.

### 6.3 PySAM Implementation Example

```python
import PySAM.Pvwattsv8 as PVWatts
import PySAM.ResourceTools as tools

def calculate_performance_pysam(input_data: dict) -> dict:
    """
    Calculate solar farm performance using PySAM PVWatts model.
    
    Args:
        input_data: Performance estimate request (see schema above)
    
    Returns:
        Performance estimate response (see schema above)
    """
    # Initialize PVWatts model
    model = PVWatts.default("PVWattsNone")
    
    # Set location
    model.SolarResource.solar_resource_file = get_weather_file(input_data['weather'])
    
    # Set system specifications
    model.SystemDesign.system_capacity = input_data['system']['dc_capacity_mw']['value'] * 1000  # Convert to kW
    model.SystemDesign.dc_ac_ratio = input_data['system']['dc_ac_ratio']['value']
    model.SystemDesign.inv_eff = input_data['inverters']['efficiency_cec']['value'] * 100  # Convert to %
    model.SystemDesign.tilt = input_data['array']['tilt_deg']['value']
    model.SystemDesign.azimuth = input_data['array']['azimuth_deg']['value']
    
    # Set tracking
    tracking_type = input_data['array']['tracking_type']['value']
    if tracking_type == 'fixed':
        model.SystemDesign.array_type = 0
    elif tracking_type == 'single_axis':
        model.SystemDesign.array_type = 2
        model.SystemDesign.gcr = input_data['array']['gcr']['value']
    elif tracking_type == 'dual_axis':
        model.SystemDesign.array_type = 4
    
    # Set module type (affects temperature model)
    model.SystemDesign.module_type = 0  # 0=Standard, 1=Premium, 2=Thin film
    
    # Set losses (PVWatts uses a single combined loss percentage)
    total_losses = calculate_total_losses(input_data['losses'])
    model.SystemDesign.losses = total_losses * 100  # Convert to %
    
    # Run simulation
    model.execute()
    
    # Extract results
    annual_energy_kwh = sum(model.Outputs.ac)  # Hourly AC output
    annual_energy_gwh = annual_energy_kwh / 1_000_000
    
    dc_capacity_kw = input_data['system']['dc_capacity_mw']['value'] * 1000
    capacity_factor = (annual_energy_kwh / (dc_capacity_kw * 8760)) * 100
    
    # Calculate performance ratio
    poa_irradiation_kwh_m2 = sum(model.Outputs.poa) / 1000  # Convert Wh to kWh
    reference_yield = poa_irradiation_kwh_m2 / 1.0  # kWh/m² / 1.0 kW/m² = hours
    final_yield = annual_energy_kwh / dc_capacity_kw  # kWh / kW = hours
    performance_ratio = (final_yield / reference_yield) * 100
    
    # Compare with contractor claims (if provided)
    comparison = None
    if 'contractor_claims' in input_data:
        contractor_gwh = input_data['contractor_claims']['annual_generation_gwh']
        variance_gwh = contractor_gwh - annual_energy_gwh
        variance_percent = (variance_gwh / annual_energy_gwh) * 100
        
        comparison = {
            'contractor_claim_gwh': contractor_gwh,
            'independent_estimate_gwh': annual_energy_gwh,
            'variance_percent': variance_percent,
            'variance_gwh': variance_gwh,
            'flag_triggered': abs(variance_percent) > 10,
            'confidence_level': calculate_confidence_level(input_data)
        }
    
    return {
        'calculation_id': input_data['calculation_id'],
        'timestamp': datetime.utcnow().isoformat(),
        'status': 'success',
        'results': {
            'annual_generation_gwh': annual_energy_gwh,
            'capacity_factor_percent': capacity_factor,
            'performance_ratio_percent': performance_ratio,
            'specific_yield_kwh_kwp': final_yield,
            'weather_summary': {
                'ghi_annual_kwh_m2': sum(model.Outputs.gh) / 1000,
                'poa_annual_kwh_m2': poa_irradiation_kwh_m2,
                'ambient_temp_avg_c': sum(model.Outputs.tdry) / len(model.Outputs.tdry),
                'source': get_weather_source_description(input_data['weather'])
            }
        },
        'comparison': comparison,
        'input_summary': build_input_summary(input_data),
        'metadata': {
            'model_used': 'pvwatts',
            'pysam_version': PVWatts.__version__,
            'calculation_time_seconds': 0.05,  # Typical PVWatts speed
            'weather_data_source': get_weather_source_description(input_data['weather'])
        }
    }

def calculate_total_losses(losses: dict) -> float:
    """
    Calculate total system losses as cascading losses (not additive).
    
    Example: 2% soiling + 1.5% wiring = 1 - (0.98 * 0.985) = 3.47% total
    """
    total_factor = 1.0
    
    for loss_name, loss_param in losses.items():
        loss_value = loss_param['value']
        total_factor *= (1 - loss_value)
    
    total_loss = 1 - total_factor
    return total_loss
```

---

## 7. API Endpoint Implementation

### 7.1 FastAPI Endpoint

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
import PySAM.Pvwattsv8 as PVWatts

app = FastAPI(title="Solar Analyzer API", version="2.0.0")

# (Input/Output schemas defined in section 3.1 and 3.2)

@app.post("/api/v1/performance/estimate", response_model=PerformanceEstimateResponse)
async def estimate_performance(request: PerformanceEstimateRequest):
    """
    Calculate solar farm performance using NREL PySAM.
    
    This endpoint validates contractor performance claims by running an
    independent calculation using industry-standard PySAM models, PVGIS
    weather data, and PVsyst loss factors.
    
    Returns:
        Performance metrics (annual GWh, capacity factor, P50/P90) with
        comparison to contractor claims and confidence scoring.
    """
    try:
        # Validate input
        validate_input(request)
        
        # Fetch weather data (PVGIS or uploaded TMY)
        weather_file = prepare_weather_data(request.weather, request.location)
        
        # Run PySAM calculation
        results = calculate_performance_pysam(request)
        
        # Compare weather data if both sources available
        weather_comparison = None
        if request.weather.project_data and request.weather.benchmark_data.fetch_automatically:
            weather_comparison = compare_weather_sources(
                project_file=weather_file['project'],
                benchmark_file=weather_file['benchmark']
            )
        
        # Build response
        response = PerformanceEstimateResponse(
            calculation_id=request.calculation_id,
            timestamp=datetime.utcnow().isoformat(),
            status='success',
            results=results['results'],
            comparison=results.get('comparison'),
            weather_comparison=weather_comparison,
            input_summary=build_input_summary(request),
            warnings=results.get('warnings', []),
            metadata=results['metadata']
        )
        
        return response
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "pysam_version": PVWatts.__version__,
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/api/v1/equipment/modules/search")
async def search_modules(manufacturer: str, model: Optional[str] = None):
    """
    Search CEC module database.
    
    Args:
        manufacturer: Module manufacturer name (partial match)
        model: Optional model name filter
    
    Returns:
        List of matching modules with specifications
    """
    # Query PySAM CEC database
    modules = PySAM.CEC_Modules.search(manufacturer, model)
    return {"modules": modules}

@app.get("/api/v1/equipment/inverters/search")
async def search_inverters(manufacturer: str, model: Optional[str] = None):
    """Search CEC inverter database."""
    inverters = PySAM.CEC_Inverters.search(manufacturer, model)
    return {"inverters": inverters}
```

### 7.2 Deployment

**Option 1: Extend Existing Solar Analyzer**
- Add new endpoint to `/home/ubuntu/MCE-tools/tools/performance-assessment/backend/`
- Reuse existing FastAPI app structure
- Install PySAM: `pip install NREL-PySAM`

**Option 2: Standalone Microservice**
- Create new FastAPI app in `/home/ubuntu/MCE-tools/tools/pysam-api/`
- Deploy separately on different port
- Allows independent scaling and versioning

**Recommendation**: Option 1 (extend existing Solar Analyzer) for simplicity and code reuse.

---

## 8. Integration with Ingestion Engine

### 8.1 Solar Analyzer Client

Create a client in the ingestion engine to call the Solar Analyzer API:

```typescript
// server/solar-analyzer-client.ts

import { invokeLLM } from './_core/llm';

interface SolarAnalyzerRequest {
  projectId: number;
  projectDbName: string;
  insights: Array<{ key: string; value: string; confidence: number }>;
}

interface SolarAnalyzerResult {
  calculationId: string;
  annualGenerationGwh: number;
  capacityFactorPercent: number;
  performanceRatioPercent: number;
  comparison?: {
    contractorClaimGwh: number;
    independentEstimateGwh: number;
    variancePercent: number;
    flagTriggered: boolean;
    confidenceLevel: 'high' | 'medium' | 'low';
  };
  inputSummary: {
    parametersExtractedCount: number;
    parametersAssumedCount: number;
    confidenceScore: number;
  };
}

export async function validatePerformance(
  request: SolarAnalyzerRequest
): Promise<SolarAnalyzerResult> {
  console.log(`[Solar Analyzer] Starting performance validation for project ${request.projectId}`);
  
  // Step 1: Extract technical parameters from insights
  const technicalParams = await extractTechnicalParameters(request.insights);
  
  // Step 2: Fill gaps with assumptions
  const completeParams = await fillParameterGaps(technicalParams);
  
  // Step 3: Build PySAM input schema
  const pySamInput = buildPySamInput(completeParams);
  
  // Step 4: Call Solar Analyzer API
  const response = await fetch('http://localhost:8000/api/v1/performance/estimate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pySamInput)
  });
  
  if (!response.ok) {
    throw new Error(`Solar Analyzer API error: ${response.statusText}`);
  }
  
  const result = await response.json();
  
  // Step 5: Store results in database
  await storePerformanceResults(request.projectDbName, result);
  
  // Step 6: Create red flags if discrepancies detected
  if (result.comparison?.flag_triggered) {
    await createPerformanceRedFlag(request.projectDbName, result);
  }
  
  console.log(`[Solar Analyzer] Validation complete: ${result.results.annual_generation_gwh} GWh/year`);
  
  return {
    calculationId: result.calculation_id,
    annualGenerationGwh: result.results.annual_generation_gwh,
    capacityFactorPercent: result.results.capacity_factor_percent,
    performanceRatioPercent: result.results.performance_ratio_percent,
    comparison: result.comparison,
    inputSummary: result.input_summary
  };
}

async function extractTechnicalParameters(insights: any[]): Promise<any> {
  /**
   * Use LLM to extract technical parameters from insights.
   * 
   * Example insights:
   * - "The project will use Longi LR5-72HPH-550M modules with 21.3% efficiency"
   * - "Total DC capacity is 100 MWdc with 80 MWac inverter capacity"
   * - "Single-axis tracking with 20-degree tilt limitation"
   * 
   * Extract structured parameters:
   * - module_manufacturer: "Longi"
   * - module_model: "LR5-72HPH-550M"
   * - module_efficiency: 0.213
   * - dc_capacity_mw: 100
   * - ac_capacity_mw: 80
   * - tracking_type: "single_axis"
   */
  
  const technicalInsights = insights.filter(i => 
    i.key === 'Technical_Design' || i.key === 'Engineering_Assumptions'
  );
  
  const prompt = `
Extract technical parameters for solar farm performance modeling from these insights:

${technicalInsights.map(i => `- ${i.value}`).join('\n')}

Extract the following parameters (mark as null if not found):
- Location: latitude, longitude
- System: dc_capacity_mw, ac_capacity_mw
- Modules: manufacturer, model, rated_power_w, efficiency_stc
- Inverters: manufacturer, model, efficiency_cec
- Array: tilt_deg, azimuth_deg, tracking_type (fixed/single_axis/dual_axis)
- Losses: soiling_annual, availability, degradation_annual
- Contractor Claims: annual_generation_gwh, capacity_factor_percent

Return as JSON with confidence scores (0.0-1.0) for each extracted parameter.
`;

  const response = await invokeLLM({
    messages: [
      { role: 'system', content: 'You are a technical parameter extraction specialist for solar energy projects.' },
      { role: 'user', content: prompt }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'technical_parameters',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            location: {
              type: 'object',
              properties: {
                latitude: { type: ['number', 'null'] },
                longitude: { type: ['number', 'null'] },
                confidence: { type: 'number' }
              },
              required: ['latitude', 'longitude', 'confidence']
            },
            system: {
              type: 'object',
              properties: {
                dc_capacity_mw: { type: ['number', 'null'] },
                ac_capacity_mw: { type: ['number', 'null'] },
                confidence: { type: 'number' }
              },
              required: ['dc_capacity_mw', 'ac_capacity_mw', 'confidence']
            },
            // ... (full schema for all parameters)
          },
          required: ['location', 'system']
        }
      }
    }
  });
  
  return JSON.parse(response.choices[0].message.content);
}

async function fillParameterGaps(params: any): Promise<any> {
  /**
   * Fill missing parameters with industry defaults.
   * Track provenance for each parameter.
   */
  
  const completeParams = { ...params };
  
  // Fill module specs from PySAM database (if manufacturer/model known)
  if (params.modules.manufacturer && params.modules.model) {
    const moduleSpecs = await queryPySamModuleDatabase(
      params.modules.manufacturer,
      params.modules.model
    );
    
    if (moduleSpecs) {
      completeParams.modules = {
        ...params.modules,
        ...moduleSpecs,
        source: 'knowledge_base',
        confidence: 0.90
      };
    }
  }
  
  // Fill loss factors with PVsyst defaults
  if (!params.losses.soiling_annual) {
    const climateZone = getClimateZone(params.location.latitude);
    completeParams.losses.soiling_annual = {
      value: LOSS_DEFAULTS_BY_CLIMATE[climateZone].soiling,
      source: 'assumed',
      assumption_basis: `PVsyst default for ${climateZone} climate`,
      confidence: 0.60
    };
  }
  
  // Fill tracking defaults
  if (!params.array.tracking_type) {
    completeParams.array.tracking_type = {
      value: 'fixed',
      source: 'assumed',
      assumption_basis: 'Default to fixed-tilt if not specified',
      confidence: 0.50
    };
  }
  
  return completeParams;
}

function buildPySamInput(params: any): any {
  /**
   * Convert extracted parameters to PySAM API input schema.
   */
  
  return {
    project_id: params.projectId,
    calculation_id: `calc_${Date.now()}`,
    location: {
      latitude: params.location.latitude.value,
      longitude: params.location.longitude.value
    },
    system: {
      dc_capacity_mw: {
        value: params.system.dc_capacity_mw.value,
        source: params.system.dc_capacity_mw.source,
        confidence: params.system.dc_capacity_mw.confidence
      },
      ac_capacity_mw: {
        value: params.system.ac_capacity_mw.value,
        source: params.system.ac_capacity_mw.source,
        confidence: params.system.ac_capacity_mw.confidence
      }
    },
    // ... (map all parameters)
    weather: {
      benchmark_data: {
        source: 'pvgis',
        fetch_automatically: true
      },
      comparison: {
        flag_if_variance_exceeds_percent: 10
      }
    },
    options: {
      model_type: 'pvwatts',
      simulation_years: 1,
      timestep_hours: 1,
      calculate_exceedance: false,
      calculate_monthly_profile: true
    },
    contractor_claims: params.contractor_claims ? {
      annual_generation_gwh: params.contractor_claims.annual_generation_gwh,
      capacity_factor_percent: params.contractor_claims.capacity_factor_percent,
      source_document: params.contractor_claims.source_document
    } : undefined
  };
}

async function createPerformanceRedFlag(projectDbName: string, result: any): Promise<void> {
  /**
   * Create a red flag if performance variance exceeds threshold.
   */
  
  const db = await getProjectDb(projectDbName);
  
  const severity = Math.abs(result.comparison.variance_percent) > 15 ? 'critical' : 'high';
  
  const description = `
Contractor claims ${result.comparison.contractor_claim_gwh} GWh/year, but independent 
PySAM calculation estimates ${result.comparison.independent_estimate_gwh} GWh/year 
(${result.comparison.variance_percent > 0 ? '+' : ''}${result.comparison.variance_percent.toFixed(1)}% variance).

Calculation confidence: ${result.input_summary.confidence_level} 
(${result.input_summary.parameters_extracted_count} parameters extracted, 
${result.input_summary.parameters_assumed_count} assumed)

This discrepancy may be due to:
- Optimistic loss assumptions by contractor
- Different weather data sources
- Different modeling approaches

Recommendation: Review contractor's performance model assumptions and weather data source.
`.trim();
  
  await db.execute(`
    INSERT INTO facts (key, value, confidence, verification_status, created_at)
    VALUES (?, ?, ?, ?, ?)
  `, [
    'Risks_And_Issues',
    description,
    result.input_summary.confidence_score,
    'pending',
    new Date().toISOString()
  ]);
  
  console.log(`[Solar Analyzer] Created performance red flag: ${severity} severity`);
}
```

### 8.2 Integration Point in Document Processing

Add performance validation as **Pass 7** in the document processing pipeline:

```typescript
// In server/routers.ts, documents.upload mutation

// ... (existing passes 1-6)

// Step 7: Validate performance claims (if technical insights extracted)
await updateProgress('validating_performance', 95);
console.log(`[Document Processor] Validating performance claims...`);

try {
  const performanceResult = await validatePerformance({
    projectId: projectIdNum,
    projectDbName,
    insights: result.facts
  });
  
  console.log(`[Document Processor] Performance validation complete: ${performanceResult.annualGenerationGwh} GWh/year`);
  
  if (performanceResult.comparison?.flagTriggered) {
    console.log(`[Document Processor] Performance discrepancy detected: ${performanceResult.comparison.variancePercent}%`);
  }
} catch (error) {
  console.error(`[Document Processor] Performance validation failed:`, error);
  // Don't fail the entire pipeline if performance validation fails
}

await updateProgress('completed', 100);
```

---

## 9. User Interface

### 9.1 Performance Validation Results Page

Create a new page `/performance` to display validation results:

```typescript
// client/src/pages/Performance.tsx

export function PerformancePage() {
  const { projectId } = useParams();
  const { data: results, isLoading } = trpc.performance.getResults.useQuery({ projectId });
  
  if (isLoading) return <LoadingSpinner />;
  if (!results) return <EmptyState message="No performance validation results yet" />;
  
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Performance Validation</h1>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Annual Generation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{results.annualGenerationGwh} GWh</div>
            <div className="text-sm text-muted-foreground">Independent Estimate</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Capacity Factor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{results.capacityFactorPercent}%</div>
            <div className="text-sm text-muted-foreground">Annual Average</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Performance Ratio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{results.performanceRatioPercent}%</div>
            <div className="text-sm text-muted-foreground">IEC 61724 Standard</div>
          </CardContent>
        </Card>
      </div>
      
      {/* Comparison with Contractor Claims */}
      {results.comparison && (
        <Card className={results.comparison.flagTriggered ? 'border-orange-500' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {results.comparison.flagTriggered && <AlertTriangle className="text-orange-500" />}
              Comparison with Contractor Claims
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Contractor Claim</div>
                <div className="text-2xl font-bold">{results.comparison.contractorClaimGwh} GWh</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Independent Estimate</div>
                <div className="text-2xl font-bold">{results.comparison.independentEstimateGwh} GWh</div>
              </div>
            </div>
            
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Variance:</span>
                <span className={`text-lg font-bold ${
                  Math.abs(results.comparison.variancePercent) > 10 ? 'text-orange-500' : 'text-green-500'
                }`}>
                  {results.comparison.variancePercent > 0 ? '+' : ''}
                  {results.comparison.variancePercent.toFixed(1)}%
                </span>
              </div>
              
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm font-medium">Confidence:</span>
                <Badge variant={
                  results.comparison.confidenceLevel === 'high' ? 'default' :
                  results.comparison.confidenceLevel === 'medium' ? 'secondary' : 'destructive'
                }>
                  {results.comparison.confidenceLevel}
                </Badge>
              </div>
            </div>
            
            {results.comparison.flagTriggered && (
              <Alert className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Performance Discrepancy Detected</AlertTitle>
                <AlertDescription>
                  The contractor's generation estimate is {Math.abs(results.comparison.variancePercent).toFixed(1)}% 
                  {results.comparison.variancePercent > 0 ? ' higher' : ' lower'} than the independent calculation.
                  Review the contractor's modeling assumptions and weather data source.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Input Summary */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Calculation Inputs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Parameters Extracted</div>
              <div className="text-xl font-bold text-green-600">
                {results.inputSummary.parametersExtractedCount}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Parameters Assumed</div>
              <div className="text-xl font-bold text-orange-600">
                {results.inputSummary.parametersAssumedCount}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Confidence Score</div>
              <div className="text-xl font-bold">
                {(results.inputSummary.confidenceScore * 100).toFixed(0)}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 10. Implementation Roadmap

### Phase 1: Foundation (Week 1)
- [ ] Install PySAM in Solar Analyzer environment
- [ ] Create `/api/v1/performance/estimate` endpoint with basic PVWatts integration
- [ ] Implement PVGIS weather data fetching
- [ ] Test endpoint with manual input (Postman/curl)

### Phase 2: Assumption Tracking (Week 2)
- [ ] Design parameter provenance tracking schema
- [ ] Implement confidence scoring algorithm
- [ ] Add PVsyst default loss factors
- [ ] Create parameter gap-filling logic

### Phase 3: Integration (Week 3)
- [ ] Build Solar Analyzer client in ingestion engine
- [ ] Implement LLM-based technical parameter extraction
- [ ] Integrate performance validation into document processing pipeline
- [ ] Add performance results storage to database

### Phase 4: UI & Red Flags (Week 4)
- [ ] Create Performance Validation page
- [ ] Implement red flag creation for discrepancies
- [ ] Add performance comparison visualizations
- [ ] Build input summary and confidence display

### Phase 5: Testing & Refinement (Week 5)
- [ ] End-to-end testing with real project documents
- [ ] Calibrate confidence scoring thresholds
- [ ] Tune red flag severity classification
- [ ] Performance optimization (caching, async processing)

### Future Enhancements
- [ ] Build custom Equipment Knowledge Base
- [ ] Add Detailed PV model option for high-stakes projects
- [ ] Implement P50/P90/P95 exceedance calculations
- [ ] Add monthly generation profile visualization
- [ ] Support uploaded TMY files (not just PVGIS)
- [ ] Integrate Solcast for higher-resolution weather data
- [ ] Add financial modeling (LCOE, NPV, IRR)

---

## 11. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| **PySAM installation issues** | High | Low | Use conda environment, follow NREL docs |
| **PVGIS API downtime** | Medium | Low | Cache results, implement retry logic, fallback to NASA POWER |
| **Parameter extraction accuracy** | High | Medium | Validate with test documents, tune LLM prompts, add manual override |
| **Performance calculation time** | Medium | Low | Use PVWatts (fast), implement async processing, add timeout |
| **Equipment database gaps** | Medium | Medium | Fall back to generic defaults, implement web scraping |
| **Weather data variance** | Low | High | Always compare project vs benchmark, flag large discrepancies |
| **False positive red flags** | Medium | Medium | Tune thresholds, add confidence levels, allow manual dismissal |

---

## 12. Success Metrics

**Technical Metrics:**
- Performance validation completes in <5 seconds per project
- 80%+ of critical parameters extracted from documents
- <5% error rate in parameter extraction (validated against manual review)
- 95%+ uptime for Solar Analyzer API

**Business Metrics:**
- Reduce time spent on manual performance validation by 80%
- Identify 20%+ of projects with performance claim discrepancies >10%
- Increase TA team confidence in performance estimates
- Enable automated benchmarking across project portfolio

---

## 13. Conclusion

This architecture provides a comprehensive framework for integrating NREL PySAM into the OE Toolkit's Technical Advisory workflow. By leveraging industry-standard calculations, comprehensive assumption tracking, and automated benchmarking, the system will significantly enhance the quality and efficiency of performance validation.

The phased implementation approach allows for incremental delivery of value while maintaining system stability. The use of PySAM (rather than custom IEC 61724 implementation) ensures calculations are trusted by banks, insurers, and developers, increasing the credibility of Technical Advisory outputs.

**Next Steps:**
1. Review and approve architecture
2. Begin Phase 1 implementation (PySAM endpoint)
3. Conduct weekly progress reviews
4. Iterate based on testing feedback

---

**Document Version History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-23 | Manus AI | Initial architecture document |

---

**References:**

- NREL PySAM Documentation: https://nrel-pysam.readthedocs.io/
- PVGIS API Documentation: https://joint-research-centre.ec.europa.eu/pvgis_en
- IEC 61724 Standard: Photovoltaic system performance monitoring
- PVsyst Software: https://www.pvsyst.com/
- CEC Equipment Database: https://www.gosolarcalifornia.org/equipment/
