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
  
  // IM (Information Memorandum)
  if (lowerFileName.includes("information memorandum") || 
      lowerFileName.includes("im_") || 
      lowerFileName.includes("_im.") ||
      lowerFileName.includes("info memo")) {
    return "IM";
  }
  
  // DD Pack (Due Diligence Pack)
  if (lowerFileName.includes("due diligence") || 
      lowerFileName.includes("dd pack") || 
      lowerFileName.includes("dd_pack") ||
      lowerFileName.includes("data room")) {
    return "DD_PACK";
  }
  
  // Contract
  if (lowerFileName.includes("contract") || 
      lowerFileName.includes("agreement") || 
      lowerFileName.includes("ppa") ||
      lowerFileName.includes("offtake")) {
    return "CONTRACT";
  }
  
  // Grid Study
  if (lowerFileName.includes("grid") || 
      lowerFileName.includes("connection") || 
      lowerFileName.includes("network") ||
      lowerFileName.includes("dnsp") ||
      lowerFileName.includes("tnsp")) {
    return "GRID_STUDY";
  }
  
  // Concept Design
  if (lowerFileName.includes("concept") || 
      lowerFileName.includes("design") || 
      lowerFileName.includes("layout") ||
      lowerFileName.includes("preliminary")) {
    return "CONCEPT_DESIGN";
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
