import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import PizZip from "pizzip";
import { createReport } from "docx-templates";
import { invokeLLM } from "./_core/llm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";
import { createProjectDbConnection, createProjectDbPool } from "./db-connection";
import type { Connection } from "mysql2/promise";
import { AgentOrchestrator } from '@oe-ecosystem/ai-agent';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Due Diligence Report Generator v6
 *
 * Uses docx-templates with:
 * 1. XML paragraph text merging for cross-run placeholder replacement
 * 2. Square bracket → curly brace placeholder conversion
 * 3. Post-processing to split <w:br/> into proper <w:p> paragraph elements
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ReportGenerationOptions {
  projectId: number;
  projectName: string;
  clientName?: string;
  preparedBy?: string;
  reviewedBy?: string;
  approvedBy?: string;
}

export interface ProjectData {
  project: {
    id: number;
    name: string;
    description: string | null;
    dbName: string;
    createdAt: Date;
  };
  facts: Array<Record<string, any>>;
  documents: Array<Record<string, any>>;
  redFlags: Array<Record<string, any>>;
  performanceParams: Array<Record<string, any>>;
  financialData: Array<Record<string, any>>;
}

// ─── Placeholder maps ───────────────────────────────────────────────────────

/**
 * Square bracket placeholders → curly brace equivalents.
 * Sorted longest-first to avoid partial matches.
 */
const SQUARE_BRACKET_REPLACEMENTS: [string, string][] = [
  ["[Insert name here \u2013 this can be either client or MCE depending on who has the ownership of the document. This will be specified in the contract for the project]", "{{ownershipStatement}}"],
  ["[insert general purpose \u2013 e.g. the possible acquisition by", "{{generalPurpose}}"],
  ["[Reviewer name - must be different to previous column]", "{{reviewedBy}}"],
  ["[Name/s of people who prepared the report]", "{{preparedBy}}"],
  ["[Approver name - who approved for issue]", "{{approvedBy}}"],
  ["[Office address of approving Manager]", "{{officeAddress}}"],
  ["[Signature of approving Manager]", "{{signature}}"],
  ["[Opportunity/Project/Document No.]", "{{projectNumber}}"],
  ["[Name of approving Manager]", "{{approvingManager}}"],
  ["[Email]@maincharacter.energy", "{{email}}"],
  ["[Opportunity/Project Title]", "{{projectTitle}}"],
  ["[Client Reference No.]", "{{clientReferenceNo}}"],
  ["[Client Ref. No.]", "{{clientRefNo}}"],
  ["[Revision Number]", "{{revisionNumber}}"],
  ["[Mailing address]", "{{mailingAddress}}"],
  ["[Document Type]", "{{documentType}}"],
  ["[documentType]", "{{documentType}}"],
  ["[Address line 1]", "{{addressLine1}}"],
  ["[Address line 2]", "{{addressLine2}}"],
  ["[Client Name]", "{{clientName}}"],
  ["[clientName]", "{{clientName}}"],
  ["[Choose date]", "{{chooseDate}}"],
  ["[Choose Date]", "{{chooseDate}}"],
  ["[Postcode]", "{{postcode}}"],
  ["[Phone]", "{{phone}}"],
  ["[Email]", "{{email}}"],
  ["[State]", "{{state}}"],
  ["[City]", "{{city}}"],
];

/**
 * Curly brace placeholder name normalization.
 * Maps non-standard names to valid JS identifiers.
 */
const CURLY_BRACE_NAME_MAP: Record<string, string> = {
  "Projectnumber": "projectNumber",
  "Document Type": "documentType",
  "Client Name": "clientName",
  "Client Reference No.": "clientReferenceNo",
};

// ─── XML paragraph text merger ──────────────────────────────────────────────

/**
 * Find all top-level (non-nested) <w:p>...</w:p> elements in the XML.
 * Returns an array of { start, end } positions.
 * This correctly handles nested paragraphs inside text boxes, drawings, etc.
 */
function findTopLevelParagraphs(xml: string): Array<{ start: number; end: number }> {
  const results: Array<{ start: number; end: number }> = [];
  const openTag = '<w:p';
  const closeTag = '</w:p>';
  let pos = 0;

  while (pos < xml.length) {
    const openIdx = xml.indexOf(openTag, pos);
    if (openIdx === -1) break;

    // Verify it's a proper tag start (followed by space or >)
    const charAfter = xml[openIdx + openTag.length];
    if (charAfter !== ' ' && charAfter !== '>') {
      pos = openIdx + 1;
      continue;
    }

    // Check for self-closing <w:p ... /> tags - skip them
    const tagEnd = xml.indexOf('>', openIdx);
    if (tagEnd !== -1 && xml[tagEnd - 1] === '/') {
      pos = tagEnd + 1;
      continue;
    }

    // Find the matching close tag by tracking nesting depth
    let depth = 1;
    let searchPos = tagEnd + 1;
    let found = false;

    while (depth > 0 && searchPos < xml.length) {
      const nextOpen = xml.indexOf(openTag, searchPos);
      const nextClose = xml.indexOf(closeTag, searchPos);

      if (nextClose === -1) break; // malformed XML

      if (nextOpen !== -1 && nextOpen < nextClose) {
        // Check if it's a valid <w:p tag (not <w:pPr etc.)
        const c = xml[nextOpen + openTag.length];
        if (c === ' ' || c === '>') {
          // Check if self-closing
          const innerTagEnd = xml.indexOf('>', nextOpen);
          if (innerTagEnd !== -1 && xml[innerTagEnd - 1] === '/') {
            // Self-closing nested <w:p/> - skip it, don't change depth
            searchPos = innerTagEnd + 1;
          } else {
            depth++;
            searchPos = nextOpen + openTag.length;
          }
        } else {
          searchPos = nextOpen + openTag.length;
        }
      } else {
        depth--;
        if (depth === 0) {
          results.push({ start: openIdx, end: nextClose + closeTag.length });
          found = true;
        }
        searchPos = nextClose + closeTag.length;
      }
    }

    pos = found ? results[results.length - 1].end : openIdx + openTag.length;
  }

  return results;
}

/**
 * Merges text across XML runs within each paragraph, then performs
 * square bracket and curly brace placeholder replacements on the
 * merged text. This handles Word's tendency to split text across
 * multiple <w:r> (run) elements.
 *
 * Uses balanced tag matching to avoid corrupting paragraphs that
 * contain nested <w:p> elements (e.g., inside text boxes/drawings).
 */
function mergeAndReplaceParagraphText(xml: string): string {
  const paragraphs = findTopLevelParagraphs(xml);
  if (paragraphs.length === 0) return xml;

  // Process in reverse order so string positions remain valid
  let result = xml;
  for (let i = paragraphs.length - 1; i >= 0; i--) {
    const { start, end } = paragraphs[i];
    const paragraph = result.substring(start, end);

    // Skip paragraphs that contain nested <w:p> elements (text boxes, drawings)
    // Check if there's another <w:p after the opening tag
    const innerCheck = paragraph.substring(4); // skip the opening "<w:p"
    const nestedPOpen = innerCheck.indexOf('<w:p ');
    const nestedPOpen2 = innerCheck.indexOf('<w:p>');
    if (nestedPOpen !== -1 || nestedPOpen2 !== -1) {
      // This paragraph contains nested paragraphs - process the inner ones separately
      // but don't reconstruct this outer paragraph
      continue;
    }

    const textParts: string[] = [];
    const textRegex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
    let match;
    while ((match = textRegex.exec(paragraph)) !== null) {
      textParts.push(match[1]);
    }
    if (textParts.length === 0) continue;

    let mergedText = textParts.join("");
    let hasReplacements = false;

    // Replace square bracket placeholders
    for (const [search, replace] of SQUARE_BRACKET_REPLACEMENTS) {
      if (mergedText.includes(search)) {
        mergedText = mergedText.replaceAll(search, replace);
        hasReplacements = true;
      }
    }

    // Replace curly brace name variants
    for (const [oldName, newName] of Object.entries(CURLY_BRACE_NAME_MAP)) {
      if (mergedText.includes(oldName)) {
        mergedText = mergedText.replaceAll(oldName, newName);
        hasReplacements = true;
      }
    }

    // Also reconstruct if the merged text has {{ }} placeholders that were split across runs
    const hasCurlyPlaceholders = mergedText.includes('{{') && textParts.length > 1;
    if (!hasReplacements && !hasCurlyPlaceholders) continue;

    // Reconstruct paragraph with merged text in a single run
    let rPr = "";
    const rPrMatch = paragraph.match(/<w:r(?:\s[^>]*)?>(?:<w:rPr>[\s\S]*?<\/w:rPr>)?/);
    if (rPrMatch) {
      const innerRPr = rPrMatch[0].match(/<w:rPr>[\s\S]*?<\/w:rPr>/);
      if (innerRPr) rPr = innerRPr[0];
    }

    const pPrMatch = paragraph.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
    const pPr = pPrMatch ? pPrMatch[0] : "";

    const pOpenMatch = paragraph.match(/^(<w:p[^>]*>)/);
    const pOpen = pOpenMatch ? pOpenMatch[1] : "<w:p>";

    const reconstructed = `${pOpen}${pPr}<w:r>${rPr}<w:t xml:space="preserve">${mergedText}</w:t></w:r></w:p>`;
    result = result.substring(0, start) + reconstructed + result.substring(end);
  }

  return result;
}

// ─── Normalize template ─────────────────────────────────────────────────────

/**
 * Merge split placeholders inside <w:sdtContent> elements.
 * Word's structured document tags (SDTs) can split placeholder text
 * across multiple runs with proofErr elements in between.
 * This function merges the text within each SDT content block.
 */
function mergeSdtContent(xml: string): string {
  // Only match leaf-level sdtContent blocks (those that don't contain nested sdtContent)
  // Use a negative lookahead-style approach: match sdtContent that doesn't contain another sdtContent
  return xml.replace(/<w:sdtContent>(?:(?!<w:sdtContent>)[\s\S])*?<\/w:sdtContent>/g, (sdtContent: string) => {
    // Extract all text parts from w:t elements
    const textParts: string[] = [];
    const textRegex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
    let match;
    while ((match = textRegex.exec(sdtContent)) !== null) {
      textParts.push(match[1]);
    }
    if (textParts.length <= 1) return sdtContent;

    const mergedText = textParts.join("");
    // Only reconstruct if the merged text contains a placeholder pattern
    if (!mergedText.includes("{{")) return sdtContent;

    // Get the first run's properties for the reconstructed run
    let rPr = "";
    const rPrMatch = sdtContent.match(/<w:r[^>]*>[\s\S]*?(<w:rPr>[\s\S]*?<\/w:rPr>)/);
    if (rPrMatch) rPr = rPrMatch[1];

    return `<w:sdtContent><w:r>${rPr}<w:t xml:space="preserve">${mergedText}</w:t></w:r></w:sdtContent>`;
  });
}

/**
 * Pre-processes the Word template to normalize all placeholder names.
 * Processes ALL XML files including headers, footers, and the main document.
 */
function normalizeTemplate(templateBuffer: Buffer): Buffer {
  const zip = new PizZip(templateBuffer);
  const xmlFiles = Object.keys(zip.files).filter((f) => f.endsWith(".xml"));

  for (const file of xmlFiles) {
    let content = zip.file(file)?.asText();
    if (!content) continue;

    // Simple string replacements for curly brace names
    for (const [oldName, newName] of Object.entries(CURLY_BRACE_NAME_MAP)) {
      content = content.replaceAll(oldName, newName);
    }

    // Merge split placeholders inside SDT content blocks
    content = mergeSdtContent(content);

    // Merge paragraph text and do cross-run replacements
    const before = content;
    content = mergeAndReplaceParagraphText(content);
    if (before !== content) {
      console.log(`[Report Generator] Normalized: ${file}`);
    }

    zip.file(file, content);
  }

  return zip.generate({ type: "nodebuffer" }) as unknown as Buffer;
}

// ─── Post-process: Split <w:br/> into proper paragraphs ─────────────────────

/**
 * After docx-templates populates the template, newlines in content
 * become <w:br/> elements INSIDE <w:t> elements. This post-processor
 * splits double breaks into separate <w:p> paragraph elements for
 * proper Word paragraph formatting.
 */
function splitBreaksIntoParagraphs(outputBuffer: Buffer): Buffer {
  const zip = new PizZip(outputBuffer);
  const xmlFiles = ["word/document.xml"];

  for (const xmlFile of xmlFiles) {
    let xml = zip.file(xmlFile)?.asText();
    if (!xml) continue;

    let changeCount = 0;
    const allParagraphs = findTopLevelParagraphs(xml);

    // Process in reverse order so positions remain valid
    for (let i = allParagraphs.length - 1; i >= 0; i--) {
      const { start, end } = allParagraphs[i];
      const paragraph = xml.substring(start, end);

      // Skip paragraphs with nested <w:p> elements
      const innerCheck = paragraph.substring(4);
      if (innerCheck.indexOf('<w:p ') !== -1 || innerCheck.indexOf('<w:p>') !== -1) {
        continue;
      }

      // Check if any <w:t> element contains <w:br/>
      if (!paragraph.match(/<w:t[^>]*>[^<]*<w:br\s*\/?>([\s\S]*?)<\/w:t>/)) {
        continue;
      }

      changeCount++;

      // Get paragraph properties
      const pPrMatch = paragraph.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
      const pPr = pPrMatch ? pPrMatch[0] : "";

      // Get run properties
      let rPr = "";
      const rPrMatch = paragraph.match(/<w:rPr>[\s\S]*?<\/w:rPr>/);
      if (rPrMatch) rPr = rPrMatch[0];

      // Extract all text content from <w:t> elements
      let fullText = "";
      paragraph.replace(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g, (_: string, content: string) => {
        fullText += content;
        return "";
      });

      // Replace break patterns with markers
      const PARA_BREAK = "\u0000PARA\u0000";
      const LINE_BREAK = "\u0000LINE\u0000";

      // Double breaks = paragraph break
      fullText = fullText.replace(/<w:br\s*\/?>\ *<w:br\s*\/?>/g, PARA_BREAK);
      // Single remaining breaks = line break
      fullText = fullText.replace(/<w:br\s*\/?>/g, LINE_BREAK);

      // Split into paragraphs
      const paragraphTexts = fullText.split(PARA_BREAK);

      let replacement: string;
      if (paragraphTexts.length <= 1) {
        // No paragraph breaks, but might have line breaks
        const fixedText = fullText.replace(
          new RegExp(LINE_BREAK, "g"),
          `</w:t></w:r><w:r>${rPr}<w:br/><w:t xml:space="preserve">`
        );
        replacement = `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${fixedText}</w:t></w:r></w:p>`;
      } else {
        // Create separate <w:p> elements for each paragraph
        const newParagraphs = paragraphTexts.map((text: string) => {
          const fixedText = text.replace(
            new RegExp(LINE_BREAK, "g"),
            `</w:t></w:r><w:r>${rPr}<w:br/><w:t xml:space="preserve">`
          );
          const bodyPPr = '<w:pPr><w:pStyle w:val="BodyText"/></w:pPr>';
          return `<w:p>${bodyPPr}<w:r>${rPr}<w:t xml:space="preserve">${fixedText}</w:t></w:r></w:p>`;
        });
        replacement = newParagraphs.join("");
      }

      xml = xml.substring(0, start) + replacement + xml.substring(end);
    }

    if (changeCount > 0) {
      console.log(`[Report Generator] Split ${changeCount} paragraphs with breaks in ${xmlFile}`);
    }

    zip.file(xmlFile, xml);
  }

  return zip.generate({ type: "nodebuffer" }) as unknown as Buffer;
}

// ─── Data gathering ─────────────────────────────────────────────────────────

/**
 * Gather all project data from database.
 */
export async function gatherProjectData(
  mainDb: MySql2Database<any>,
  projectId: number
): Promise<ProjectData> {
  console.log("[Report Generator] Gathering project data for ID:", projectId);

  // Get project info from main database
  const projectResult = await mainDb.execute(
    sql.raw(`SELECT id, name, description, dbName, createdAt FROM projects WHERE id = ${projectId}`)
  );
  const project = (projectResult as any)[0][0];
  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }
  console.log("[Report Generator] Project found:", project.name || project.description);

  // Create project database connection
  const projectConn: Connection = await createProjectDbConnection(projectId);

  const safeQuery = async (query: string): Promise<any[]> => {
    try {
      const [rows] = await projectConn.execute(query);
      return rows as any[];
    } catch (err: any) {
      console.log(`[Report Generator] Query failed (non-fatal): ${err.message}`);
      return [];
    }
  };

  try {
    const facts = await safeQuery("SELECT * FROM extractedFacts ORDER BY category, `key` LIMIT 1000");
    console.log("[Report Generator] Found facts:", facts.length);

    const documents = await safeQuery("SELECT * FROM documents ORDER BY uploadDate DESC LIMIT 100");
    console.log("[Report Generator] Found documents:", documents.length);

    const redFlags = await safeQuery("SELECT * FROM redFlags ORDER BY severity DESC, category LIMIT 100");
    console.log("[Report Generator] Found red flags:", redFlags.length);

    const performanceParams = await safeQuery("SELECT * FROM performanceParameters LIMIT 100");
    console.log("[Report Generator] Found performance params:", performanceParams.length);

    const financialData = await safeQuery("SELECT * FROM financialData LIMIT 100");
    console.log("[Report Generator] Found financial data:", financialData.length);

    return { project, facts, documents, redFlags, performanceParams, financialData };
  } finally {
    await projectConn.end();
  }
}

// ─── LLM content generation ────────────────────────────────────────────────

async function callLLM(systemPrompt: string, userPrompt: string, maxRetries = 3): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Report Generator] LLM call attempt ${attempt}/${maxRetries}`);
      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
      const content = response.choices[0]?.message?.content;
      if (typeof content === "string" && content.length > 0) {
        return content;
      }
      console.warn(`[Report Generator] LLM returned empty content on attempt ${attempt}`);
    } catch (err: any) {
      console.error(`[Report Generator] LLM call failed (attempt ${attempt}/${maxRetries}):`, err.message);
      if (attempt < maxRetries) {
        const delay = attempt * 2000; // 2s, 4s backoff
        console.log(`[Report Generator] Retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  console.error("[Report Generator] All LLM retry attempts exhausted");
  return "Content generation failed after multiple attempts. Please try again.";
}

// Old hardcoded section generators and generateDueDiligenceReport removed.
// All report generation is now dynamic via the Report Builder (generateReportFromContent).

// ─── Multi-step Report Builder ─────────────────────────────────────────────

const SYSTEM_PROMPT =
  "You are a senior technical due diligence consultant at MCE (Main Character Energy), a renewable energy advisory firm. Write in a professional, technical style appropriate for investment decision-makers. Do not use markdown formatting - write plain text with paragraph breaks (use \\n\\n between paragraphs) only. Do not use bullet points, headers, or any formatting characters like *, #, -, etc.";

export type ProgressCallback = (step: string, sectionsCompleted: number) => Promise<void>;



/**
 * Section definition for the Table of Contents
 */
export interface ReportSection {
  id: string;
  title: string;
  order: number;
  wordTarget: number;
  prompt: string; // LLM prompt hint for this section
}

/**
 * Report metadata fields (editable by user)
 */
export interface ReportMetadata {
  clientName: string;
  preparedBy: string;
  reviewedBy: string;
  approvedBy: string;
  projectNumber: string;
  revisionNumber: string;
  documentType: string;
}

/**
 * Default DD Report sections based on project type.
 * The AI proposes these, but user can modify.
 */
const DD_REPORT_SECTIONS: Record<string, ReportSection[]> = {
  default: [
    { id: "executive_summary", title: "Executive Summary", order: 1, wordTarget: 400, prompt: "Summarize the project, key findings, risks, and provide a clear recommendation (Proceed / Proceed with Conditions / Do Not Proceed)." },
    { id: "project_overview", title: "Project Overview", order: 2, wordTarget: 500, prompt: "Describe the project location, technology, capacity, timeline, and key stakeholders." },
    { id: "site_suitability", title: "Site Suitability & Environmental", order: 3, wordTarget: 500, prompt: "Assess site conditions, environmental constraints, land tenure, planning approvals, and environmental impact assessments." },
    { id: "technology_review", title: "Technology Review", order: 4, wordTarget: 600, prompt: "Review the proposed technology, equipment specifications, supplier track record, and technology risks." },
    { id: "design_constructability", title: "Design & Constructability", order: 5, wordTarget: 600, prompt: "Assess the engineering design, constructability considerations, civil works, and construction schedule." },
    { id: "grid_connection", title: "Grid Connection", order: 6, wordTarget: 500, prompt: "Review grid connection arrangements, network studies, connection agreements, and grid compliance." },
    { id: "performance_assessment", title: "Performance Assessment", order: 7, wordTarget: 600, prompt: "Analyze energy yield estimates, capacity factors, degradation assumptions, and performance guarantees." },
    { id: "financial_model_review", title: "Financial Model Review", order: 8, wordTarget: 500, prompt: "Review CAPEX/OPEX assumptions, revenue projections, financing structure, and financial model sensitivities." },
    { id: "key_participants", title: "Key Participants & Agreements", order: 9, wordTarget: 400, prompt: "Review key project participants (EPC, O&M, offtaker) and material agreements (PPA, EPC contract, O&M agreement)." },
    { id: "risk_analysis", title: "Risk Analysis", order: 10, wordTarget: 600, prompt: "Provide a comprehensive risk assessment covering technical, commercial, regulatory, and environmental risks with severity ratings." },
    { id: "recommendations", title: "Recommendations & Conditions Precedent", order: 11, wordTarget: 400, prompt: "Provide clear recommendations, conditions precedent for financial close, and priority actions." },
  ],
  solar: [
    { id: "executive_summary", title: "Executive Summary", order: 1, wordTarget: 400, prompt: "Summarize the solar project, key findings, risks, and provide a clear recommendation." },
    { id: "project_overview", title: "Project Overview", order: 2, wordTarget: 500, prompt: "Describe the solar project location, technology (fixed-tilt/tracker), capacity, and timeline." },
    { id: "site_suitability", title: "Site Suitability & Environmental", order: 3, wordTarget: 500, prompt: "Assess solar resource, site topography, shading analysis, environmental constraints, and land tenure." },
    { id: "technology_review", title: "Solar Technology Review", order: 4, wordTarget: 600, prompt: "Review PV module selection, inverter technology, mounting system, and supplier track records." },
    { id: "design_constructability", title: "Design & Constructability", order: 5, wordTarget: 600, prompt: "Assess plant layout, electrical design, civil works, and construction methodology for the solar farm." },
    { id: "grid_connection", title: "Grid Connection", order: 6, wordTarget: 500, prompt: "Review grid connection, network capacity, connection agreement, and marginal loss factors." },
    { id: "energy_yield", title: "Energy Yield Assessment", order: 7, wordTarget: 600, prompt: "Analyze solar resource data, energy yield modelling methodology, P50/P90 estimates, and degradation assumptions." },
    { id: "financial_model_review", title: "Financial Model Review", order: 8, wordTarget: 500, prompt: "Review CAPEX/OPEX assumptions, LCOE, revenue projections, and financial model sensitivities." },
    { id: "key_participants", title: "Key Participants & Agreements", order: 9, wordTarget: 400, prompt: "Review EPC contractor, O&M provider, offtaker, and material agreements." },
    { id: "risk_analysis", title: "Risk Analysis", order: 10, wordTarget: 600, prompt: "Comprehensive risk assessment for the solar project including technology, resource, grid, and commercial risks." },
    { id: "recommendations", title: "Recommendations & Conditions Precedent", order: 11, wordTarget: 400, prompt: "Provide recommendations and conditions precedent for financial close." },
  ],
  bess: [
    { id: "executive_summary", title: "Executive Summary", order: 1, wordTarget: 400, prompt: "Summarize the BESS project, key findings, risks, and provide a clear recommendation." },
    { id: "project_overview", title: "Project Overview", order: 2, wordTarget: 500, prompt: "Describe the BESS project location, technology, storage capacity (MW/MWh), and timeline." },
    { id: "site_suitability", title: "Site Suitability & Environmental", order: 3, wordTarget: 500, prompt: "Assess site conditions, fire safety requirements, environmental constraints, and planning approvals for BESS." },
    { id: "technology_review", title: "Battery Technology Review", order: 4, wordTarget: 700, prompt: "Review battery chemistry (LFP/NMC), cell supplier, BMS, thermal management, augmentation strategy, and degradation modelling." },
    { id: "design_constructability", title: "Design & Constructability", order: 5, wordTarget: 600, prompt: "Assess BESS layout, electrical design, fire suppression, HVAC, and construction methodology." },
    { id: "grid_connection", title: "Grid Connection & Market", order: 6, wordTarget: 600, prompt: "Review grid connection, FCAS participation, arbitrage strategy, and market revenue assumptions." },
    { id: "performance_assessment", title: "Performance & Degradation", order: 7, wordTarget: 600, prompt: "Analyze round-trip efficiency, cycle life, degradation curves, augmentation schedule, and warranty terms." },
    { id: "financial_model_review", title: "Financial Model Review", order: 8, wordTarget: 500, prompt: "Review CAPEX/OPEX, revenue stacking (FCAS, arbitrage, cap contracts), and financial model sensitivities." },
    { id: "key_participants", title: "Key Participants & Agreements", order: 9, wordTarget: 400, prompt: "Review battery supplier, EPC contractor, O&M provider, and material agreements." },
    { id: "risk_analysis", title: "Risk Analysis", order: 10, wordTarget: 600, prompt: "Comprehensive risk assessment for BESS including technology, safety, market, and commercial risks." },
    { id: "recommendations", title: "Recommendations & Conditions Precedent", order: 11, wordTarget: 400, prompt: "Provide recommendations and conditions precedent for financial close." },
  ],
  wind: [
    { id: "executive_summary", title: "Executive Summary", order: 1, wordTarget: 400, prompt: "Summarize the wind project, key findings, risks, and provide a clear recommendation." },
    { id: "project_overview", title: "Project Overview", order: 2, wordTarget: 500, prompt: "Describe the wind project location, turbine model, capacity, and timeline." },
    { id: "site_suitability", title: "Site Suitability & Environmental", order: 3, wordTarget: 500, prompt: "Assess wind resource, terrain complexity, noise constraints, visual impact, and environmental approvals." },
    { id: "technology_review", title: "Wind Turbine Technology Review", order: 4, wordTarget: 700, prompt: "Review turbine selection, IEC class suitability, supplier track record, and technology risks." },
    { id: "design_constructability", title: "Design & Constructability", order: 5, wordTarget: 600, prompt: "Assess turbine layout, foundation design, access roads, crane requirements, and construction methodology." },
    { id: "grid_connection", title: "Grid Connection", order: 6, wordTarget: 500, prompt: "Review grid connection, network studies, connection agreement, and reactive power requirements." },
    { id: "energy_yield", title: "Energy Yield Assessment", order: 7, wordTarget: 700, prompt: "Analyze wind resource data, energy yield modelling, wake losses, P50/P90 estimates, and uncertainty analysis." },
    { id: "financial_model_review", title: "Financial Model Review", order: 8, wordTarget: 500, prompt: "Review CAPEX/OPEX assumptions, LCOE, revenue projections, and financial model sensitivities." },
    { id: "key_participants", title: "Key Participants & Agreements", order: 9, wordTarget: 400, prompt: "Review turbine supplier, EPC contractor, O&M provider, and material agreements." },
    { id: "risk_analysis", title: "Risk Analysis", order: 10, wordTarget: 600, prompt: "Comprehensive risk assessment for the wind project including resource, technology, grid, and commercial risks." },
    { id: "recommendations", title: "Recommendations & Conditions Precedent", order: 11, wordTarget: 400, prompt: "Provide recommendations and conditions precedent for financial close." },
  ],
};

/**
 * Use AI to propose a Table of Contents based on available project data.
 * Returns sections tailored to the project type and available data.
 */
export async function proposeTableOfContents(
  mainDb: MySql2Database<any>,
  projectId: number,
  projectName: string
): Promise<{ sections: ReportSection[]; projectType: string; dataSummary: string }> {
  // Gather project data to understand what's available
  const data = await gatherProjectData(mainDb, projectId);

  // Detect project type from facts
  const typeIndicators = data.facts
    .filter((f) => {
      const cat = (f.category || "").toLowerCase();
      const key = (f.key || "").toLowerCase();
      const val = (f.value || "").toLowerCase();
      return (
        cat.includes("technology") ||
        cat.includes("type") ||
        key.includes("technology") ||
        key.includes("type") ||
        val.includes("solar") ||
        val.includes("wind") ||
        val.includes("bess") ||
        val.includes("battery")
      );
    })
    .map((f) => `${f.key}: ${f.value}`)
    .join(", ");

  let projectType = "default";
  const typeStr = typeIndicators.toLowerCase();
  if (typeStr.includes("solar") || typeStr.includes("pv") || typeStr.includes("photovoltaic")) {
    projectType = "solar";
  } else if (typeStr.includes("bess") || typeStr.includes("battery") || typeStr.includes("storage")) {
    projectType = "bess";
  } else if (typeStr.includes("wind") || typeStr.includes("turbine")) {
    projectType = "wind";
  }

  // Get the template sections for this project type
  const sections = DD_REPORT_SECTIONS[projectType] || DD_REPORT_SECTIONS.default;

  // Build a data summary for the user
  const dataSummary = [
    `Documents: ${data.documents.length}`,
    `Extracted Facts: ${data.facts.length}`,
    `Red Flags: ${data.redFlags.length}`,
    `Performance Parameters: ${data.performanceParams.length}`,
    `Financial Data Points: ${data.financialData.length}`,
    projectType !== "default" ? `Detected Project Type: ${projectType.toUpperCase()}` : "Project Type: Not detected (using default structure)",
  ].join(" | ");

  return { sections: [...sections], projectType, dataSummary };
}

/**
 * Create an AgentOrchestrator instance for project-context-aware generation.
 * The agent has access to query_facts, query_documents, query_red_flags,
 * search_knowledge_base, and other tools to gather real project data.
 */
function createAgentForProject(mainDb: MySql2Database<any>): AgentOrchestrator {
  const getProjectDb = async (projectId: number) => {
    return createProjectDbPool(projectId) as any;
  };
  return new AgentOrchestrator(mainDb as any, getProjectDb);
}

/**
 * Generate content for a single section using the oe-ai-agent.
 * The agent autonomously queries the project database for relevant facts,
 * documents, red flags, and knowledge base entries to generate grounded content.
 */
export async function generateSectionContent(
  mainDb: MySql2Database<any>,
  projectId: number,
  section: ReportSection
): Promise<string> {
  console.log(`[Report Builder] Generating section via oe-ai-agent: ${section.title}`);

  try {
    const agent = createAgentForProject(mainDb);

    const message = `Generate the "${section.title}" section for a Technical Due Diligence report on this project.

Section guidance: ${section.prompt}
Target word count: ${section.wordTarget} words

IMPORTANT INSTRUCTIONS:
1. First, use your tools to query the project database for relevant facts, documents, red flags, and knowledge base entries related to this section topic.
2. Use query_facts, query_red_flags, query_documents, and search_knowledge_base to gather comprehensive data.
3. Then write the section content grounded in the actual project data you retrieved.
4. Write in flowing paragraphs separated by double newlines. No bullet points, no markdown formatting, no headers.
5. The content should be professional and suitable for investment decision-makers.
6. Include specific data points, figures, and references from the project data.
7. If data is limited, note what information gaps exist.
8. Return ONLY the section content text, no preamble or explanation.`;

    const response = await agent.processMessage({
      userId: 0, // System-level generation
      projectId,
      message,
      context: {
        workflowStage: 'report_generation',
        currentPage: 'report-builder',
      },
    });

    const content = response.message?.trim();
    if (content && content.length > 50) {
      console.log(`[Report Builder] Agent generated ${content.length} chars for ${section.title} (tools used: ${response.metadata.toolsUsed.join(', ') || 'none'})`);
      return content;
    }

    // Fallback to direct LLM if agent returns too little
    console.warn(`[Report Builder] Agent returned insufficient content for ${section.title}, falling back to direct LLM`);
    return generateSectionContentDirect(mainDb, projectId, section);
  } catch (err: any) {
    console.error(`[Report Builder] Agent generation failed for ${section.title}:`, err.message);
    // Fallback to direct LLM call
    return generateSectionContentDirect(mainDb, projectId, section);
  }
}

/**
 * Fallback: Generate content using direct LLM call with manually gathered data.
 * Used when the agent-based approach fails.
 */
async function generateSectionContentDirect(
  mainDb: MySql2Database<any>,
  projectId: number,
  section: ReportSection
): Promise<string> {
  console.log(`[Report Builder] Fallback: direct LLM generation for ${section.title}`);
  const data = await gatherProjectData(mainDb, projectId);

  const factsStr = data.facts
    .slice(0, 80)
    .map((f) => `- ${f.category}: ${f.key} = ${f.value}`)
    .join("\n");
  const redFlagsStr = data.redFlags
    .slice(0, 20)
    .map((r) => `- [${r.severity}] ${r.category}: ${r.description}`)
    .join("\n");
  const docsStr = data.documents
    .slice(0, 20)
    .map((d) => `- ${d.documentType}: ${d.fileName}`)
    .join("\n");
  const perfStr = data.performanceParams
    .slice(0, 20)
    .map((p) => JSON.stringify(p))
    .join("\n");
  const finStr = data.financialData
    .slice(0, 20)
    .map((f) => JSON.stringify(f))
    .join("\n");

  const userPrompt = `Write the "${section.title}" section (${section.wordTarget} words target) for a Technical Due Diligence report.

Project: ${data.project.name}
Description: ${data.project.description || "Not provided"}

Section guidance: ${section.prompt}

Available Data:
Key Facts (${data.facts.length} total):
${factsStr || "No facts extracted yet."}

Red Flags (${data.redFlags.length} total):
${redFlagsStr || "No red flags identified."}

Documents Reviewed (${data.documents.length} total):
${docsStr || "No documents uploaded yet."}

Performance Parameters:
${perfStr || "Not available"}

Financial Data:
${finStr || "Not available"}

Write in flowing paragraphs separated by double newlines (\\n\\n). No bullet points, no markdown formatting, no headers. The content should be professional and suitable for investment decision-makers.`;

  return callLLM(SYSTEM_PROMPT, userPrompt);
}

/**
 * Generate the final DOCX from approved content and metadata.
 * This is the "Step 3" of the workflow - takes pre-approved content, no LLM calls.
 */
export async function generateReportFromContent(
  sections: ReportSection[],
  content: Record<string, string>,
  metadata: ReportMetadata,
  projectId: number,
  chartBuffers?: Record<string, Buffer>
): Promise<Buffer> {
  console.log("[Report Builder] Generating DOCX from approved content...");

  // Use the clean template (no pre-existing content headings)
  // At runtime, esbuild bundles to dist/index.js so __dirname = /app/dist/
  // Templates are copied to /app/server/templates/ via Dockerfile
  const cleanTemplatePath = path.join(__dirname, "../server/templates/DD_Report_Template_Clean.docx");
  const fallbackTemplatePath = path.join(__dirname, "../server/templates/DD_Report_Template.docx");
  const templatePath = fs.existsSync(cleanTemplatePath) ? cleanTemplatePath : fallbackTemplatePath;

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found at ${templatePath}`);
  }

  const rawTemplate = fs.readFileSync(templatePath);
  const normalizedTemplate = normalizeTemplate(rawTemplate);

  const currentDate = new Date().toLocaleDateString("en-AU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Build dynamic report content from all sections in order
  const orderedSections = [...sections].sort((a, b) => a.order - b.order);
  const reportContentParts: string[] = [];
  for (const section of orderedSections) {
    const sectionText = content[section.id] || "";
    if (sectionText) {
      reportContentParts.push(`${section.title}\n\n${sectionText}`);
    }
  }
  const reportContent = reportContentParts.join("\n\n\n");

  const templateData: Record<string, string> = {
    // Cover page
    documentType: metadata.documentType || "Technical Due Diligence Report",
    preparedForDate: currentDate,
    projectNumber: metadata.projectNumber || `MCE-DD-${projectId}`,
    clientRefNo: metadata.clientName ? `${metadata.clientName}-REF` : "TBD",
    clientReferenceNo: metadata.clientName ? `${metadata.clientName}-REF` : "TBD",

    // Document control
    projectTitle: metadata.clientName ? `${metadata.documentType} - ${metadata.clientName}` : metadata.documentType,
    revisionNumber: metadata.revisionNumber || "Rev 00",
    chooseDate: currentDate,
    preparedBy: metadata.preparedBy || "MCE Technical Team",
    reviewedBy: metadata.reviewedBy || "Pending Review",
    approvedBy: metadata.approvedBy || "Pending Approval",
    clientName: metadata.clientName || "[Client Name]",

    // MCE Company Details
    approvingManager: metadata.approvedBy || "[Name of approving Manager]",
    officeAddress: "Level 10, 120 Collins Street",
    email: "info@maincharacter.energy",
    signature: "[Pending Signature]",
    ownershipStatement: metadata.clientName || "[Client Name]",
    generalPurpose: metadata.clientName
      ? `the possible acquisition by ${metadata.clientName}`
      : "the possible acquisition",

    // Back cover
    addressLine1: "Level 10, 120 Collins Street",
    addressLine2: "Melbourne VIC 3000",
    city: "Melbourne",
    state: "VIC",
    postcode: "3000",
    mailingAddress: "PO Box 123, Melbourne VIC 3001",
    phone: "+61 (03) 9000 0000",

    // Dynamic content - all sections combined with headings
    reportContent,
  };

  // Generate report using docx-templates
  const reportRaw = await createReport({
    template: normalizedTemplate,
    data: templateData,
    cmdDelimiter: ["{{" , "}}"],
  });

  // Post-process: split <w:br/> into proper paragraphs, and inject proper heading styles
  let report = splitBreaksIntoParagraphs(Buffer.from(reportRaw));

  // Post-process: convert section titles into proper Word heading styles
  // The reportContent has titles as plain text followed by \n\n content.
  // We need to find these title paragraphs and apply Heading1/AltHeading1 styles.
  report = applyHeadingStyles(report, orderedSections);

  // Post-process: clean up ALL heading paragraphs (not just those in sections array)
  report = cleanupAllHeadings(report);

  // Post-process: fix remaining issues (raw placeholder labels, TOC update flag)
  report = postProcessReport(report, templateData);

  // Embed charts if available
  if (chartBuffers && Object.keys(chartBuffers).length > 0) {
    try {
      report = embedChartsInDocx(report, chartBuffers);
      console.log(`[Report Builder] Embedded ${Object.keys(chartBuffers).length} charts`);
    } catch (chartErr: any) {
      console.warn('[Report Builder] Chart embedding warning:', chartErr.message);
    }
  }

  console.log("[Report Builder] DOCX generation complete!");
  return report;
}

/**
 * Clean up ALL heading paragraphs in the document by removing empty runs and line breaks.
 * This runs after applyHeadingStyles to catch any headings that weren't in the sections array.
 */
function cleanupAllHeadings(docxBuffer: Buffer): Buffer {
  const zip = new PizZip(docxBuffer);
  let xml = zip.file('word/document.xml')?.asText();
  if (!xml) return docxBuffer;

  // Safely find and clean heading paragraphs by iterating through style references
  // instead of using greedy regex that can match across paragraph boundaries
  const stylePatterns = ['w:pStyle w:val="Heading1"', 'w:pStyle w:val="AltHeading1"'];
  
  for (const stylePattern of stylePatterns) {
    let searchPos = 0;
    while (searchPos < xml.length) {
      const styleIdx = xml.indexOf(stylePattern, searchPos);
      if (styleIdx === -1) break;
      
      // Find the enclosing <w:p> (must be <w:p> or <w:p , not <w:pPr>)
      let pStart = -1;
      let searchBack = styleIdx;
      while (searchBack > 0) {
        const candidate = xml.lastIndexOf('<w:p', searchBack);
        if (candidate === -1) break;
        const nextChar = xml[candidate + 4];
        if (nextChar === '>' || nextChar === ' ') {
          pStart = candidate;
          break;
        }
        searchBack = candidate - 1;
      }
      if (pStart === -1) {
        searchPos = styleIdx + stylePattern.length;
        continue;
      }
      
      // Find the closing </w:p> for this paragraph
      const pEnd: number = xml.indexOf('</w:p>', styleIdx);
      if (pEnd === -1) {
        searchPos = styleIdx + stylePattern.length;
        continue;
      }
      const pEndFull: number = pEnd + 6; // include '</w:p>'
      
      // Extract the paragraph
      let para = xml.substring(pStart, pEndFull);
      
      // Remove empty runs: <w:r><w:t ...></w:t></w:r> where text is empty or whitespace only
      let cleaned = para.replace(/<w:r><w:t[^>]*>\s*<\/w:t><\/w:r>/g, '');
      // Remove line breaks
      cleaned = cleaned.replace(/<w:br\/>/g, '');
      
      if (cleaned !== para) {
        xml = xml.substring(0, pStart) + cleaned + xml.substring(pEndFull);
        searchPos = pStart + cleaned.length;
      } else {
        searchPos = pEndFull;
      }
    }
  }

  zip.file('word/document.xml', xml);
  return zip.generate({ type: 'nodebuffer' }) as unknown as Buffer;
}

/**
 * Post-process the DOCX to apply proper heading styles to section titles.
 * After docx-templates populates the content, section titles appear as plain BodyText.
 * This function finds those title paragraphs and changes their style attribute in-place
 * (rather than replacing the entire paragraph XML, which can corrupt nested structures).
 */
function applyHeadingStyles(docxBuffer: Buffer, sections: ReportSection[]): Buffer {
  const zip = new PizZip(docxBuffer);
  let xml = zip.file('word/document.xml')?.asText();
  if (!xml) return docxBuffer;

  // Strategy: Use a simple text search to find each section title in <w:t> elements,
  // then walk backwards to find the enclosing <w:pStyle> and change its value.
  // This avoids replacing entire paragraph XML which can corrupt nested structures.
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const title = section.title;
    const xmlTitle = title.replace(/&/g, '&amp;');
    // Template TOC field maps: AltHeading1=Level1, AltHeading2=Level2, AltHeading3=Level3
    // Heading1=Level4, Heading2=Level5, Heading3=Level6
    // Executive Summary (first section) uses AltHeading1, all others use Heading1
    const headingStyle = i === 0 ? 'AltHeading1' : 'Heading1';
    let found = false;

    // Search for the title text in <w:t> elements
    // We need to find a <w:t> that contains exactly the title text
    // and is inside a BodyText-styled paragraph
    let searchPos = 0;
    while (searchPos < xml.length) {
      const titleIdx = xml.indexOf(xmlTitle, searchPos);
      if (titleIdx === -1) break;

      // Verify this is inside a <w:t> element
      const tOpen = xml.lastIndexOf('<w:t', titleIdx);
      const tClose = xml.indexOf('</w:t>', titleIdx);
      if (tOpen === -1 || tClose === -1) {
        searchPos = titleIdx + xmlTitle.length;
        continue;
      }

      // Extract the full <w:t>...</w:t> content
      const tContent = xml.substring(tOpen, tClose + 6);
      const tTextMatch = tContent.match(/<w:t[^>]*>([^<]*)<\/w:t>/);
      if (!tTextMatch || tTextMatch[1].trim() !== xmlTitle) {
        searchPos = titleIdx + xmlTitle.length;
        continue;
      }

      // Find the enclosing <w:p> paragraph (must match <w:p> or <w:p , not <w:pPr or <w:pStyle)
      let pStart = -1;
      let searchBack = tOpen;
      while (searchBack > 0) {
        const candidate = xml.lastIndexOf('<w:p', searchBack);
        if (candidate === -1) break;
        // Check the character after '<w:p' - must be '>' or ' ' (not 'r', 'P', 'S' etc.)
        const nextChar = xml[candidate + 4];
        if (nextChar === '>' || nextChar === ' ') {
          pStart = candidate;
          break;
        }
        searchBack = candidate - 1;
      }
      if (pStart === -1) {
        searchPos = titleIdx + xmlTitle.length;
        continue;
      }

      // Check if this paragraph has BodyText style
      const pPrEnd = xml.indexOf('</w:pPr>', pStart);
      if (pPrEnd === -1 || pPrEnd > tOpen) {
        searchPos = titleIdx + xmlTitle.length;
        continue;
      }

      const pPrSection = xml.substring(pStart, pPrEnd + 8);
      if (!pPrSection.includes('w:pStyle w:val="BodyText"')) {
        searchPos = titleIdx + xmlTitle.length;
        continue;
      }

      // Found it! Replace the style value and add pageBreakBefore for ALL Level 1 headings
      const styleAttr = 'w:pStyle w:val="BodyText"';
      const styleIdx = xml.indexOf(styleAttr, pStart);
      if (styleIdx !== -1 && styleIdx < pPrEnd) {
        const newStyleAttr = `w:pStyle w:val="${headingStyle}"`;
        // Add pageBreakBefore to ALL Level 1 headings (AltHeading1 and Heading1)
        // EXCEPT if the paragraph immediately follows a section break (which already creates a new page)
        // Also remove spaceBefore to avoid extra spacing at top of page
        const pPrCloseIdx = xml.indexOf('</w:pPr>', styleIdx);
        if (pPrCloseIdx !== -1) {
          let pPrContent = xml.substring(styleIdx + styleAttr.length, pPrCloseIdx);
          // Remove any existing spaceBefore element (handles all variations)
          pPrContent = pPrContent.replace(/<w:spacing[^>]*\/>/g, (match) => {
            // Only remove if it has w:before attribute
            if (match.includes('w:before=')) return '';
            return match;
          });
          
          // Find the paragraph end to remove any <w:br/> elements that create white space
          const pEnd = xml.indexOf('</w:p>', pPrCloseIdx);
          if (pEnd !== -1) {
            // Extract content AFTER </w:pPr> to avoid duplicating the closing tag
            let paragraphContent = xml.substring(pPrCloseIdx + 8, pEnd); // +8 to skip '</w:pPr>'
            // Remove all <w:br/> elements from the heading paragraph
            paragraphContent = paragraphContent.replace(/<w:br\/>/g, '');
            // Remove empty runs that create white space (e.g., <w:r><w:t xml:space="preserve"></w:t></w:r>)
            paragraphContent = paragraphContent.replace(/<w:r><w:t[^>]*><\/w:t><\/w:r>/g, '');
            // Add pageBreakBefore - the postProcessReport step will remove it from the
            // heading that follows a section break (since the section break is inserted later)
            xml = xml.substring(0, styleIdx) + newStyleAttr + pPrContent + '<w:pageBreakBefore/></w:pPr>' + paragraphContent + xml.substring(pEnd);
          } else {
            xml = xml.substring(0, styleIdx) + newStyleAttr + pPrContent + '<w:pageBreakBefore/>' + xml.substring(pPrCloseIdx);
          }
        } else {
          xml = xml.substring(0, styleIdx) + newStyleAttr + xml.substring(styleIdx + styleAttr.length);
        }
        console.log(`[Report Generator] Applied ${headingStyle} + pageBreakBefore to: ${title}`);
        found = true;
        break;
      }

      searchPos = titleIdx + xmlTitle.length;
    }

    if (!found) {
      console.log(`[Report Generator] Could not find title paragraph for heading style: ${title}`);
    }
  }

  zip.file('word/document.xml', xml);
  return zip.generate({ type: 'nodebuffer' }) as unknown as Buffer;
}

/**
 * Post-process the generated DOCX to fix remaining issues:
 * 1. Replace any raw placeholder label text that wasn't inside {{}} delimiters
 * 2. Add updateFields flag to force TOC refresh when opened in Word
 * 3. Clean up empty paragraphs at section boundaries
 */
function postProcessReport(docxBuffer: Buffer, templateData: Record<string, string>): Buffer {
  const zip = new PizZip(docxBuffer);
  let docXml = zip.file('word/document.xml')?.asText();
  if (!docXml) return docxBuffer;

  // 1. Replace raw placeholder label text that appears outside SDT content controls.
  const labelReplacements: Record<string, string> = {
    'clientReferenceNo': templateData.clientReferenceNo || '',
    'clientRefNo': templateData.clientRefNo || '',
    'Projectnumber': templateData.projectNumber || '',
  };

  // Also fix visible placeholder names used as table cell labels
  const visibleLabelFixes: Record<string, string> = {
    'documentType': 'Document Type',
    'projectTitle': 'Project Title',
    'revisionNumber': 'Revision',
  };
  for (const [placeholder, displayLabel] of Object.entries(visibleLabelFixes)) {
    const labelRegex = new RegExp(
      `(<w:t[^>]*>)(\\s*${placeholder}\\s*)(</w:t>)`,
      'g'
    );
    docXml = docXml.replace(labelRegex, `$1${displayLabel}$3`);
  }

  for (const [label, value] of Object.entries(labelReplacements)) {
    const labelRegex = new RegExp(
      `(<w:t[^>]*>)([^<]*?)${label}([^<]*?)(</w:t>)`,
      'g'
    );
    docXml = docXml.replace(labelRegex, (match, openTag, before, after, closeTag) => {
      if (before.includes('{{') || after.includes('}}')) return match;
      return `${openTag}${before}${value}${after}${closeTag}`;
    });
  }

  // 2. Fix footer files - replace raw placeholder labels
  const footerFiles = Object.keys(zip.files).filter(f => /word\/footer\d+\.xml/.test(f));
  for (const footerFile of footerFiles) {
    let footerXml = zip.file(footerFile)?.asText();
    if (footerXml) {
      let modified = false;
      for (const [label, value] of Object.entries(labelReplacements)) {
        if (footerXml.includes(label)) {
          const labelRegex = new RegExp(
            `(<w:t[^>]*>)([^<]*?)${label}([^<]*?)(</w:t>)`,
            'g'
          );
          footerXml = footerXml.replace(labelRegex, (match: string, openTag: string, before: string, after: string, closeTag: string) => {
            if (before.includes('{{') || after.includes('}}')) return match;
            return `${openTag}${before}${value}${after}${closeTag}`;
          });
          modified = true;
        }
      }
      if (modified) {
        zip.file(footerFile, footerXml);
        console.log(`[Report Generator] Fixed labels in ${footerFile}`);
      }
    }
  }

  // 2.5. Fix Section 1 (after Important Notice) to be nextPage instead of continuous
  // This ensures the TOC starts on a new page
  const firstSectPrMatch = docXml.match(/<w:sectPr[^>]*>.*?<\/w:sectPr>/);
  if (firstSectPrMatch) {
    const firstSectPr = firstSectPrMatch[0];
    // Check if it already has a type element
    if (!firstSectPr.includes('<w:type')) {
      // Add <w:type w:val="nextPage"/> as the first element inside sectPr
      const newSectPr = firstSectPr.replace(
        /<w:sectPr([^>]*)>/,
        '<w:sectPr$1><w:type w:val="nextPage"/>'
      );
      docXml = docXml.replace(firstSectPr, newSectPr);
      console.log('[Report Generator] Changed Section 1 (after Important Notice) to nextPage type');
    }
  }

  zip.file('word/document.xml', docXml);

  // 3. Insert section break between Executive Summary and Project Overview
  // AND modify template's Section 2 to use header6 (for Executive Summary)
  {
    let xml = zip.file('word/document.xml')?.asText() || '';
    const altH1Pos = xml.indexOf('<w:pStyle w:val="AltHeading1"/>');
    const firstH1Pos = xml.indexOf('<w:pStyle w:val="Heading1"/>', altH1Pos > -1 ? altH1Pos + 50 : 0);

    if (altH1Pos > -1 && firstH1Pos > -1) {
      // Find the Project Overview paragraph start
      let projOverviewPStart = -1;
      for (let i = firstH1Pos; i >= 0; i--) {
        if (xml.substring(i, i + 4) === '<w:p' && (xml[i+4] === ' ' || xml[i+4] === '>')) {
          const between = xml.substring(i, firstH1Pos);
          if (between.indexOf('</w:p>') === -1) {
            projOverviewPStart = i;
            break;
          }
        }
      }

      console.log(`[DEBUG] Found AltHeading1 at position ${altH1Pos}`);
      console.log(`[DEBUG] Found first Heading1 at position ${firstH1Pos}`);
      console.log(`[DEBUG] Found Project Overview paragraph start at position ${projOverviewPStart}`);
      
      if (projOverviewPStart > -1) {
        // Template header3.xml has STYLEREF "Alt Heading 1".
        // We need:
        //   header5.xml = copy of header3 (keeps STYLEREF "Alt Heading 1") → for Executive Summary
        //   header3.xml = modified to STYLEREF "Heading 1" → for Project Overview onwards
        const header3Original = zip.file('word/header3.xml')?.asText();
        if (header3Original) {
          // header5 keeps the original "Alt Heading 1" STYLEREF
          zip.file('word/header5.xml', header3Original);

          // Modify header3 to use "Heading 1" instead
          const header3Modified = header3Original.replace(
            /STYLEREF\s+"Alt Heading 1"/,
            'STYLEREF  "Heading 1"'
          );
          zip.file('word/header3.xml', header3Modified);

          // Add relationship for header5.xml
          let rels = zip.file('word/_rels/document.xml.rels')?.asText() || '';
          const allRIds = Array.from(rels.matchAll(/rId(\d+)/g)).map(m => parseInt(m[1]));
          const maxRId = Math.max(...allRIds);
          const newRId = `rId${maxRId + 1}`;
          const newRel = `<Relationship Id="${newRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header5.xml"/>`;
          rels = rels.replace('</Relationships>', `${newRel}</Relationships>`);
          zip.file('word/_rels/document.xml.rels', rels);

          // Add to Content_Types
          let contentTypes = zip.file('[Content_Types].xml')?.asText() || '';
          if (!contentTypes.includes('header5.xml')) {
            contentTypes = contentTypes.replace(
              '</Types>',
              '<Override PartName="/word/header5.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/></Types>'
            );
            zip.file('[Content_Types].xml', contentTypes);
          }

          // The template's Section 2 (where reportContent goes) will be split into TWO sections:
          //   - Executive Summary section (before Project Overview)
          //   - Project Overview+ section (after Project Overview)
          // We need to:
          //   1. Keep Section 2's sectPr but change it to use header3 (for Project Overview+)
          //   2. Insert a NEW sectPr before Project Overview that uses header5 (for Executive Summary)
          const sectPrs = Array.from(xml.matchAll(/<w:sectPr[\s>][\s\S]*?<\/w:sectPr>/g));
          if (sectPrs.length >= 2) {
            const section2 = sectPrs[1][0];
            // Replace header1 reference with header3 reference (for Project Overview+ section)
            const rId23Match = rels.match(/rId(\d+)"[^>]*Target="header3\.xml"/);
            if (rId23Match) {
              const rId23 = rId23Match[1];
              const section2Modified = section2.replace(
                /<w:headerReference w:type="default" r:id="rId18"\s*\/>/,
                `<w:headerReference w:type="default" r:id="rId${rId23}" />`
              );
              xml = xml.replace(section2, section2Modified);
              zip.file('word/document.xml', xml);
              console.log(`[DEBUG] Modified template Section 2 to use header3 (rId${rId23}) for Project Overview+`);
            }
          }

          // Get page properties from existing content section
          const allSectPrs = Array.from(xml.matchAll(/<w:sectPr[\s>][\s\S]*?<\/w:sectPr>/g));
          const contentSection = allSectPrs.length >= 3 ? allSectPrs[2][0] : allSectPrs[allSectPrs.length - 1][0];
          const footerRefs = Array.from(contentSection.matchAll(/<w:footerReference[^\/]*\/>/g)).map(m => m[0]).join('\n          ');
          const pgSzMatch = contentSection.match(/<w:pgSz[^\/]*\/>/)?.[0] || '';
          const pgMarMatch = contentSection.match(/<w:pgMar[^\/]*\/>/)?.[0] || '';
          const colsMatch = contentSection.match(/<w:cols[^\/]*\/>/)?.[0] || '';

          // Insert section break paragraph before Project Overview
          const sectionBreakPara = `<w:p><w:pPr><w:sectPr>
          <w:headerReference w:type="default" r:id="${newRId}"/>
          ${footerRefs}
          <w:type w:val="nextPage"/>
          ${pgSzMatch}
          ${pgMarMatch}
          ${colsMatch}
        </w:sectPr></w:pPr></w:p>`;

          const beforeInsert = xml.substring(Math.max(0, projOverviewPStart - 100), projOverviewPStart);
          const afterInsert = xml.substring(projOverviewPStart, projOverviewPStart + 100);
          console.log(`[DEBUG] Inserting section break at position ${projOverviewPStart}`);
          console.log(`[DEBUG] Before insertion: ...${beforeInsert.substring(beforeInsert.length - 50)}`);
          console.log(`[DEBUG] After insertion: ${afterInsert.substring(0, 50)}...`);
          
          xml = xml.substring(0, projOverviewPStart) + sectionBreakPara + xml.substring(projOverviewPStart);
          
          // Remove pageBreakBefore AND add spacing override for the heading after section break
          // The section break already creates a new page, and the Heading1 style has w:before="360"
          // which creates unwanted white space at the top of the page
          const sectionBreakEnd = projOverviewPStart + sectionBreakPara.length;
          let nextParagraph = xml.substring(sectionBreakEnd, sectionBreakEnd + 500);
          let modified = false;
          
          // Remove pageBreakBefore if present
          if (nextParagraph.includes('<w:pageBreakBefore/>')) {
            nextParagraph = nextParagraph.replace('<w:pageBreakBefore/>', '');
            modified = true;
          }
          
          // Add spacing override to cancel the Heading1 style's w:before="360"
          // Insert <w:spacing w:before="0"/> after the pStyle element
          const pStyleMatch = nextParagraph.match(/(<w:pStyle w:val="Heading1"\/>)/);
          if (pStyleMatch) {
            nextParagraph = nextParagraph.replace(pStyleMatch[0], pStyleMatch[0] + '<w:spacing w:before="0"/>');
            modified = true;
          }
          
          if (modified) {
            xml = xml.substring(0, sectionBreakEnd) + nextParagraph + xml.substring(sectionBreakEnd + 500);
            console.log('[Report Generator] Removed pageBreakBefore and spacing from heading after section break');
          }
          
          zip.file('word/document.xml', xml);
          console.log('[Report Generator] Inserted section break BEFORE Project Overview (between Executive Summary and main content)');
          console.log(`[Report Generator] Executive Summary section uses header5.xml (STYLEREF "Alt Heading 1")`);
          console.log(`[Report Generator] Project Overview+ section uses header3.xml (modified to STYLEREF "Heading 1")`);
        }
      }
    }
  }

  // 4. Add updateFields flag to settings.xml to force TOC refresh on open
  let settingsXml = zip.file('word/settings.xml')?.asText();
  if (settingsXml) {
    if (!settingsXml.includes('w:updateFields')) {
      settingsXml = settingsXml.replace(
        '</w:settings>',
        '<w:updateFields w:val="true"/></w:settings>'
      );
      zip.file('word/settings.xml', settingsXml);
      console.log('[Report Generator] Added updateFields flag for TOC auto-refresh');
    }
  }

  console.log('[Report Generator] Post-processing complete');
  return zip.generate({ type: 'nodebuffer' }) as unknown as Buffer;
}



/**
 * Embed chart PNG images into a DOCX file.
 * Adds charts at the end of the relevant sections.
 */
function embedChartsInDocx(docxBuffer: Buffer, charts: Record<string, Buffer>): Buffer {
  const zip = new PizZip(docxBuffer);
  const docXml = zip.file('word/document.xml')?.asText();
  if (!docXml) return docxBuffer;

  let relsContent = zip.file('word/_rels/document.xml.rels')?.asText() || '';
  let contentTypes = zip.file('[Content_Types].xml')?.asText() || '';
  let modifiedXml = docXml;
  let imageIndex = 1;

  // Ensure PNG content type is registered
  if (!contentTypes.includes('image/png')) {
    contentTypes = contentTypes.replace(
      '</Types>',
      '<Default Extension="png" ContentType="image/png"/></Types>'
    );
  }

  // Map chart keys to section keywords for placement
  const chartPlacement: Record<string, string[]> = {
    riskSeverity: ['riskAnalysis', 'risk_analysis', 'Risk Analysis'],
    confidenceDistribution: ['executiveSummary', 'executive_summary', 'Executive Summary'],
    documentCoverage: ['projectOverview', 'project_overview', 'Project Overview'],
  };

  for (const [chartKey, chartBuffer] of Object.entries(charts)) {
    const imageName = `chart_${chartKey}_${imageIndex}.png`;
    const imagePath = `word/media/${imageName}`;
    const rId = `rIdChart${imageIndex}`;

    // Add image to zip
    zip.file(imagePath, chartBuffer);

    // Add relationship
    relsContent = relsContent.replace(
      '</Relationships>',
      `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${imageName}"/></Relationships>`
    );

    // Create inline image XML (width: ~5 inches = 4572000 EMU, height: proportional ~3.3 inches = 3048000 EMU)
    const imageXml = `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr/><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="4572000" cy="3048000"/><wp:docPr id="${100 + imageIndex}" name="Chart ${imageIndex}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${100 + imageIndex}" name="${imageName}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="4572000" cy="3048000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;

    // Try to insert chart near the relevant section
    // Look for the section text in the document and insert after it
    const keywords = chartPlacement[chartKey] || [];
    let inserted = false;
    for (const keyword of keywords) {
      // Find a paragraph containing this keyword
      const keywordRegex = new RegExp(`(<w:p[^>]*>(?:(?!</w:p>)[\\s\\S])*${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:(?!</w:p>)[\\s\\S])*</w:p>)`);
      if (modifiedXml.match(keywordRegex)) {
        modifiedXml = modifiedXml.replace(keywordRegex, `$1${imageXml}`);
        inserted = true;
        break;
      }
    }

    // If no placement found, append before the last </w:body>
    if (!inserted) {
      modifiedXml = modifiedXml.replace('</w:body>', `${imageXml}</w:body>`);
    }

    imageIndex++;
  }

  zip.file('word/document.xml', modifiedXml);
  zip.file('word/_rels/document.xml.rels', relsContent);
  zip.file('[Content_Types].xml', contentTypes);

  return zip.generate({ type: 'nodebuffer' }) as unknown as Buffer;
}

/**
 * Refine a section's content using AI based on a natural language instruction.
 * The user provides an instruction like "make this more concise" or "add more detail about grid risks".
 */
/**
 * Refine section content using the oe-ai-agent.
 * The agent can pull in additional project data to enrich the refinement,
 * not just rewrite what's already there.
 */
export async function refineSectionContent(
  currentContent: string,
  sectionTitle: string,
  instruction: string,
  wordTarget: number,
  mainDb?: MySql2Database<any>,
  projectId?: number
): Promise<string> {
  // If we have db and projectId, use the agent for context-aware refinement
  if (mainDb && projectId) {
    try {
      console.log(`[Report Builder] Refining section via oe-ai-agent: ${sectionTitle}`);
      const agent = createAgentForProject(mainDb);

      const message = `I need you to refine the "${sectionTitle}" section of a Technical Due Diligence report.

Current content:
---
${currentContent}
---

User instruction: ${instruction}

IMPORTANT:
1. If the instruction asks for more detail, additional data, or specific information, use your tools (query_facts, query_red_flags, query_documents, search_knowledge_base) to find relevant project data to enrich the content.
2. Target approximately ${wordTarget} words.
3. Maintain a professional, formal tone suitable for investment decision-makers.
4. Write in flowing paragraphs separated by double newlines. No bullet points, no markdown formatting, no headers.
5. Preserve existing factual accuracy while applying the instruction.
6. Return ONLY the refined section content, no preamble or explanation.`;

      const response = await agent.processMessage({
        userId: 0,
        projectId,
        message,
        context: {
          workflowStage: 'report_refinement',
          currentPage: 'report-builder',
        },
      });

      const content = response.message?.trim();
      if (content && content.length > 50) {
        console.log(`[Report Builder] Agent refined ${sectionTitle} (${content.length} chars, tools: ${response.metadata.toolsUsed.join(', ') || 'none'})`);
        return content;
      }
    } catch (err: any) {
      console.error(`[Report Builder] Agent refinement failed for ${sectionTitle}:`, err.message);
    }
  }

  // Fallback: direct LLM refinement (no project context)
  console.log(`[Report Builder] Fallback: direct LLM refinement for ${sectionTitle}`);
  const systemPrompt = `You are a senior technical writer specializing in renewable energy due diligence reports.
You are refining a section of a Technical Due Diligence report based on the user's instruction.

Rules:
- Maintain a professional, formal tone suitable for investment decision-makers
- Write in flowing paragraphs separated by double newlines
- No bullet points, no markdown formatting, no headers
- Target approximately ${wordTarget} words
- Preserve factual accuracy - do not invent data
- Apply the user's instruction precisely`;

  const userPrompt = `Section: "${sectionTitle}"

Current content:
${currentContent}

User instruction: ${instruction}

Rewrite the section applying the instruction above. Return ONLY the refined content, no preamble or explanation.`;

  return callLLM(systemPrompt, userPrompt);
}
