/**
 * Project Consolidator - Phase 2 Processing
 * 
 * Runs reconciliation, narrative generation, and specialized extraction
 * when user clicks "Process & Consolidate"
 */

import mysql from 'mysql2/promise';
import { invokeLLM } from './_core/llm';

interface ConsolidationProgress {
  stage: string;
  progress: number;
  message: string;
}

export class ProjectConsolidator {
  private projectId: number;
  private projectDbName: string;
  private progressCallback?: (progress: ConsolidationProgress) => void;

  constructor(projectId: number, projectDbName: string, progressCallback?: (progress: ConsolidationProgress) => void) {
    this.projectId = projectId;
    this.projectDbName = projectDbName;
    this.progressCallback = progressCallback;
  }

  private async updateProgress(stage: string, progress: number, message: string) {
    if (this.progressCallback) {
      this.progressCallback({ stage, progress, message });
    }
    console.log(`[Consolidator] ${stage} (${progress}%): ${message}`);
  }

  /**
   * Run full consolidation process
   */
  async consolidate(): Promise<void> {
    await this.updateProgress('starting', 0, 'Starting consolidation...');

    // Step 1: Reconcile insights (deduplicate, merge similar)
    await this.updateProgress('reconciling', 10, 'Reconciling insights...');
    await this.reconcileInsights();

    // Step 2: Generate section narratives
    await this.updateProgress('narratives', 40, 'Generating narratives...');
    await this.generateNarratives();

    // Step 3: Extract performance parameters
    await this.updateProgress('performance', 60, 'Extracting performance parameters...');
    await this.extractPerformanceParameters();

    // Step 4: Extract financial data
    await this.updateProgress('financial', 75, 'Extracting financial data...');
    await this.extractFinancialData();

    // Step 5: Process weather files
    await this.updateProgress('weather', 85, 'Processing weather files...');
    await this.processWeatherFiles();

    // Step 6: Consolidate location from all sources
    await this.updateProgress('location', 90, 'Consolidating project location...');
    await this.consolidateLocation();

    // Step 7: Check validation trigger
    await this.updateProgress('validation', 95, 'Checking validation readiness...');
    await this.checkValidationTrigger();

    await this.updateProgress('complete', 100, 'Consolidation complete!');
  }

  private async reconcileInsights(): Promise<void> {
    // Reconciliation compares facts from different documents to find conflicts
    // For a single document, there are no conflicts to detect
    // This runs when consolidating after multiple documents have been uploaded
    
    const projectDb = mysql.createPool({
      host: '127.0.0.1',
      user: 'root',
      database: this.projectDbName,
    });

    try {
      // Get all facts grouped by normalized key
      const [facts]: any = await projectDb.execute(
        `SELECT id, \`key\`, value, confidence, source_document_id FROM extracted_facts WHERE project_id = ${this.projectId} AND deleted_at IS NULL ORDER BY created_at`
      );

      if (facts.length < 2) {
        console.log('[Consolidator] Not enough facts to reconcile (need at least 2)');
        return;
      }

      // Group facts by key
      const factsByKey = new Map<string, any[]>();
      for (const fact of facts) {
        const key = fact.key;
        if (!factsByKey.has(key)) {
          factsByKey.set(key, []);
        }
        factsByKey.get(key)!.push(fact);
      }

      // Find keys with multiple facts from different documents (potential conflicts)
      let conflictsFound = 0;
      let mergesPerformed = 0;

      for (const [key, keyFacts] of Array.from(factsByKey.entries())) {
        if (keyFacts.length < 2) continue;

        // Check if facts are from different documents
        const uniqueDocuments = new Set(keyFacts.map((f: any) => f.source_document_id));
        if (uniqueDocuments.size < 2) {
          // All facts from same document, no conflict possible
          continue;
        }

        // Compare facts from different documents
        const { computeSemanticSimilarity, createConflict, enrichInsight, mergeInsightValues } = await import('./insight-reconciler');
        
        for (let i = 0; i < keyFacts.length - 1; i++) {
          for (let j = i + 1; j < keyFacts.length; j++) {
            const factA = keyFacts[i];
            const factB = keyFacts[j];
            
            // Skip if from same document
            if (factA.source_document_id === factB.source_document_id) continue;
            
            // Skip if already has conflict recorded
            const [existingConflicts]: any = await projectDb.execute(
              `SELECT id FROM insight_conflicts WHERE (insight_a_id = '${factA.id}' AND insight_b_id = '${factB.id}') OR (insight_a_id = '${factB.id}' AND insight_b_id = '${factA.id}')`
            );
            if (existingConflicts.length > 0) continue;

            const similarity = await computeSemanticSimilarity(factA.value, factB.value);
            console.log(`[Consolidator] Comparing "${factA.value.substring(0, 40)}..." vs "${factB.value.substring(0, 40)}...": ${(similarity * 100).toFixed(1)}%`);

            if (similarity > 0.95) {
              // Exact match - no action needed
              console.log(`[Consolidator] Exact match found, no conflict`);
            } else if (similarity > 0.70) {
              // Similar - merge into the older fact
              const mergedValue = await mergeInsightValues(factA.value, factB.value);
              await enrichInsight(projectDb, factA.id, mergedValue, 85, factB.source_document_id);
              // Soft-delete the newer fact
              await projectDb.execute(`UPDATE extracted_facts SET deleted_at = NOW() WHERE id = '${factB.id}'`);
              mergesPerformed++;
              console.log(`[Consolidator] Merged similar facts`);
            } else {
              // Different values - create conflict
              await createConflict(projectDb, this.projectId, factA.id, factB.id, 'value_mismatch');
              conflictsFound++;
            }
          }
        }
      }

      console.log(`[Consolidator] Reconciliation complete: ${conflictsFound} conflicts found, ${mergesPerformed} merges performed`);
    } finally {
      await projectDb.end();
    }
  }

  private async generateNarratives(): Promise<void> {
    const projectDb = mysql.createPool({
      host: '127.0.0.1',
      user: 'root',
      database: this.projectDbName,
    });

    try {
      // Get all facts grouped by section
      const [facts]: any = await projectDb.execute(
        `SELECT \`key\`, value FROM extracted_facts WHERE project_id = ${this.projectId} AND deleted_at IS NULL`
      );

      // Group by section using normalizeSection
      const { normalizeSection, getSectionDisplayName } = await import('../shared/section-normalizer');
      
      const factsBySection = new Map<string, any[]>();
      for (const fact of facts) {
        const canonical = normalizeSection(fact.key);
        if (!factsBySection.has(canonical)) {
          factsBySection.set(canonical, []);
        }
        factsBySection.get(canonical)!.push(fact);
      }

      const allSections = Array.from(factsBySection.keys()).filter(s => s !== 'Other');
      console.log(`[Consolidator] factsBySection keys:`, allSections);

      // Generate narratives for ALL sections with facts (not just hardcoded ones)
      const { getDb } = await import('./db');
      const mainDb = await getDb();
      const totalSections = allSections.length;
      let processedSections = 0;

      for (const sectionName of allSections) {
        const sectionFacts = factsBySection.get(sectionName);
        console.log(`[Consolidator] Section ${sectionName}: ${sectionFacts?.length || 0} facts`);
        
        if (sectionFacts && sectionFacts.length > 0) {
          const displayName = getSectionDisplayName(sectionName);
          const factsText = sectionFacts.map((f, i) => `${i + 1}. ${f.value}`).join('\n');

          // Calculate progress: narratives phase is 40-55%, spread across all sections
          const progressPercent = 40 + Math.floor((processedSections / totalSections) * 15);
          await this.updateProgress('narratives', progressPercent, `Generating narrative for ${displayName} (${processedSections + 1}/${totalSections})...`);

          try {
            const response = await invokeLLM({
              messages: [
                {
                  role: 'system',
                  content: `You are a technical writing assistant. Synthesize the following project insights into a cohesive, flowing narrative paragraph suitable for executive review. Maintain all factual details but present them as connected prose rather than bullet points.`
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
              
              // Save to main database for cross-project aggregation
              if (mainDb) {
                await mainDb.execute(
                  `INSERT INTO section_narratives (project_db_name, section_name, narrative_text) 
                   VALUES ('${this.projectDbName}', '${sectionName}', '${escapedNarrative}') 
                   ON DUPLICATE KEY UPDATE narrative_text = '${escapedNarrative}', updated_at = NOW()`
                );
              }
              
              // Save to project database for performance extraction
              await projectDb.execute(
                `INSERT INTO section_narratives (project_id, section_key, narrative) 
                 VALUES (${this.projectId}, '${sectionName}', '${escapedNarrative}') 
                 ON DUPLICATE KEY UPDATE narrative = '${escapedNarrative}', updated_at = NOW()`
              );
              
              console.log(`[Consolidator] Generated narrative for ${displayName} (${narrative.length} chars)`);
            }
          } catch (narrativeError) {
            console.error(`[Consolidator] Failed to generate narrative for ${displayName}:`, narrativeError);
          }
          
          processedSections++;
        }
      }
      
      console.log(`[Consolidator] Completed narrative generation for ${processedSections} sections`);
    } finally {
      await projectDb.end();
    }
  }

  private async extractPerformanceParameters(): Promise<void> {
    const projectDb = mysql.createPool({
      host: '127.0.0.1',
      user: 'root',
      database: this.projectDbName,
    });

    try {
      // Get narratives which already contain consolidated information
      const [narratives]: any = await projectDb.execute(
        `SELECT section_key, narrative FROM section_narratives WHERE project_id = ${this.projectId}`
      );

      if (!narratives || narratives.length === 0) {
        console.log('[Consolidator] No narratives found for performance extraction');
        return;
      }

      // Build a summary from narratives (they already contain extracted facts)
      const narrativeSummary = narratives.map((n: any) => `${n.section}:\n${n.narrative}`).join('\n\n');

      // Get first non-weather document for metadata
      const [documents]: any = await projectDb.execute(
        `SELECT id, fileName, documentType FROM documents WHERE documentType != 'WEATHER_FILE' LIMIT 1`
      );

      if (!documents || documents.length === 0) {
        console.log('[Consolidator] No documents found for performance extraction');
        return;
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
        const values = [`'${paramId}'`, this.projectId.toString(), `'${documents[0].id}'`, perfParams.confidence.toString(), `'${perfParams.extraction_method}'`];

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
          for (let i = 5; i < fields.length; i++) { // Skip id, project_id, source_document_id, confidence, extraction_method
            updatePairs.push(`${fields[i]} = ${values[i]}`);
          }
          await projectDb.execute(
            `UPDATE performance_parameters SET ${updatePairs.join(', ')}, updated_at = NOW() WHERE id = '${existing[0].id}'`
          );
        } else {
          // INSERT new record
          await projectDb.execute(
            `INSERT INTO performance_parameters (${fields.join(', ')}) VALUES (${values.join(', ')})`
          );
        }

        console.log(`[Consolidator] Saved performance parameters (confidence: ${(perfParams.confidence * 100).toFixed(1)}%)`);

        // Check minimum requirements for performance model
        const hasLocation = perfParams.latitude && perfParams.longitude;
        const hasCapacity = perfParams.dc_capacity_mw || perfParams.ac_capacity_mw;
        const hasConfig = perfParams.tracking_type;
        
        // Check for weather file
        const [weatherFiles]: any = await projectDb.execute(
          `SELECT id FROM weather_files LIMIT 1`
        );
        const hasWeatherFile = weatherFiles && weatherFiles.length > 0;

        const missing: string[] = [];
        if (!hasLocation) missing.push('Location (latitude/longitude)');
        if (!hasCapacity) missing.push('Capacity (DC or AC MW)');
        if (!hasConfig) missing.push('Configuration (tracking type: fixed/SAT)');
        if (!hasWeatherFile) missing.push('Weather file (TMY data)');

        if (missing.length === 0) {
          console.log('[Consolidator] All minimum requirements met for performance model');
        } else {
          console.log(`[Consolidator] Missing for performance model: ${missing.join(', ')}`);
        }
      }
    } catch (error) {
      console.error('[Consolidator] Performance extraction failed:', error);
    } finally {
      await projectDb.end();
    }
  }

  private async extractFinancialData(): Promise<void> {
    const projectDb = mysql.createPool({
      host: '127.0.0.1',
      user: 'root',
      database: this.projectDbName,
    });

    try {
      // Get all document text for extraction
      const [documents]: any = await projectDb.execute(
        `SELECT id, fileName, documentType FROM documents WHERE status = 'completed' LIMIT 1`
      );

      if (!documents || documents.length === 0) {
        console.log('[Consolidator] No completed documents found for financial extraction');
        return;
      }

      // Get extracted facts to build financial data from
      const [facts]: any = await projectDb.execute(
        `SELECT \`key\`, value FROM extracted_facts WHERE project_id = ${this.projectId} AND deleted_at IS NULL`
      );

      // Build a summary of facts for LLM extraction
      const factsSummary = facts.map((f: any) => f.value).join('\n');

      // Use the financial extractor
      const { PerformanceFinancialExtractor } = await import('./performance-financial-extractor');
      const extractor = new PerformanceFinancialExtractor();
      
      const financialData = await extractor.extractFinancialData(
        factsSummary,
        documents[0].documentType || 'FEASIBILITY_STUDY'
      );

      if (financialData && financialData.confidence > 0) {
        const { v4: uuidv4 } = await import('uuid');
        const finId = uuidv4();

        // Build INSERT statement dynamically for non-null fields
        const fields = ['id', 'project_id', 'source_document_id', 'confidence', 'extraction_method'];
        const values = [`'${finId}'`, this.projectId.toString(), `'${documents[0].id}'`, financialData.confidence.toString(), `'${financialData.extraction_method}'`];

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

        console.log(`[Consolidator] Saved financial data (confidence: ${(financialData.confidence * 100).toFixed(1)}%)`);
      }
    } catch (error) {
      console.error('[Consolidator] Financial extraction failed:', error);
    } finally {
      await projectDb.end();
    }
  }

  private async processWeatherFiles(): Promise<void> {
    const projectDb = mysql.createPool({
      host: '127.0.0.1',
      user: 'root',
      database: this.projectDbName,
    });

    try {
      // Get uploaded weather files
      const [weatherFiles]: any = await projectDb.execute(
        `SELECT id, file_url, file_name, file_size_bytes FROM weather_files`
      );

      if (!weatherFiles || weatherFiles.length === 0) {
        console.log('[Consolidator] No weather files found to process');
        return;
      }

      console.log(`[Consolidator] Processing ${weatherFiles.length} weather file(s)`);

      for (const weatherFile of weatherFiles) {
        try {
          // Read weather file from filesystem (for local files) or download (for URLs)
          let fileContent: string;
          
          if (weatherFile.file_url.startsWith('http://') || weatherFile.file_url.startsWith('https://')) {
            // Download from URL
            const axios = (await import('axios')).default;
            const response = await axios.get(weatherFile.file_url, {
              timeout: 30000,
              responseType: 'text'
            });
            fileContent = response.data;
          } else {
            // Read from local filesystem
            const fs = await import('fs/promises');
            fileContent = await fs.readFile(weatherFile.file_url, 'utf-8');
          }

          const { parseWeatherFile } = await import('./weather-file-extractor');
          const parsedData = parseWeatherFile(fileContent, weatherFile.file_name);

          if (parsedData && parsedData.monthlyData.length > 0) {
            // Store monthly irradiance data as JSON in the weather_files table
            const monthlyDataJson = JSON.stringify(parsedData.monthlyData).replace(/'/g, "''");
            const annualSummaryJson = JSON.stringify(parsedData.annualSummary).replace(/'/g, "''");
            const locationJson = JSON.stringify(parsedData.location).replace(/'/g, "''");

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

            console.log(`[Consolidator] Extracted location from weather file: ${parsedData.location.latitude}, ${parsedData.location.longitude}`);

            console.log(`[Consolidator] Parsed weather file ${weatherFile.file_name}:`);
            console.log(`  - Location: ${parsedData.location.latitude}, ${parsedData.location.longitude}`);
            console.log(`  - Annual GHI: ${parsedData.annualSummary.ghi_total_kwh_m2} kWh/m²`);
            console.log(`  - Annual DNI: ${parsedData.annualSummary.dni_total_kwh_m2} kWh/m²`);
            console.log(`  - Avg Temp: ${parsedData.annualSummary.temperature_avg_c}°C`);
          } else {
            console.log(`[Consolidator] Could not parse weather file ${weatherFile.file_name}`);
          }
        } catch (error) {
          console.error(`[Consolidator] Error processing weather file ${weatherFile.file_name}:`, error);
        }
      }
    } finally {
      await projectDb.end();
    }
  }

  private async consolidateLocation(): Promise<void> {
    const projectDb = mysql.createPool({
      host: '127.0.0.1',
      user: 'root',
      database: this.projectDbName,
    });

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
        console.log(`[Consolidator] Found location from weather file: ${wf.latitude}, ${wf.longitude}`);
      }

      // Source 2: Performance parameters (extracted from documents)
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
        console.log(`[Consolidator] Found location from performance parameters: ${pp.latitude}, ${pp.longitude}`);
      }

      // Source 3: Extract from document facts using LLM
      const [facts]: any = await projectDb.execute(
        `SELECT \`key\`, value FROM extracted_facts WHERE project_id = ${this.projectId} AND deleted_at IS NULL LIMIT 100`
      );

      if (facts && facts.length > 0) {
        const factsSummary = facts.map((f: any) => `${f.key}: ${f.value}`).join('\n');
        const extractedLocation = await locationService.extractLocationFromFacts(factsSummary);
        if (extractedLocation) {
          locationSources.push(extractedLocation);
          console.log(`[Consolidator] Extracted location from facts: ${extractedLocation.latitude}, ${extractedLocation.longitude}`);
        }
      }

      // Consolidate all sources
      if (locationSources.length > 0) {
        const consolidated = locationService.consolidateLocations(locationSources);
        if (consolidated) {
          console.log(`[Consolidator] Consolidated location: ${consolidated.latitude}, ${consolidated.longitude} (source: ${consolidated.source})`);

          // Update performance_parameters with consolidated location if not already set
          const [existing]: any = await projectDb.execute(
            `SELECT id FROM performance_parameters WHERE latitude IS NOT NULL LIMIT 1`
          );

          if (!existing || existing.length === 0) {
            // No location in performance_parameters, insert or update
            const [anyParams]: any = await projectDb.execute(
              `SELECT id FROM performance_parameters LIMIT 1`
            );

            if (anyParams && anyParams.length > 0) {
              // Update existing record
              await projectDb.execute(
                `UPDATE performance_parameters SET latitude = '${consolidated.latitude}', longitude = '${consolidated.longitude}' WHERE id = '${anyParams[0].id}'`
              );
              console.log('[Consolidator] Updated performance_parameters with consolidated location');
            } else {
              // Create new record
              const { v4: uuidv4 } = await import('uuid');
              const paramId = uuidv4();
              await projectDb.execute(
                `INSERT INTO performance_parameters (id, project_id, latitude, longitude, confidence, extraction_method) VALUES ('${paramId}', ${this.projectId}, '${consolidated.latitude}', '${consolidated.longitude}', ${consolidated.confidence}, 'location_consolidation')`
              );
              console.log('[Consolidator] Created performance_parameters with consolidated location');
            }
          }
        }
      } else {
        console.log('[Consolidator] No location sources found');
      }
    } catch (error) {
      console.error('[Consolidator] Location consolidation failed:', error);
    } finally {
      await projectDb.end();
    }
  }

  private async checkValidationTrigger(): Promise<void> {
    // TODO: Implement validation trigger check
    console.log('[Consolidator] Validation check not yet implemented');
  }
}
