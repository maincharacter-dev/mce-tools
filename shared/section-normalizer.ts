/**
 * Section Name Normalization Utility
 * 
 * Consolidates similar section names into canonical categories to reduce fragmentation.
 * Maps LLM-generated variations to standardized section names.
 */

// Canonical section names matching intelligent-extractor-v2.ts output
export const CANONICAL_SECTIONS = {
  PROJECT_OVERVIEW: "Project_Overview",
  FINANCIAL_STRUCTURE: "Financial_Structure",
  TECHNICAL_DESIGN: "Technical_Design",
  DEPENDENCIES: "Dependencies",
  RISKS_AND_ISSUES: "Risks_And_Issues",
  ENGINEERING_ASSUMPTIONS: "Engineering_Assumptions",
  OTHER: "Other"
} as const;

// Section display names for UI
export const SECTION_DISPLAY_NAMES: Record<string, string> = {
  [CANONICAL_SECTIONS.PROJECT_OVERVIEW]: "Project Overview",
  [CANONICAL_SECTIONS.FINANCIAL_STRUCTURE]: "Financial Structure",
  [CANONICAL_SECTIONS.TECHNICAL_DESIGN]: "Technical Design",
  [CANONICAL_SECTIONS.DEPENDENCIES]: "Dependencies",
  [CANONICAL_SECTIONS.RISKS_AND_ISSUES]: "Risks & Issues",
  [CANONICAL_SECTIONS.ENGINEERING_ASSUMPTIONS]: "Engineering Assumptions",
  [CANONICAL_SECTIONS.OTHER]: "Other"
};

// Section presentation modes
export type PresentationMode = 'narrative' | 'itemized';

export const SECTION_PRESENTATION_MODES: Record<string, PresentationMode> = {
  [CANONICAL_SECTIONS.PROJECT_OVERVIEW]: 'narrative',
  [CANONICAL_SECTIONS.FINANCIAL_STRUCTURE]: 'narrative',
  [CANONICAL_SECTIONS.TECHNICAL_DESIGN]: 'narrative',
  [CANONICAL_SECTIONS.DEPENDENCIES]: 'itemized',
  [CANONICAL_SECTIONS.RISKS_AND_ISSUES]: 'itemized',
  [CANONICAL_SECTIONS.ENGINEERING_ASSUMPTIONS]: 'itemized',
  [CANONICAL_SECTIONS.OTHER]: 'itemized'
};

// Section descriptions for UI
export const SECTION_DESCRIPTIONS: Record<string, string> = {
  [CANONICAL_SECTIONS.PROJECT_OVERVIEW]: "Project identity, location, ownership, and high-level context",
  [CANONICAL_SECTIONS.FINANCIAL_STRUCTURE]: "Financial arrangements, ownership stakes, and commercial structure",
  [CANONICAL_SECTIONS.TECHNICAL_DESIGN]: "Technical specifications, design parameters, and equipment details",
  [CANONICAL_SECTIONS.DEPENDENCIES]: "External dependencies, grid connections, and project relationships",
  [CANONICAL_SECTIONS.RISKS_AND_ISSUES]: "Identified risks, issues, constraints, and potential problems",
  [CANONICAL_SECTIONS.ENGINEERING_ASSUMPTIONS]: "Engineering assumptions, design basis, and calculation parameters",
  [CANONICAL_SECTIONS.OTHER]: "Uncategorized or miscellaneous information"
};

// Normalization mapping: variations → canonical name
const SECTION_NORMALIZATION_MAP: Record<string, string> = {
  // Project Overview variations
  "project overview": CANONICAL_SECTIONS.PROJECT_OVERVIEW,
  "project_overview": CANONICAL_SECTIONS.PROJECT_OVERVIEW,
  "project identity": CANONICAL_SECTIONS.PROJECT_OVERVIEW,
  "project_identity": CANONICAL_SECTIONS.PROJECT_OVERVIEW,
  "project details": CANONICAL_SECTIONS.PROJECT_OVERVIEW,
  "project_details": CANONICAL_SECTIONS.PROJECT_OVERVIEW,
  "site details": CANONICAL_SECTIONS.PROJECT_OVERVIEW,
  "site_details": CANONICAL_SECTIONS.PROJECT_OVERVIEW,
  "site characteristics": CANONICAL_SECTIONS.PROJECT_OVERVIEW,
  "site_characteristics": CANONICAL_SECTIONS.PROJECT_OVERVIEW,
  "site conditions": CANONICAL_SECTIONS.PROJECT_OVERVIEW,
  "site_conditions": CANONICAL_SECTIONS.PROJECT_OVERVIEW,
  
  // Financial Structure variations
  "financial structure": CANONICAL_SECTIONS.FINANCIAL_STRUCTURE,
  "financial_structure": CANONICAL_SECTIONS.FINANCIAL_STRUCTURE,
  "financial": CANONICAL_SECTIONS.FINANCIAL_STRUCTURE,
  "operational relationships": CANONICAL_SECTIONS.FINANCIAL_STRUCTURE,
  "operational_relationships": CANONICAL_SECTIONS.FINANCIAL_STRUCTURE,
  
  // Technical Design variations
  "technical design": CANONICAL_SECTIONS.TECHNICAL_DESIGN,
  "technical_design": CANONICAL_SECTIONS.TECHNICAL_DESIGN,
  "technical": CANONICAL_SECTIONS.TECHNICAL_DESIGN,
  "technical specifications": CANONICAL_SECTIONS.TECHNICAL_DESIGN,
  "technical_specifications": CANONICAL_SECTIONS.TECHNICAL_DESIGN,
  "specification": CANONICAL_SECTIONS.TECHNICAL_DESIGN,
  "design parameters": CANONICAL_SECTIONS.TECHNICAL_DESIGN,
  "design_parameters": CANONICAL_SECTIONS.TECHNICAL_DESIGN,
  "technology choice": CANONICAL_SECTIONS.TECHNICAL_DESIGN,
  "technology_choice": CANONICAL_SECTIONS.TECHNICAL_DESIGN,
  "technology choices": CANONICAL_SECTIONS.TECHNICAL_DESIGN,
  "technology_choices": CANONICAL_SECTIONS.TECHNICAL_DESIGN,
  "capacity/sizing": CANONICAL_SECTIONS.TECHNICAL_DESIGN,
  "capacity_sizing": CANONICAL_SECTIONS.TECHNICAL_DESIGN,
  "energy performance": CANONICAL_SECTIONS.TECHNICAL_DESIGN,
  "energy_performance": CANONICAL_SECTIONS.TECHNICAL_DESIGN,
  "performance estimate": CANONICAL_SECTIONS.TECHNICAL_DESIGN,
  "performance_estimate": CANONICAL_SECTIONS.TECHNICAL_DESIGN,
  "performance estimates": CANONICAL_SECTIONS.TECHNICAL_DESIGN,
  "performance_estimates": CANONICAL_SECTIONS.TECHNICAL_DESIGN,
  
  // Dependencies variations
  "dependencies": CANONICAL_SECTIONS.DEPENDENCIES,
  "grid connection": CANONICAL_SECTIONS.DEPENDENCIES,
  "grid_connection": CANONICAL_SECTIONS.DEPENDENCIES,
  "grid infrastructure": CANONICAL_SECTIONS.DEPENDENCIES,
  "grid_infrastructure": CANONICAL_SECTIONS.DEPENDENCIES,
  "sequencing requirements": CANONICAL_SECTIONS.DEPENDENCIES,
  "sequencing_requirements": CANONICAL_SECTIONS.DEPENDENCIES,
  "project timeline": CANONICAL_SECTIONS.DEPENDENCIES,
  "project_timeline": CANONICAL_SECTIONS.DEPENDENCIES,
  "timeline": CANONICAL_SECTIONS.DEPENDENCIES,
  "timing constraints": CANONICAL_SECTIONS.DEPENDENCIES,
  "timing_constraints": CANONICAL_SECTIONS.DEPENDENCIES,
  "planning": CANONICAL_SECTIONS.DEPENDENCIES,
  "regulatory": CANONICAL_SECTIONS.DEPENDENCIES,
  "regulatory compliance": CANONICAL_SECTIONS.DEPENDENCIES,
  "regulatory_compliance": CANONICAL_SECTIONS.DEPENDENCIES,
  
  // Risks and Issues variations
  "risks and issues": CANONICAL_SECTIONS.RISKS_AND_ISSUES,
  "risks_and_issues": CANONICAL_SECTIONS.RISKS_AND_ISSUES,
  "risks": CANONICAL_SECTIONS.RISKS_AND_ISSUES,
  "risk": CANONICAL_SECTIONS.RISKS_AND_ISSUES,
  
  // Engineering Assumptions variations
  "engineering assumptions": CANONICAL_SECTIONS.ENGINEERING_ASSUMPTIONS,
  "engineering_assumptions": CANONICAL_SECTIONS.ENGINEERING_ASSUMPTIONS,
  "engineering assumption": CANONICAL_SECTIONS.ENGINEERING_ASSUMPTIONS,
  "engineering_assumption": CANONICAL_SECTIONS.ENGINEERING_ASSUMPTIONS,
};

/**
 * Normalize a section name to its canonical form
 * @param sectionName - Raw section name from database or LLM extraction
 * @returns Canonical section name
 */
export function normalizeSection(sectionName: string | null | undefined): string {
  if (!sectionName) return CANONICAL_SECTIONS.OTHER;
  
  // Convert to lowercase for case-insensitive matching
  const normalized = sectionName.toLowerCase().trim();
  
  // Check if it's already a canonical name (case-insensitive)
  const canonicalValues = Object.values(CANONICAL_SECTIONS);
  const exactMatch = canonicalValues.find(
    canonical => canonical.toLowerCase() === normalized
  );
  if (exactMatch) return exactMatch;
  
  // Look up in normalization map
  const mapped = SECTION_NORMALIZATION_MAP[normalized];
  if (mapped) return mapped;
  
  // Default to Other if no mapping found
  return CANONICAL_SECTIONS.OTHER;
}

/**
 * Get display name for a section
 * @param canonicalSection - Canonical section name
 * @returns Human-readable display name
 */
export function getSectionDisplayName(canonicalSection: string): string {
  return SECTION_DISPLAY_NAMES[canonicalSection] || canonicalSection;
}

/**
 * Get description for a section
 * @param canonicalSection - Canonical section name
 * @returns Section description
 */
export function getSectionDescription(canonicalSection: string): string {
  return SECTION_DESCRIPTIONS[canonicalSection] || "";
}

/**
 * Get all canonical sections in display order
 * @returns Array of canonical section names
 */
export function getCanonicalSections(): string[] {
  return [
    CANONICAL_SECTIONS.PROJECT_OVERVIEW,
    CANONICAL_SECTIONS.FINANCIAL_STRUCTURE,
    CANONICAL_SECTIONS.TECHNICAL_DESIGN,
    CANONICAL_SECTIONS.DEPENDENCIES,
    CANONICAL_SECTIONS.RISKS_AND_ISSUES,
    CANONICAL_SECTIONS.ENGINEERING_ASSUMPTIONS,
    CANONICAL_SECTIONS.OTHER,
  ];
}

/**
 * Get presentation mode for a section
 * @param canonicalSection - Canonical section name
 * @returns Presentation mode ('narrative' or 'itemized')
 */
export function getSectionPresentationMode(canonicalSection: string): PresentationMode {
  return SECTION_PRESENTATION_MODES[canonicalSection] || 'itemized';
}
