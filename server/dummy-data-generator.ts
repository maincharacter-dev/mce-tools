import { v4 as uuidv4 } from "uuid";

/**
 * Dummy Data Generator for Project Intake & Ingestion Engine
 * Generates realistic renewable energy project data for testing and demonstration
 */

export interface DummyDocument {
  id: string;
  fileName: string;
  filePath: string;
  fileSizeBytes: number;
  fileHash: string;
  documentType: string;
  uploadDate: Date;
  status: string;
  extractedText: string;
  pageCount: number;
}

export interface DummyFact {
  id: string;
  category: string;
  key: string;
  value: string;
  dataType: string;
  confidence: number;
  sourceDocumentId: string;
  sourceLocation: string;
  extractionMethod: string;
  extractionModel: string | null;
  verified: boolean;
}

export interface DummyRedFlag {
  id: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  relatedFactIds: string;
  detectionRule: string;
  status: string;
  impact: string;
  recommendation: string;
}

export interface DummyProcessingJob {
  id: number;
  document_id: string;
  status: string;
  stage: string;
  progress_percent: number;
  error_message: string | null;
  started_at: Date;
  completed_at: Date | null;
  estimated_completion: Date | null;
}

export function generateDummyDocuments(): DummyDocument[] {
  const now = new Date();
  
  return [
    {
      id: uuidv4(),
      fileName: "Clare_Solar_Farm_Information_Memorandum_v2.3.pdf",
      filePath: "/dummy/clare_solar_im.pdf",
      fileSizeBytes: 4523000,
      fileHash: "a1b2c3d4e5f6",
      documentType: "IM",
      uploadDate: new Date(now.getTime() - 3600000 * 24 * 2), // 2 days ago
      status: "Processed",
      extractedText: "Clare Solar Farm - 150MW AC Solar PV Project. Located in regional South Australia, 200km north of Adelaide. Grid connection via ElectraNet 132kV substation. Expected COD Q4 2025. Technology: Bifacial modules, single-axis trackers. Capacity: 150MW AC / 200MW DC. Annual generation: 380 GWh. CAPEX estimate: $220M AUD.",
      pageCount: 45,
    },
    {
      id: uuidv4(),
      fileName: "Grid_Connection_Study_ElectraNet_2024.pdf",
      filePath: "/dummy/grid_study.pdf",
      fileSizeBytes: 2100000,
      fileHash: "b2c3d4e5f6g7",
      documentType: "Grid_Study",
      uploadDate: new Date(now.getTime() - 3600000 * 24 * 1), // 1 day ago
      status: "Processed",
      extractedText: "ElectraNet Grid Connection Assessment. Connection point: Robertstown 132kV substation. Available capacity: 120MW (constraint identified). Voltage: 132kV. Distance to connection: 8.2km. Network augmentation required for full 150MW capacity. Estimated cost: $12M. Timeline: 18-24 months. Weak grid area - ESCRI battery nearby.",
      pageCount: 28,
    },
    {
      id: uuidv4(),
      fileName: "Geotechnical_Investigation_Report_Final.pdf",
      filePath: "/dummy/geotech_report.pdf",
      fileSizeBytes: 3200000,
      fileHash: "c3d4e5f6g7h8",
      documentType: "DD_Pack",
      uploadDate: new Date(now.getTime() - 3600000 * 12), // 12 hours ago
      status: "Processed",
      extractedText: "Geotechnical Investigation - Clare Solar Farm Site. Soil type: Sandy clay with rock fragments. Bearing capacity: 150 kPa. Groundwater depth: 4.5m below surface. Corrosivity: Moderate. Foundation recommendation: Driven piles or helical screw anchors. Seismic zone: Low risk. Flood risk: 1-in-100 year event - site elevation adequate.",
      pageCount: 62,
    },
    {
      id: uuidv4(),
      fileName: "Development_Approval_Conditions_SA_Planning.pdf",
      filePath: "/dummy/planning_approval.pdf",
      fileSizeBytes: 1800000,
      fileHash: "d4e5f6g7h8i9",
      documentType: "Other",
      uploadDate: new Date(now.getTime() - 3600000 * 6), // 6 hours ago
      status: "Processing",
      extractedText: "Development Approval - Clare Solar Farm. Approval date: 15 March 2024. Conditions: 1) Glare assessment required, 2) Biodiversity offset plan (12 hectares), 3) Heritage survey - Indigenous consultation required, 4) Noise limits: 35dB(A) at nearest residence...",
      pageCount: 18,
    },
  ];
}

export function generateDummyFacts(documents: DummyDocument[]): DummyFact[] {
  return [
    // Technology facts
    {
      id: uuidv4(),
      category: "Technology",
      key: "solar_module_type",
      value: "Bifacial PV modules",
      dataType: "String",
      confidence: 0.95,
      sourceDocumentId: documents[0].id,
      sourceLocation: "Page 12, Section 3.2",
      extractionMethod: "Ollama_LLM",
      extractionModel: "llama3",
      verified: false,
    },
    {
      id: uuidv4(),
      category: "Technology",
      key: "tracking_system",
      value: "Single-axis trackers",
      dataType: "String",
      confidence: 0.92,
      sourceDocumentId: documents[0].id,
      sourceLocation: "Page 12, Section 3.2",
      extractionMethod: "Deterministic_Regex",
      extractionModel: null,
      verified: false,
    },
    {
      id: uuidv4(),
      category: "Parameter",
      key: "ac_capacity_mw",
      value: "150",
      dataType: "Number",
      confidence: 0.98,
      sourceDocumentId: documents[0].id,
      sourceLocation: "Page 8, Executive Summary",
      extractionMethod: "Deterministic_Regex",
      extractionModel: null,
      verified: true,
    },
    {
      id: uuidv4(),
      category: "Parameter",
      key: "dc_capacity_mw",
      value: "200",
      dataType: "Number",
      confidence: 0.98,
      sourceDocumentId: documents[0].id,
      sourceLocation: "Page 8, Executive Summary",
      extractionMethod: "Deterministic_Regex",
      extractionModel: null,
      verified: true,
    },
    {
      id: uuidv4(),
      category: "Parameter",
      key: "annual_generation_gwh",
      value: "380",
      dataType: "Number",
      confidence: 0.96,
      sourceDocumentId: documents[0].id,
      sourceLocation: "Page 15, Section 4.1",
      extractionMethod: "Deterministic_Regex",
      extractionModel: null,
      verified: false,
    },
    {
      id: uuidv4(),
      category: "Parameter",
      key: "capex_estimate_aud",
      value: "220000000",
      dataType: "Number",
      confidence: 0.94,
      sourceDocumentId: documents[0].id,
      sourceLocation: "Page 22, Section 6.3",
      extractionMethod: "Deterministic_Regex",
      extractionModel: null,
      verified: false,
    },
    {
      id: uuidv4(),
      category: "Parameter",
      key: "expected_cod",
      value: "2025-12-31",
      dataType: "Date",
      confidence: 0.89,
      sourceDocumentId: documents[0].id,
      sourceLocation: "Page 10, Project Timeline",
      extractionMethod: "Ollama_LLM",
      extractionModel: "llama3",
      verified: false,
    },
    // Grid connection facts
    {
      id: uuidv4(),
      category: "Dependency",
      key: "grid_connection_point",
      value: "Robertstown 132kV substation",
      dataType: "String",
      confidence: 0.97,
      sourceDocumentId: documents[1].id,
      sourceLocation: "Page 3, Section 1.2",
      extractionMethod: "Ollama_LLM",
      extractionModel: "llama3",
      verified: false,
    },
    {
      id: uuidv4(),
      category: "Parameter",
      key: "grid_voltage_kv",
      value: "132",
      dataType: "Number",
      confidence: 0.99,
      sourceDocumentId: documents[1].id,
      sourceLocation: "Page 3, Section 1.2",
      extractionMethod: "Deterministic_Regex",
      extractionModel: null,
      verified: true,
    },
    {
      id: uuidv4(),
      category: "Risk",
      key: "grid_available_capacity_mw",
      value: "120",
      dataType: "Number",
      confidence: 0.91,
      sourceDocumentId: documents[1].id,
      sourceLocation: "Page 8, Section 3.1",
      extractionMethod: "Deterministic_Regex",
      extractionModel: null,
      verified: false,
    },
    {
      id: uuidv4(),
      category: "Risk",
      key: "network_augmentation_required",
      value: "true",
      dataType: "Boolean",
      confidence: 0.88,
      sourceDocumentId: documents[1].id,
      sourceLocation: "Page 9, Section 3.2",
      extractionMethod: "Ollama_LLM",
      extractionModel: "llama3",
      verified: false,
    },
    {
      id: uuidv4(),
      category: "Parameter",
      key: "network_augmentation_cost_aud",
      value: "12000000",
      dataType: "Number",
      confidence: 0.85,
      sourceDocumentId: documents[1].id,
      sourceLocation: "Page 10, Section 3.3",
      extractionMethod: "Deterministic_Regex",
      extractionModel: null,
      verified: false,
    },
    {
      id: uuidv4(),
      category: "Dependency",
      key: "network_augmentation_timeline",
      value: "18-24 months",
      dataType: "String",
      confidence: 0.87,
      sourceDocumentId: documents[1].id,
      sourceLocation: "Page 10, Section 3.3",
      extractionMethod: "Ollama_LLM",
      extractionModel: "llama3",
      verified: false,
    },
    {
      id: uuidv4(),
      category: "Risk",
      key: "weak_grid_area",
      value: "true",
      dataType: "Boolean",
      confidence: 0.82,
      sourceDocumentId: documents[1].id,
      sourceLocation: "Page 12, Section 4.1",
      extractionMethod: "Ollama_LLM",
      extractionModel: "llama3",
      verified: false,
    },
    // Geotechnical facts
    {
      id: uuidv4(),
      category: "Parameter",
      key: "soil_type",
      value: "Sandy clay with rock fragments",
      dataType: "String",
      confidence: 0.94,
      sourceDocumentId: documents[2].id,
      sourceLocation: "Page 15, Section 4.2",
      extractionMethod: "Ollama_LLM",
      extractionModel: "llama3",
      verified: false,
    },
    {
      id: uuidv4(),
      category: "Parameter",
      key: "bearing_capacity_kpa",
      value: "150",
      dataType: "Number",
      confidence: 0.96,
      sourceDocumentId: documents[2].id,
      sourceLocation: "Page 18, Section 5.1",
      extractionMethod: "Deterministic_Regex",
      extractionModel: null,
      verified: false,
    },
    {
      id: uuidv4(),
      category: "Parameter",
      key: "groundwater_depth_m",
      value: "4.5",
      dataType: "Number",
      confidence: 0.93,
      sourceDocumentId: documents[2].id,
      sourceLocation: "Page 22, Section 6.3",
      extractionMethod: "Deterministic_Regex",
      extractionModel: null,
      verified: false,
    },
    {
      id: uuidv4(),
      category: "Assumption",
      key: "foundation_type",
      value: "Driven piles or helical screw anchors",
      dataType: "String",
      confidence: 0.89,
      sourceDocumentId: documents[2].id,
      sourceLocation: "Page 35, Section 8.2",
      extractionMethod: "Ollama_LLM",
      extractionModel: "llama3",
      verified: false,
    },
    // Planning facts
    {
      id: uuidv4(),
      category: "Dependency",
      key: "development_approval_date",
      value: "2024-03-15",
      dataType: "Date",
      confidence: 0.97,
      sourceDocumentId: documents[3].id,
      sourceLocation: "Page 1, Header",
      extractionMethod: "Deterministic_Regex",
      extractionModel: null,
      verified: false,
    },
    {
      id: uuidv4(),
      category: "Dependency",
      key: "biodiversity_offset_required_ha",
      value: "12",
      dataType: "Number",
      confidence: 0.91,
      sourceDocumentId: documents[3].id,
      sourceLocation: "Page 4, Condition 2",
      extractionMethod: "Deterministic_Regex",
      extractionModel: null,
      verified: false,
    },
    {
      id: uuidv4(),
      category: "Dependency",
      key: "indigenous_consultation_required",
      value: "true",
      dataType: "Boolean",
      confidence: 0.88,
      sourceDocumentId: documents[3].id,
      sourceLocation: "Page 5, Condition 3",
      extractionMethod: "Ollama_LLM",
      extractionModel: "llama3",
      verified: false,
    },
  ];
}

export function generateDummyRedFlags(facts: DummyFact[]): DummyRedFlag[] {
  // Find relevant facts for red flag generation
  const gridCapacityFact = facts.find(f => f.key === "grid_available_capacity_mw");
  const acCapacityFact = facts.find(f => f.key === "ac_capacity_mw");
  const augmentationRequiredFact = facts.find(f => f.key === "network_augmentation_required");
  const weakGridFact = facts.find(f => f.key === "weak_grid_area");
  const indigenousConsultFact = facts.find(f => f.key === "indigenous_consultation_required");
  
  return [
    {
      id: uuidv4(),
      category: "Grid_Integration",
      severity: "High",
      title: "Grid Capacity Constraint Detected",
      description: `Available grid capacity (${gridCapacityFact?.value || "120"}MW) is less than project AC capacity (${acCapacityFact?.value || "150"}MW). Network augmentation required, adding $12M cost and 18-24 month delay risk.`,
      relatedFactIds: [gridCapacityFact?.id, acCapacityFact?.id, augmentationRequiredFact?.id].filter(Boolean).join(","),
      detectionRule: "grid_capacity_constraint",
      status: "Open",
      impact: "Project may face connection delays and additional CAPEX. COD at risk if augmentation timeline extends beyond forecast.",
      recommendation: "1) Engage ElectraNet immediately to confirm augmentation scope and timeline. 2) Consider staged commissioning (120MW initial, 30MW post-augmentation). 3) Update financial model with augmentation costs and delay scenarios. 4) Assess curtailment risk during augmentation period.",
    },
    {
      id: uuidv4(),
      category: "Grid_Integration",
      severity: "Medium",
      title: "Weak Grid Area - Performance Risk",
      description: "Connection point identified as weak grid area. May require additional grid support equipment (STATCOM, synchronous condenser) or face curtailment during low demand periods.",
      relatedFactIds: [weakGridFact?.id].filter(Boolean).join(","),
      detectionRule: "weak_grid_detection",
      status: "Open",
      impact: "Potential revenue impact from curtailment. Additional CAPEX for grid support equipment ($3-8M). Performance ratio may be lower than forecast.",
      recommendation: "1) Request detailed curtailment analysis from AEMO. 2) Model revenue impact under various curtailment scenarios. 3) Investigate grid support equipment requirements and costs. 4) Consider battery co-location to improve grid stability and capture curtailed energy.",
    },
    {
      id: uuidv4(),
      category: "Planning_Approvals",
      severity: "Medium",
      title: "Indigenous Consultation Incomplete",
      description: "Development approval requires Indigenous heritage consultation, but no evidence of completed consultation found in uploaded documents. This is a condition precedent for construction commencement.",
      relatedFactIds: [indigenousConsultFact?.id].filter(Boolean).join(","),
      detectionRule: "planning_gap_indigenous_consultation",
      status: "Open",
      impact: "Construction cannot commence until consultation complete. Potential 3-6 month delay if not addressed urgently. Risk of approval suspension if condition not met.",
      recommendation: "1) Immediately engage Traditional Owners and relevant Aboriginal heritage bodies. 2) Commission heritage survey if not already underway. 3) Update project timeline to reflect consultation period. 4) Ensure consultation outcomes are documented and submitted to planning authority before construction mobilization.",
    },
    {
      id: uuidv4(),
      category: "Technical_Design",
      severity: "Low",
      title: "Glare Assessment Pending",
      description: "Planning approval condition requires glare assessment, but no glare study found in document set. Required before final design sign-off.",
      relatedFactIds: "",
      detectionRule: "planning_gap_glare_assessment",
      status: "Open",
      impact: "Minor delay risk if glare assessment identifies issues requiring design changes (e.g., panel tilt adjustment, screening). Typically 2-4 week study turnaround.",
      recommendation: "1) Commission glare assessment from qualified consultant. 2) Provide assessment to planning authority as required. 3) If issues identified, work with EPC to implement mitigation measures (screening, panel angle adjustment). 4) Low risk item - can be completed in parallel with other workstreams.",
    },
  ];
}

export function generateDummyProcessingJobs(documents: DummyDocument[]): DummyProcessingJob[] {
  const now = new Date();
  
  return [
    {
      id: 1,
      document_id: documents[0].id,
      status: "completed",
      stage: "Fact Extraction Complete",
      progress_percent: 100,
      error_message: null,
      started_at: new Date(now.getTime() - 3600000 * 24 * 2 + 60000), // 2 days ago + 1 min
      completed_at: new Date(now.getTime() - 3600000 * 24 * 2 + 180000), // 2 days ago + 3 min
      estimated_completion: null,
    },
    {
      id: 2,
      document_id: documents[1].id,
      status: "completed",
      stage: "Fact Extraction Complete",
      progress_percent: 100,
      error_message: null,
      started_at: new Date(now.getTime() - 3600000 * 24 * 1 + 60000), // 1 day ago + 1 min
      completed_at: new Date(now.getTime() - 3600000 * 24 * 1 + 240000), // 1 day ago + 4 min
      estimated_completion: null,
    },
    {
      id: 3,
      document_id: documents[2].id,
      status: "completed",
      stage: "Fact Extraction Complete",
      progress_percent: 100,
      error_message: null,
      started_at: new Date(now.getTime() - 3600000 * 12 + 60000), // 12 hours ago + 1 min
      completed_at: new Date(now.getTime() - 3600000 * 12 + 300000), // 12 hours ago + 5 min
      estimated_completion: null,
    },
    {
      id: 4,
      document_id: documents[3].id,
      status: "processing",
      stage: "Extracting Facts (LLM)",
      progress_percent: 65,
      error_message: null,
      started_at: new Date(now.getTime() - 3600000 * 6 + 60000), // 6 hours ago + 1 min
      completed_at: null,
      estimated_completion: new Date(now.getTime() + 120000), // 2 minutes from now
    },
  ];
}
