/**
 * Validation Auto-Trigger System
 * 
 * Automatically triggers performance validation when all required data is available:
 * - Performance parameters extracted
 * - Weather file available (extracted or manual)
 * - Project location data present
 * 
 * Author: Manus AI
 * Date: January 24, 2026
 */

import mysql from 'mysql2/promise';
import axios from 'axios';

export interface ValidationTriggerCheck {
  canTrigger: boolean;
  reason: string;
  missingData: string[];
  performanceParamsId?: string;
  weatherFileId?: string;
}

export class ValidationTrigger {
  /**
   * Check if project has all data needed for validation
   */
  async checkValidationReadiness(
    projectId: number,
    projectDbName: string
  ): Promise<ValidationTriggerCheck> {
    const projectDb = mysql.createPool({
      host: '127.0.0.1',
      user: 'root',
      database: projectDbName,
    });

    try {
      const missingData: string[] = [];

      // Check for performance parameters
      const [perfParams] = await projectDb.execute<any[]>(
        `SELECT id, dc_capacity_mw, ac_capacity_mw, latitude, longitude 
         FROM performance_parameters 
         WHERE project_id = ? 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [projectId]
      );

      if (!perfParams || perfParams.length === 0) {
        missingData.push('performance_parameters');
      } else {
        const params = perfParams[0];
        if (!params.dc_capacity_mw) missingData.push('dc_capacity');
        if (!params.ac_capacity_mw) missingData.push('ac_capacity');
        if (!params.latitude) missingData.push('latitude');
        if (!params.longitude) missingData.push('longitude');
      }

      // Check for weather file
      const [weatherFiles] = await projectDb.execute<any[]>(
        `SELECT id, status, original_format 
         FROM weather_files 
         WHERE project_id = ? AND is_active = 1 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [projectId]
      );

      if (!weatherFiles || weatherFiles.length === 0) {
        missingData.push('weather_file');
      } else {
        const weatherFile = weatherFiles[0];
        if (weatherFile.status === 'failed') {
          missingData.push('weather_file (processing failed)');
        }
      }

      await projectDb.end();

      const canTrigger = missingData.length === 0;

      return {
        canTrigger,
        reason: canTrigger 
          ? 'All required data available' 
          : `Missing: ${missingData.join(', ')}`,
        missingData,
        performanceParamsId: perfParams && perfParams.length > 0 ? perfParams[0].id : undefined,
        weatherFileId: weatherFiles && weatherFiles.length > 0 ? weatherFiles[0].id : undefined
      };
    } catch (error) {
      await projectDb.end();
      throw error;
    }
  }

  /**
   * Trigger performance validation
   */
  async triggerValidation(
    projectId: number,
    projectDbName: string,
    performanceParamsId: string,
    weatherFileId: string
  ): Promise<{ validationId: string; status: string }> {
    console.log(`[Validation Trigger] Starting validation for project ${projectId}`);

    const projectDb = mysql.createPool({
      host: '127.0.0.1',
      user: 'root',
      database: projectDbName,
    });

    try {
      // Fetch performance parameters
      const [perfParams] = await projectDb.execute<any[]>(
        `SELECT * FROM performance_parameters WHERE id = ?`,
        [performanceParamsId]
      );

      if (!perfParams || perfParams.length === 0) {
        throw new Error('Performance parameters not found');
      }

      const params = perfParams[0];

      // Fetch weather file
      const [weatherFiles] = await projectDb.execute<any[]>(
        `SELECT * FROM weather_files WHERE id = ?`,
        [weatherFileId]
      );

      if (!weatherFiles || weatherFiles.length === 0) {
        throw new Error('Weather file not found');
      }

      const weatherFile = weatherFiles[0];

      // TODO: Call Solar Analyzer API
      // For now, create a placeholder validation record
      const { v4: uuidv4 } = await import('uuid');
      const validationId = uuidv4();
      const calculationId = `calc_${Date.now()}`;

      // Create validation record with "pending" status
      await projectDb.execute(
        `INSERT INTO performance_validations (
          id, project_id, calculation_id, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, NOW(), NOW())`,
        [validationId, projectId, calculationId, 'pending']
      );

      console.log(`[Validation Trigger] Created validation record: ${validationId}`);

      // Update weather file to mark it as used
      await projectDb.execute(
        `UPDATE weather_files SET used_in_validation_id = ?, updated_at = NOW() WHERE id = ?`,
        [validationId, weatherFileId]
      );

      await projectDb.end();

      // TODO: Trigger async validation job
      // This would call the Solar Analyzer API with:
      // - Performance parameters from params
      // - Weather file from weatherFile.file_url
      // - Store results in performance_validations table

      return {
        validationId,
        status: 'pending'
      };
    } catch (error) {
      await projectDb.end();
      throw error;
    }
  }

  /**
   * Auto-trigger validation after document processing
   */
  async autoTriggerIfReady(
    projectId: number,
    projectDbName: string
  ): Promise<{ triggered: boolean; validationId?: string; reason: string }> {
    try {
      // Check if validation is ready
      const check = await this.checkValidationReadiness(projectId, projectDbName);

      if (!check.canTrigger) {
        console.log(`[Validation Trigger] Not ready: ${check.reason}`);
        return {
          triggered: false,
          reason: check.reason
        };
      }

      // Check if validation already exists
      const projectDb = mysql.createPool({
        host: '127.0.0.1',
        user: 'root',
        database: projectDbName,
      });

      const [existingValidations] = await projectDb.execute<any[]>(
        `SELECT id FROM performance_validations WHERE project_id = ? LIMIT 1`,
        [projectId]
      );

      await projectDb.end();

      if (existingValidations && existingValidations.length > 0) {
        console.log(`[Validation Trigger] Validation already exists`);
        return {
          triggered: false,
          reason: 'Validation already exists'
        };
      }

      // Trigger validation
      const result = await this.triggerValidation(
        projectId,
        projectDbName,
        check.performanceParamsId!,
        check.weatherFileId!
      );

      console.log(`[Validation Trigger] Triggered validation: ${result.validationId}`);

      return {
        triggered: true,
        validationId: result.validationId,
        reason: 'Validation triggered successfully'
      };
    } catch (error) {
      console.error(`[Validation Trigger] Error:`, error);
      return {
        triggered: false,
        reason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}
