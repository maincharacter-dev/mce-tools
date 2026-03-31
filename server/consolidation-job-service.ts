/**
 * Consolidation Job Service
 * 
 * Handles chunked consolidation processing for serverless environments.
 * Each step is designed to complete within 30 seconds to avoid timeouts.
 */

import { createProjectDbPool, createMainDbPool } from './db-connection';
import { invokeLLM } from './_core/llm';

// Job status enum
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

// Consolidation steps - each should complete within 30 seconds
export type ConsolidationStep = 
  | 'init'
  | 'reconcile' 
  | 'narratives'
  | 'performance'
  | 'financial'
  | 'weather'
  | 'location'
  | 'validation'
  | 'complete';

const STEP_ORDER: ConsolidationStep[] = [
  'init',
  'reconcile',
  'narratives',
  'performance',
  'financial',
  'weather',
  'location',
  'validation',
  'complete'
];

const STEP_PROGRESS: Record<ConsolidationStep, number> = {
  'init': 5,
  'reconcile': 15,
  'narratives': 50,
  'performance': 65,
  'financial': 75,
  'weather': 85,
  'location': 90,
  'validation': 95,
  'complete': 100
};

export interface ConsolidationJob {
  id: string;
  projectId: number;
  status: JobStatus;
  currentStep: ConsolidationStep;
  progress: number;
  stepData?: any; // Stores state between steps (e.g., which sections processed)
  error?: string;
  startedAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

/**
 * Create or get existing consolidation job for a project
 */
export async function createOrGetJob(projectId: number): Promise<ConsolidationJob> {
  const mainDb = createMainDbPool();
  
  try {
    // Check for existing running job
    const [existing] = await mainDb.execute(
      `SELECT * FROM consolidation_jobs WHERE project_id = ? AND status IN ('pending', 'running') ORDER BY created_at DESC LIMIT 1`,
      [projectId]
    );
    
    const existingJobs = existing as any[];
    if (existingJobs.length > 0) {
      const job = existingJobs[0];
      // step_data is JSON column - MySQL driver already parses it, no need for JSON.parse
      const stepData = job.step_data && typeof job.step_data === 'string' 
        ? JSON.parse(job.step_data) 
        : job.step_data;
      return {
        id: job.id,
        projectId: job.project_id,
        status: job.status,
        currentStep: job.current_step,
        progress: job.progress,
        stepData,
        error: job.error_message,
        startedAt: job.created_at,
        updatedAt: job.updated_at,
        completedAt: job.completed_at
      };
    }
    
    // Create new job
    const jobId = `cj_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    await mainDb.execute(
      `INSERT INTO consolidation_jobs (id, project_id, status, current_step, progress, created_at, updated_at) 
       VALUES (?, ?, 'pending', 'init', 0, NOW(), NOW())`,
      [jobId, projectId]
    );
    
    return {
      id: jobId,
      projectId,
      status: 'pending',
      currentStep: 'init',
      progress: 0,
      startedAt: new Date(),
      updatedAt: new Date()
    };
  } finally {
    await mainDb.end();
  }
}

/**
 * Get current job status
 */
export async function getJobStatus(projectId: number): Promise<ConsolidationJob | null> {
  const mainDb = createMainDbPool();
  
  try {
    const [rows] = await mainDb.execute(
      `SELECT * FROM consolidation_jobs WHERE project_id = ? ORDER BY created_at DESC LIMIT 1`,
      [projectId]
    );
    
    const jobs = rows as any[];
    if (jobs.length === 0) return null;
    
    const job = jobs[0];
    // step_data is JSON column - MySQL driver already parses it, no need for JSON.parse
    const stepData = job.step_data && typeof job.step_data === 'string' 
      ? JSON.parse(job.step_data) 
      : job.step_data;
    return {
      id: job.id,
      projectId: job.project_id,
      status: job.status,
      currentStep: job.current_step,
      progress: job.progress,
      stepData,
      error: job.error_message,
      startedAt: job.created_at,
      updatedAt: job.updated_at,
      completedAt: job.completed_at
    };
  } finally {
    await mainDb.end();
  }
}

/**
 * Update job status
 */
async function updateJob(
  jobId: string, 
  updates: Partial<Pick<ConsolidationJob, 'status' | 'currentStep' | 'progress' | 'stepData' | 'error' | 'completedAt'>>
): Promise<void> {
  const mainDb = createMainDbPool();
  
  try {
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: any[] = [];
    
    if (updates.status !== undefined) {
      setClauses.push('status = ?');
      params.push(updates.status);
    }
    if (updates.currentStep !== undefined) {
      setClauses.push('current_step = ?');
      params.push(updates.currentStep);
    }
    if (updates.progress !== undefined) {
      setClauses.push('progress = ?');
      params.push(updates.progress);
    }
    if (updates.stepData !== undefined) {
      setClauses.push('step_data = ?');
      params.push(JSON.stringify(updates.stepData));
    }
    if (updates.error !== undefined) {
      setClauses.push('error_message = ?');
      params.push(updates.error);
    }
    if (updates.completedAt !== undefined) {
      setClauses.push('completed_at = NOW()');
    }
    
    params.push(jobId);
    
    await mainDb.execute(
      `UPDATE consolidation_jobs SET ${setClauses.join(', ')} WHERE id = ?`,
      params
    );
  } finally {
    await mainDb.end();
  }
}

/**
 * Process the next step of consolidation
 * Returns true if there are more steps to process, false if complete
 */
export async function processNextStep(projectId: number): Promise<{
  done: boolean;
  job: ConsolidationJob;
}> {
  const job = await getJobStatus(projectId);
  
  if (!job) {
    throw new Error('No consolidation job found for project');
  }
  
  if (job.status === 'completed') {
    return { done: true, job };
  }
  
  if (job.status === 'failed') {
    throw new Error(`Job failed: ${job.error}`);
  }
  
  // Mark as running
  await updateJob(job.id, { status: 'running' });
  
  try {
    const currentStepIndex = STEP_ORDER.indexOf(job.currentStep);
    const nextStep = STEP_ORDER[currentStepIndex + 1];
    
    console.log(`[ConsolidationJob] Processing step: ${job.currentStep} -> ${nextStep}`);
    
    // Execute current step
    const stepData = await executeStep(projectId, job.currentStep, job.stepData);
    
    // Check if narratives step needs more iterations (processes 2 sections at a time)
    if (job.currentStep === 'narratives' && !stepData.narrativesDone) {
      // Stay on narratives step, update progress based on sections processed
      const totalSections = stepData.sections?.length || 1;
      const processedSections = stepData.processedSections?.length || 0;
      const narrativeProgress = 15 + Math.floor((processedSections / totalSections) * 35); // 15-50%
      
      await updateJob(job.id, {
        progress: narrativeProgress,
        stepData
      });
      
      const updatedJob = await getJobStatus(projectId);
      return { done: false, job: updatedJob! };
    }
    
    if (nextStep === 'complete') {
      // All done
      await updateJob(job.id, {
        status: 'completed',
        currentStep: 'complete',
        progress: 100,
        stepData,
        completedAt: new Date()
      });
      
      const finalJob = await getJobStatus(projectId);
      return { done: true, job: finalJob! };
    }
    
    // Move to next step
    await updateJob(job.id, {
      currentStep: nextStep,
      progress: STEP_PROGRESS[nextStep],
      stepData
    });
    
    const updatedJob = await getJobStatus(projectId);
    return { done: false, job: updatedJob! };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await updateJob(job.id, {
      status: 'failed',
      error: errorMessage
    });
    throw error;
  }
}

/**
 * Execute a single consolidation step
 */
async function executeStep(
  projectId: number, 
  step: ConsolidationStep, 
  previousStepData?: any
): Promise<any> {
  console.log(`[ConsolidationJob] Executing step: ${step}`);
  
  switch (step) {
    case 'init':
      return executeInitStep(projectId);
    case 'reconcile':
      return executeReconcileStep(projectId);
    case 'narratives':
      return executeNarrativesStep(projectId, previousStepData);
    case 'performance':
      return executePerformanceStep(projectId);
    case 'financial':
      return executeFinancialStep(projectId);
    case 'weather':
      return executeWeatherStep(projectId);
    case 'location':
      return executeLocationStep(projectId);
    case 'validation':
      return executeValidationStep(projectId);
    default:
      return previousStepData;
  }
}

async function executeInitStep(projectId: number): Promise<any> {
  console.log(`[ConsolidationJob] Init step for project ${projectId}`);
  
  const projectDb = createProjectDbPool(projectId);
  try {
    // Count facts to process
    const [rows] = await projectDb.execute(
      `SELECT COUNT(*) as count FROM extracted_facts WHERE project_id = ? AND deleted_at IS NULL`,
      [projectId]
    );
    const factCount = (rows as any[])[0]?.count || 0;
    
    // Get sections
    const [facts] = await projectDb.execute(
      `SELECT DISTINCT \`key\` FROM extracted_facts WHERE project_id = ? AND deleted_at IS NULL`,
      [projectId]
    );
    
    const { normalizeSection } = await import('../shared/section-normalizer');
    const sections = Array.from(new Set((facts as any[]).map(f => normalizeSection(f.key)))).filter(s => s !== 'Other');
    
    return {
      factCount,
      sections,
      processedSections: []
    };
  } finally {
    await projectDb.end();
  }
}

async function executeReconcileStep(projectId: number): Promise<any> {
  console.log(`[ConsolidationJob] Reconcile step for project ${projectId}`);
  
  const projectDb = createProjectDbPool(projectId);
  
  try {
    // Get all facts
    const [facts]: any = await projectDb.execute(
      `SELECT id, \`key\`, value, confidence, source_document_id FROM extracted_facts WHERE project_id = ? AND deleted_at IS NULL ORDER BY created_at`,
      [projectId]
    );
    
    if (facts.length < 2) {
      console.log('[ConsolidationJob] Not enough facts to reconcile');
      return { reconciled: true, conflictsFound: 0, mergesPerformed: 0 };
    }
    
    // Group facts by key
    const factsByKey = new Map<string, any[]>();
    for (const fact of facts) {
      if (!factsByKey.has(fact.key)) {
        factsByKey.set(fact.key, []);
      }
      factsByKey.get(fact.key)!.push(fact);
    }
    
    let conflictsFound = 0;
    let mergesPerformed = 0;
    
    // Process only a limited number of comparisons per call to stay within timeout
    const MAX_COMPARISONS = 50;
    let comparisons = 0;
    
    for (const [key, keyFacts] of Array.from(factsByKey.entries())) {
      if (comparisons >= MAX_COMPARISONS) break;
      if (keyFacts.length < 2) continue;
      
      const uniqueDocuments = new Set(keyFacts.map((f: any) => f.source_document_id));
      if (uniqueDocuments.size < 2) continue;
      
      const { computeSemanticSimilarity, createConflict, enrichInsight, mergeInsightValues } = await import('./insight-reconciler');
      
      for (let i = 0; i < keyFacts.length - 1 && comparisons < MAX_COMPARISONS; i++) {
        for (let j = i + 1; j < keyFacts.length && comparisons < MAX_COMPARISONS; j++) {
          const factA = keyFacts[i];
          const factB = keyFacts[j];
          
          if (factA.source_document_id === factB.source_document_id) continue;
          
          comparisons++;
          
          const similarity = await computeSemanticSimilarity(factA.value, factB.value);
          
          if (similarity > 0.95) {
            // Exact match
          } else if (similarity > 0.70) {
            const mergedValue = await mergeInsightValues(factA.value, factB.value);
            await enrichInsight(projectDb, factA.id, mergedValue, 85, factB.source_document_id);
            await projectDb.execute(`UPDATE extracted_facts SET deleted_at = NOW() WHERE id = ?`, [factB.id]);
            mergesPerformed++;
          } else {
            await createConflict(projectDb, projectId, factA.id, factB.id, 'value_mismatch');
            conflictsFound++;
          }
        }
      }
    }
    
    return { reconciled: true, conflictsFound, mergesPerformed };
  } finally {
    await projectDb.end();
  }
}

async function executeNarrativesStep(projectId: number, stepData?: any): Promise<any> {
  console.log(`[ConsolidationJob] Narratives step for project ${projectId}`);
  
  const projectDb = createProjectDbPool(projectId);
  const mainDb = createMainDbPool();
  
  try {
    const processedSections = stepData?.processedSections || [];
    const allSections = stepData?.sections || [];
    
    // Get facts grouped by section
    const [facts] = await projectDb.execute(
      `SELECT \`key\`, value FROM extracted_facts WHERE project_id = ? AND deleted_at IS NULL`,
      [projectId]
    );
    
    const { normalizeSection, getSectionDisplayName } = await import('../shared/section-normalizer');
    
    const factsBySection = new Map<string, any[]>();
    for (const fact of facts as any[]) {
      const canonical = normalizeSection(fact.key);
      if (!factsBySection.has(canonical)) {
        factsBySection.set(canonical, []);
      }
      factsBySection.get(canonical)!.push(fact);
    }
    
    const sections = allSections.length > 0 ? allSections : 
      Array.from(factsBySection.keys()).filter(s => s !== 'Other');
    
    // Process only 2 sections per call to stay within timeout (LLM calls are slow)
    const MAX_SECTIONS_PER_CALL = 2;
    let processed = 0;
    
    for (const sectionName of sections) {
      if (processedSections.includes(sectionName)) continue;
      if (processed >= MAX_SECTIONS_PER_CALL) break;
      
      const sectionFacts = factsBySection.get(sectionName);
      if (!sectionFacts || sectionFacts.length === 0) {
        processedSections.push(sectionName);
        continue;
      }
      
      const displayName = getSectionDisplayName(sectionName);
      const factsText = sectionFacts.map((f, i) => `${i + 1}. ${f.value}`).join('\n');
      
      try {
        const response = await invokeLLM({
          _usageSource: "narrative_synthesis",
          messages: [
            {
              role: 'system',
              content: `You are a technical writing assistant. Synthesize the following project insights into a cohesive, flowing narrative paragraph suitable for executive review.`
            },
            {
              role: 'user',
              content: `Section: ${displayName}\n\nInsights:\n${factsText}\n\nSynthesize these insights into 2-3 well-structured paragraphs.`
            }
          ]
        });
        
        const narrativeContent = response.choices[0]?.message?.content;
        const narrative = typeof narrativeContent === 'string' ? narrativeContent : '';
        
        if (narrative) {
          const escapedNarrative = narrative.replace(/'/g, "''");
          
          // Save to main database
          await mainDb.execute(
            `INSERT INTO section_narratives (project_db_name, section_name, narrative_text) 
             VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE narrative_text = ?, updated_at = NOW()`,
            [String(projectId), sectionName, narrative, narrative]
          );
          
          // Save to project database
          await projectDb.execute(
            `INSERT INTO section_narratives (project_id, section_key, narrative) 
             VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE narrative = ?, updated_at = NOW()`,
            [projectId, sectionName, narrative, narrative]
          );
          
          console.log(`[ConsolidationJob] Generated narrative for ${displayName}`);
        }
      } catch (err) {
        console.error(`[ConsolidationJob] Failed to generate narrative for ${displayName}:`, err);
      }
      
      processedSections.push(sectionName);
      processed++;
    }
    
    const allDone = sections.every((s: string) => processedSections.includes(s));
    
    return {
      ...stepData,
      sections,
      processedSections,
      narrativesDone: allDone
    };
  } finally {
    await projectDb.end();
    await mainDb.end();
  }
}

async function executePerformanceStep(projectId: number): Promise<any> {
  console.log(`[ConsolidationJob] Performance step for project ${projectId}`);
  const projectDb = createProjectDbPool(projectId);

  try {
    // Get narratives which already contain consolidated information
    const [narratives]: any = await projectDb.execute(
      `SELECT section_key, narrative FROM section_narratives WHERE project_id = ?`,
      [projectId]
    );

    if (!narratives || narratives.length === 0) {
      console.log('[ConsolidationJob] No narratives found for performance extraction');
      return { performanceDone: true, skipped: 'no_narratives' };
    }

    // Build a summary from narratives
    const narrativeSummary = narratives.map((n: any) => `${n.section_key}:\n${n.narrative}`).join('\n\n');

    // Get first non-weather document for metadata
    const [documents]: any = await projectDb.execute(
      `SELECT id, fileName, documentType FROM documents WHERE documentType != 'WEATHER_FILE' LIMIT 1`
    );

    if (!documents || documents.length === 0) {
      console.log('[ConsolidationJob] No documents found for performance extraction');
      return { performanceDone: true, skipped: 'no_documents' };
    }

    // Use the performance extractor
    const { PerformanceFinancialExtractor } = await import('./performance-financial-extractor');
    const extractor = new PerformanceFinancialExtractor();
    
    const perfParams = await extractor.extractPerformanceParameters(
      narrativeSummary,
      documents[0].documentType || 'FEASIBILITY_STUDY'
    );

    if (perfParams && perfParams.confidence > 0) {
      const { v4: uuidv4 } = await import('uuid');
      const paramId = uuidv4();

      // Build INSERT statement dynamically for non-null fields
      const fields = ['id', 'project_id', 'source_document_id', 'confidence', 'extraction_method'];
      const values = [`'${paramId}'`, projectId.toString(), `'${documents[0].id}'`, perfParams.confidence.toString(), `'${perfParams.extraction_method}'`];

      const paramFields: (keyof typeof perfParams)[] = [
        'dc_capacity_mw', 'ac_capacity_mw', 'module_model', 'module_power_watts', 'module_count',
        'inverter_model', 'inverter_power_kw', 'inverter_count', 'tracking_type', 'tilt_angle_degrees',
        'azimuth_degrees', 'latitude', 'longitude', 'site_name', 'elevation_m', 'timezone',
        'system_losses_percent', 'degradation_rate_percent', 'availability_percent', 'soiling_loss_percent',
        'weather_file_url', 'ghi_annual_kwh_m2', 'dni_annual_kwh_m2', 'temperature_ambient_c',
        'p50_generation_gwh', 'p90_generation_gwh', 'capacity_factor_percent', 'specific_yield_kwh_kwp', 'notes'
      ];

      for (const field of paramFields) {
        const value = perfParams[field];
        if (value !== null && value !== undefined) {
          fields.push(field);
          if (typeof value === 'number') {
            values.push(value.toString());
          } else {
            const escapedValue = String(value).replace(/'/g, "''");
            values.push(`'${escapedValue}'`);
          }
        }
      }

      // Check if a record already exists
      const [existing]: any = await projectDb.execute(
        `SELECT id FROM performance_parameters LIMIT 1`
      );

      if (existing && existing.length > 0) {
        // UPDATE existing record
        const updatePairs = [];
        for (let i = 5; i < fields.length; i++) {
          const fieldName = fields[i];
          if (fieldName === 'latitude' || fieldName === 'longitude') continue;
          updatePairs.push(`${fieldName} = COALESCE(${values[i]}, ${fieldName})`);
        }
        updatePairs.push(`confidence = ${perfParams.confidence}`);
        updatePairs.push(`extraction_method = '${perfParams.extraction_method}'`);
        await projectDb.execute(
          `UPDATE performance_parameters SET ${updatePairs.join(', ')}, updated_at = NOW() WHERE id = '${existing[0].id}'`
        );
        console.log(`[ConsolidationJob] Merged performance parameters`);
      } else {
        await projectDb.execute(
          `INSERT INTO performance_parameters (${fields.join(', ')}) VALUES (${values.join(', ')})`
        );
        console.log(`[ConsolidationJob] Created new performance_parameters record`);
      }
    }
    return { performanceDone: true, confidence: perfParams?.confidence || 0 };
  } catch (error) {
    console.error('[ConsolidationJob] Performance extraction failed:', error);
    return { performanceDone: true, error: String(error) };
  } finally {
    await projectDb.end();
  }
}

async function executeFinancialStep(projectId: number): Promise<any> {
  console.log(`[ConsolidationJob] Financial step for project ${projectId}`);
  const projectDb = createProjectDbPool(projectId);

  try {
    const [documents]: any = await projectDb.execute(
      `SELECT id, fileName, documentType FROM documents WHERE status = 'completed' LIMIT 1`
    );

    if (!documents || documents.length === 0) {
      console.log('[ConsolidationJob] No completed documents found for financial extraction');
      return { financialDone: true, skipped: 'no_documents' };
    }

    const [facts]: any = await projectDb.execute(
      `SELECT \`key\`, value FROM extracted_facts WHERE project_id = ? AND deleted_at IS NULL`,
      [projectId]
    );

    const factsSummary = facts.map((f: any) => f.value).join('\n');

    const { PerformanceFinancialExtractor } = await import('./performance-financial-extractor');
    const extractor = new PerformanceFinancialExtractor();
    
    const financialData = await extractor.extractFinancialData(
      factsSummary,
      documents[0].documentType || 'FEASIBILITY_STUDY'
    );

    if (financialData && financialData.confidence > 0) {
      const { v4: uuidv4 } = await import('uuid');
      const finId = uuidv4();

      const fields = ['id', 'project_id', 'source_document_id', 'confidence', 'extraction_method'];
      const values = [`'${finId}'`, projectId.toString(), `'${documents[0].id}'`, financialData.confidence.toString(), `'${financialData.extraction_method}'`];

      const finFields: (keyof typeof financialData)[] = [
        'total_capex_usd', 'modules_usd', 'inverters_usd', 'trackers_usd', 'civil_works_usd',
        'grid_connection_usd', 'development_costs_usd', 'other_capex_usd',
        'total_opex_annual_usd', 'om_usd', 'insurance_usd', 'land_lease_usd',
        'asset_management_usd', 'other_opex_usd',
        'capex_per_watt_usd', 'opex_per_mwh_usd',
        'original_currency', 'exchange_rate_to_usd', 'cost_year', 'escalation_rate_percent', 'notes'
      ];

      for (const field of finFields) {
        const value = financialData[field];
        if (value !== null && value !== undefined) {
          fields.push(field);
          if (typeof value === 'number') {
            values.push(value.toString());
          } else {
            const escapedValue = String(value).replace(/'/g, "''");
            values.push(`'${escapedValue}'`);
          }
        }
      }

      await projectDb.execute(
        `INSERT INTO financial_data (${fields.join(', ')}) VALUES (${values.join(', ')})`
      );
      console.log(`[ConsolidationJob] Saved financial data`);
    }
    return { financialDone: true, confidence: financialData?.confidence || 0 };
  } catch (error) {
    console.error('[ConsolidationJob] Financial extraction failed:', error);
    return { financialDone: true, error: String(error) };
  } finally {
    await projectDb.end();
  }
}

async function executeWeatherStep(projectId: number): Promise<any> {
  console.log(`[ConsolidationJob] Weather step for project ${projectId}`);
  const projectDb = createProjectDbPool(projectId);

  try {
    // First check weather_files table
    let [weatherFiles]: any = await projectDb.execute(
      `SELECT id, file_url, file_name, file_size_bytes, 'weather_files' as source_table FROM weather_files`
    );

    // Also check documents table for weather files:
    // 1. Documents with documentType = 'WEATHER_FILE' (classified during upload/sync)
    // 2. TMY/CSV files by filename pattern (fallback)
    const [tmyDocuments]: any = await projectDb.execute(
      `SELECT id, filePath as file_url, fileName as file_name, fileSizeBytes as file_size_bytes, 'documents' as source_table 
       FROM documents 
       WHERE documentType = 'WEATHER_FILE'
       OR (
         (fileName LIKE '%.csv' OR fileName LIKE '%.CSV' OR fileName LIKE '%.epw' OR fileName LIKE '%.EPW')
         AND (fileName LIKE '%tmy%' OR fileName LIKE '%TMY%' OR fileName LIKE '%weather%' OR fileName LIKE '%WEATHER%'
              OR fileName REGEXP '^[0-9._-]+\\.csv$')
       )`
    );

    if (tmyDocuments && tmyDocuments.length > 0) {
      console.log(`[ConsolidationJob] Found ${tmyDocuments.length} potential TMY file(s) in documents table`);
      weatherFiles = [...(weatherFiles || []), ...tmyDocuments];
    }

    if (!weatherFiles || weatherFiles.length === 0) {
      console.log('[ConsolidationJob] No weather files found to process');
      return { weatherDone: true, skipped: 'no_weather_files' };
    }

    console.log(`[ConsolidationJob] Processing ${weatherFiles.length} weather file(s)`);
    let processedCount = 0;

    for (const weatherFile of weatherFiles) {
      try {
        let fileContent: string;
        
        if (weatherFile.file_url.startsWith('http://') || weatherFile.file_url.startsWith('https://')) {
          const axios = (await import('axios')).default;
          const response = await axios.get(weatherFile.file_url, {
            timeout: 30000,
            responseType: 'text'
          });
          fileContent = response.data;
        } else {
          const fs = await import('fs/promises');
          fileContent = await fs.readFile(weatherFile.file_url, 'utf-8');
        }

        const { parseWeatherFile } = await import('./weather-file-extractor');
        const parsedData = parseWeatherFile(fileContent, weatherFile.file_name);

        if (parsedData && parsedData.monthlyData.length > 0) {
          const monthlyDataJson = JSON.stringify(parsedData.monthlyData).replace(/'/g, "''");
          const annualSummaryJson = JSON.stringify(parsedData.annualSummary).replace(/'/g, "''");
          const locationJson = JSON.stringify(parsedData.location).replace(/'/g, "''");

          if (weatherFile.source_table === 'weather_files') {
            // Update existing weather_files record
            await projectDb.execute(
              `UPDATE weather_files SET 
                monthly_irradiance = '${monthlyDataJson}',
                annual_summary = '${annualSummaryJson}',
                parsed_location = '${locationJson}',
                latitude = '${parsedData.location.latitude}',
                longitude = '${parsedData.location.longitude}',
                elevation = ${parsedData.location.elevation_m || 'NULL'},
                updated_at = NOW()
              WHERE id = '${weatherFile.id}'`
            );
          } else {
            // File came from documents table - insert into weather_files
            const { v4: uuidv4 } = await import('uuid');
            const weatherFileId = uuidv4();
            const fileKey = `weather/${projectId}/${weatherFile.file_name.replace(/'/g, "''")}`.replace(/\s+/g, '_');
            const originalFormat = weatherFile.file_name.toLowerCase().endsWith('.csv') ? 'tmy_csv' : 'epw';
            await projectDb.execute(
              `INSERT INTO weather_files (id, project_id, file_key, file_url, file_name, file_size_bytes, source_type, source_document_id, original_format, monthly_irradiance, annual_summary, parsed_location, latitude, longitude, elevation, status, is_active, created_at, updated_at)
               VALUES ('${weatherFileId}', ${projectId}, '${fileKey}', '${weatherFile.file_url.replace(/'/g, "''")}', '${weatherFile.file_name.replace(/'/g, "''")}', ${weatherFile.file_size_bytes || 0}, 'document_sync', '${weatherFile.id}', '${originalFormat}', '${monthlyDataJson}', '${annualSummaryJson}', '${locationJson}', '${parsedData.location.latitude}', '${parsedData.location.longitude}', ${parsedData.location.elevation_m || 'NULL'}, 'processed', 1, NOW(), NOW())`
            );
            
            // Also update the document type to WEATHER_FILE
            await projectDb.execute(
              `UPDATE documents SET documentType = 'WEATHER_FILE' WHERE id = '${weatherFile.id}'`
            );
            console.log(`[ConsolidationJob] Created weather_files record from documents table`);
          }
          processedCount++;
          console.log(`[ConsolidationJob] Parsed weather file ${weatherFile.file_name}: lat=${parsedData.location.latitude}, lon=${parsedData.location.longitude}`);
        }
      } catch (error) {
        console.error(`[ConsolidationJob] Error processing weather file ${weatherFile.file_name}:`, error);
      }
    }
    return { weatherDone: true, processedCount };
  } catch (error) {
    console.error('[ConsolidationJob] Weather processing failed:', error);
    return { weatherDone: true, error: String(error) };
  } finally {
    await projectDb.end();
  }
}

async function executeLocationStep(projectId: number): Promise<any> {
  console.log(`[ConsolidationJob] Location step for project ${projectId}`);
  const projectDb = createProjectDbPool(projectId);

  try {
    const { LocationService } = await import('./location-service');
    const locationService = new LocationService();
    const locationSources: any[] = [];

    // Source 1: Weather file location
    const [weatherFiles]: any = await projectDb.execute(
      `SELECT latitude, longitude, location_name FROM weather_files WHERE latitude IS NOT NULL LIMIT 1`
    );

    if (weatherFiles && weatherFiles.length > 0) {
      const wf = weatherFiles[0];
      locationSources.push({
        latitude: parseFloat(wf.latitude),
        longitude: parseFloat(wf.longitude),
        source: 'weather_file',
        confidence: 0.95,
        details: wf.location_name || 'Weather file'
      });
      console.log(`[ConsolidationJob] Found location from weather file: ${wf.latitude}, ${wf.longitude}`);
    }

    // Source 2: Performance parameters
    const [perfParams]: any = await projectDb.execute(
      `SELECT latitude, longitude, site_name FROM performance_parameters WHERE latitude IS NOT NULL LIMIT 1`
    );

    if (perfParams && perfParams.length > 0) {
      const pp = perfParams[0];
      locationSources.push({
        latitude: parseFloat(pp.latitude),
        longitude: parseFloat(pp.longitude),
        source: 'document',
        confidence: 0.85,
        details: pp.site_name || 'Performance parameters'
      });
      console.log(`[ConsolidationJob] Found location from performance parameters: ${pp.latitude}, ${pp.longitude}`);
    }

    // Source 3: Extract from document facts using LLM
    const [facts]: any = await projectDb.execute(
      `SELECT \`key\`, value FROM extracted_facts WHERE project_id = ? AND deleted_at IS NULL LIMIT 100`,
      [projectId]
    );

    if (facts && facts.length > 0) {
      const factsSummary = facts.map((f: any) => `${f.key}: ${f.value}`).join('\n');
      const extractedLocation = await locationService.extractLocationFromFacts(factsSummary);
      if (extractedLocation) {
        locationSources.push(extractedLocation);
        console.log(`[ConsolidationJob] Extracted location from facts: ${extractedLocation.latitude}, ${extractedLocation.longitude}`);
      }
    }

    // Consolidate all sources
    if (locationSources.length > 0) {
      const consolidated = locationService.consolidateLocations(locationSources);
      if (consolidated) {
        console.log(`[ConsolidationJob] Consolidated location: ${consolidated.latitude}, ${consolidated.longitude}`);

        const [anyParams]: any = await projectDb.execute(
          `SELECT id FROM performance_parameters LIMIT 1`
        );

        if (anyParams && anyParams.length > 0) {
          await projectDb.execute(
            `UPDATE performance_parameters SET latitude = '${consolidated.latitude}', longitude = '${consolidated.longitude}', confidence = ${consolidated.confidence}, extraction_method = 'location_consolidation' WHERE id = '${anyParams[0].id}'`
          );
          console.log(`[ConsolidationJob] Updated performance_parameters with consolidated location`);
        } else {
          const { v4: uuidv4 } = await import('uuid');
          const paramId = uuidv4();
          await projectDb.execute(
            `INSERT INTO performance_parameters (id, project_id, latitude, longitude, confidence, extraction_method) VALUES ('${paramId}', ${projectId}, '${consolidated.latitude}', '${consolidated.longitude}', ${consolidated.confidence}, 'location_consolidation')`
          );
          console.log(`[ConsolidationJob] Created performance_parameters with consolidated location`);
        }
        return { locationDone: true, consolidated };
      }
    }
    return { locationDone: true, skipped: 'no_sources' };
  } catch (error) {
    console.error('[ConsolidationJob] Location consolidation failed:', error);
    return { locationDone: true, error: String(error) };
  } finally {
    await projectDb.end();
  }
}

async function executeValidationStep(projectId: number): Promise<any> {
  console.log(`[ConsolidationJob] Validation step for project ${projectId}`);
  const projectDb = createProjectDbPool(projectId);

  try {
    // Check minimum requirements for performance model
    const [perfParams]: any = await projectDb.execute(
      `SELECT latitude, longitude, dc_capacity_mw, ac_capacity_mw, tracking_type FROM performance_parameters LIMIT 1`
    );

    const [weatherFiles]: any = await projectDb.execute(
      `SELECT id FROM weather_files LIMIT 1`
    );

    const validation = {
      hasLocation: false,
      hasCapacity: false,
      hasConfig: false,
      hasWeatherFile: false,
      missing: [] as string[]
    };

    if (perfParams && perfParams.length > 0) {
      const pp = perfParams[0];
      validation.hasLocation = !!(pp.latitude && pp.longitude);
      validation.hasCapacity = !!(pp.dc_capacity_mw || pp.ac_capacity_mw);
      validation.hasConfig = !!pp.tracking_type;
    }

    validation.hasWeatherFile = weatherFiles && weatherFiles.length > 0;

    if (!validation.hasLocation) validation.missing.push('Location (latitude/longitude)');
    if (!validation.hasCapacity) validation.missing.push('Capacity (DC or AC MW)');
    if (!validation.hasConfig) validation.missing.push('Configuration (tracking type)');
    if (!validation.hasWeatherFile) validation.missing.push('Weather file (TMY data)');

    const isReady = validation.missing.length === 0;
    console.log(`[ConsolidationJob] Validation: ${isReady ? 'READY for performance model' : 'Missing: ' + validation.missing.join(', ')}`);

    return { validationDone: true, validation, isReady };
  } catch (error) {
    console.error('[ConsolidationJob] Validation failed:', error);
    return { validationDone: true, error: String(error) };
  } finally {
    await projectDb.end();
  }
}
