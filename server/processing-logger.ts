/**
 * Processing Logger
 * 
 * Writes processing logs to the database for real-time UI display
 */

import { createProjectDbPool } from './db-connection';
import { v4 as uuidv4 } from 'uuid';

export type ProcessingStep = 
  | 'Upload' 
  | 'Text_Extraction' 
  | 'Deterministic_Extraction' 
  | 'LLM_Extraction' 
  | 'Consolidation' 
  | 'Red_Flag_Detection' 
  | 'Complete';

export type ProcessingStatus = 'Started' | 'In_Progress' | 'Completed' | 'Failed';

export interface LogEntry {
  projectId: number;
  documentId: string;
  step: ProcessingStep;
  status: ProcessingStatus;
  message: string;
  durationMs?: number;
}

/**
 * Write a processing log entry to the database
 */
export async function writeProcessingLog(entry: LogEntry): Promise<void> {
  const projectDb = createProjectDbPool(entry.projectId);
  
  try {
    const id = uuidv4();
    await projectDb.execute(
      `INSERT INTO processingLogs (id, documentId, step, status, message, durationMs, createdAt) 
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [id, entry.documentId, entry.step, entry.status, entry.message, entry.durationMs || null]
    );
  } catch (error) {
    // Don't throw - logging failures shouldn't break processing
    console.error('[Processing Logger] Failed to write log:', error);
  } finally {
    await projectDb.end();
  }
}

/**
 * Create a logger instance for a specific document
 */
export function createDocumentLogger(projectId: number, documentId: string) {
  const startTimes: Map<ProcessingStep, number> = new Map();
  
  return {
    start: async (step: ProcessingStep, message: string) => {
      startTimes.set(step, Date.now());
      await writeProcessingLog({
        projectId,
        documentId,
        step,
        status: 'Started',
        message,
      });
    },
    
    progress: async (step: ProcessingStep, message: string) => {
      await writeProcessingLog({
        projectId,
        documentId,
        step,
        status: 'In_Progress',
        message,
      });
    },
    
    complete: async (step: ProcessingStep, message: string) => {
      const startTime = startTimes.get(step);
      const durationMs = startTime ? Date.now() - startTime : undefined;
      
      await writeProcessingLog({
        projectId,
        documentId,
        step,
        status: 'Completed',
        message,
        durationMs,
      });
    },
    
    fail: async (step: ProcessingStep, message: string) => {
      const startTime = startTimes.get(step);
      const durationMs = startTime ? Date.now() - startTime : undefined;
      
      await writeProcessingLog({
        projectId,
        documentId,
        step,
        status: 'Failed',
        message,
        durationMs,
      });
    },
  };
}
