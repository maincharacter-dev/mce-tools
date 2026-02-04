/**
 * ACC Folder Mapping Service
 * 
 * Maps document types to ACC folder paths based on the ISO 19650-compliant folder structure:
 * - 01_PM (Project Management)
 * - 02_Data_Incoming (Client documents - organized by category)
 * - 03_Deliverables (MCE outputs - organized by service)
 */

export type DocumentType = 
  | "IM" 
  | "DD_PACK" 
  | "CONTRACT" 
  | "GRID_STUDY" 
  | "CONCEPT_DESIGN" 
  | "WEATHER_FILE"
  | "FEASIBILITY_STUDY"
  | "FINANCIAL_MODEL"
  | "PLANNING"
  | "OTHER";

export type DeliverableType =
  | "Data_Extraction"
  | "Technical_Advisory"
  | "Commercial_Advisory"
  | "Due_Diligence"
  | "Procurement_Support";

/**
 * ACC folder structure
 */
export const ACC_FOLDER_STRUCTURE = {
  PROJECT_MANAGEMENT: "01_PM",
  DATA_INCOMING: "02_Data_Incoming",
  DELIVERABLES: "03_Deliverables",
  SUPERSEDED_SUFFIX: "_SS",
} as const;

/**
 * Data_Incoming subfolder categories
 */
export const DATA_INCOMING_CATEGORIES = {
  IM: "Information_Memorandum",
  DD_PACK: "Due_Diligence_Pack",
  CONTRACT: "Contracts",
  GRID_STUDY: "Grid_Studies",
  CONCEPT_DESIGN: "Concept_Design",
  WEATHER_FILE: "Weather_Data",
  FEASIBILITY_STUDY: "Feasibility_Studies",
  FINANCIAL_MODEL: "Financial_Models",
  PLANNING: "Planning_Documents",
  OTHER: "Other_Documents",
} as const;

/**
 * Deliverables subfolder services
 */
export const DELIVERABLE_SERVICES = {
  Data_Extraction: "Data_Extraction",
  Technical_Advisory: "Technical_Advisory",
  Commercial_Advisory: "Commercial_Advisory",
  Due_Diligence: "Due_Diligence",
  Procurement_Support: "Procurement_Support",
} as const;

/**
 * Get ACC folder path for an input document (client-provided)
 * 
 * @param documentType - Type of document (IM, DD_PACK, etc.)
 * @returns Folder path array (e.g., ["02_Data_Incoming", "Information_Memorandum"])
 */
export function getInputDocumentFolderPath(documentType: DocumentType): string[] {
  const category = DATA_INCOMING_CATEGORIES[documentType] || DATA_INCOMING_CATEGORIES.OTHER;
  return [ACC_FOLDER_STRUCTURE.DATA_INCOMING, category];
}

/**
 * Get ACC folder path for an output document (MCE deliverable)
 * 
 * @param deliverableType - Type of deliverable service
 * @returns Folder path array (e.g., ["03_Deliverables", "Data_Extraction"])
 */
export function getOutputDocumentFolderPath(deliverableType: DeliverableType): string[] {
  const service = DELIVERABLE_SERVICES[deliverableType];
  return [ACC_FOLDER_STRUCTURE.DELIVERABLES, service];
}

/**
 * Get superseded folder path for a given folder path
 * 
 * @param folderPath - Original folder path
 * @returns Superseded folder path (e.g., ["02_Data_Incoming", "Information_Memorandum_SS"])
 */
export function getSupersededFolderPath(folderPath: string[]): string[] {
  const lastFolder = folderPath[folderPath.length - 1];
  const supersededFolder = `${lastFolder}${ACC_FOLDER_STRUCTURE.SUPERSEDED_SUFFIX}`;
  return [...folderPath.slice(0, -1), supersededFolder];
}

/**
 * Classify document type from file name or content
 * 
 * @param fileName - Name of the file
 * @param content - Optional file content for classification
 * @returns Classified document type
 */
export function classifyDocumentType(fileName: string, content?: string): DocumentType {
  const lowerFileName = fileName.toLowerCase();
  const ext = lowerFileName.split('.').pop() || '';
  
  // Weather/TMY files - check first as they have specific patterns
  // EPW files are always weather files (EnergyPlus Weather format)
  if (ext === 'epw') {
    return "WEATHER_FILE";
  }
  
  // CSV files with weather-related names or coordinate patterns
  if (ext === 'csv') {
    if (lowerFileName.includes('tmy') || 
        lowerFileName.includes('weather') ||
        lowerFileName.includes('meteo') ||
        lowerFileName.includes('irradiance') ||
        /\d+[._]\d+[._]\d+/.test(lowerFileName)) { // Coordinate pattern like 19.638_56.884
      return "WEATHER_FILE";
    }
  }
  
  // IM (Information Memorandum)
  if (lowerFileName.includes("information memorandum") || 
      lowerFileName.includes("im_") || 
      lowerFileName.includes("_im.") ||
      lowerFileName.includes("_im ") ||
      lowerFileName.includes("info memo") ||
      lowerFileName.includes("teaser")) {
    return "IM";
  }
  
  // Feasibility Study - check before grid study since "feasibility" is more specific
  if (lowerFileName.includes("feasibility") ||
      lowerFileName.includes("feas_") ||
      lowerFileName.includes("_feas")) {
    return "FEASIBILITY_STUDY";
  }
  
  // DD Pack (Due Diligence Pack)
  if (lowerFileName.includes("due diligence") || 
      lowerFileName.includes("dd pack") || 
      lowerFileName.includes("dd_pack") ||
      lowerFileName.includes("dd_") ||
      lowerFileName.includes("_dd.") ||
      lowerFileName.includes("data room") ||
      lowerFileName.includes("technical report")) {
    return "DD_PACK";
  }
  
  // Contract
  if (lowerFileName.includes("contract") || 
      lowerFileName.includes("agreement") || 
      lowerFileName.includes("ppa") ||
      lowerFileName.includes("epc") ||
      lowerFileName.includes("o&m") ||
      lowerFileName.includes("offtake") ||
      lowerFileName.includes("lease")) {
    return "CONTRACT";
  }
  
  // Grid Study
  if (lowerFileName.includes("grid") || 
      lowerFileName.includes("connection study") || 
      lowerFileName.includes("network study") ||
      lowerFileName.includes("dnsp") ||
      lowerFileName.includes("tnsp") ||
      lowerFileName.includes("gca") ||
      lowerFileName.includes("substation")) {
    return "GRID_STUDY";
  }
  
  // Financial Model
  if (lowerFileName.includes("financial model") ||
      lowerFileName.includes("fin_model") ||
      lowerFileName.includes("cashflow") ||
      lowerFileName.includes("cash flow") ||
      lowerFileName.includes("proforma")) {
    return "FINANCIAL_MODEL";
  }
  
  // Planning Documents
  if (lowerFileName.includes("planning") ||
      lowerFileName.includes("permit") ||
      lowerFileName.includes("approval") ||
      lowerFileName.includes("environmental") ||
      lowerFileName.includes("eia") ||
      lowerFileName.includes("krooki") ||
      lowerFileName.includes("land")) {
    return "PLANNING";
  }
  
  // Concept Design
  if (lowerFileName.includes("concept") || 
      lowerFileName.includes("design") || 
      lowerFileName.includes("layout") ||
      lowerFileName.includes("preliminary") ||
      lowerFileName.includes("sld") ||
      lowerFileName.includes("single line")) {
    return "CONCEPT_DESIGN";
  }
  
  // Schedule files (xlsx with schedule in name)
  if ((ext === 'xlsx' || ext === 'xls') && 
      (lowerFileName.includes('schedule') || lowerFileName.includes('timeline'))) {
    return "PLANNING";
  }
  
  // Default to OTHER
  return "OTHER";
}

/**
 * Determine deliverable type from processing result
 * 
 * @param processingType - Type of processing performed
 * @returns Deliverable type
 */
export function getDeliverableType(processingType: "extraction" | "analysis"): DeliverableType {
  // For now, all extractions go to Data_Extraction
  // Analysis reports could go to Technical_Advisory or other services
  if (processingType === "extraction") {
    return "Data_Extraction";
  }
  
  // Default analysis to Technical Advisory
  return "Technical_Advisory";
}
