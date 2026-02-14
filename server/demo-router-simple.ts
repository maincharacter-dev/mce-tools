import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { sql } from "drizzle-orm";

/**
 * Simplified demo router that creates prefixed tables in the main database
 * This approach works with TiDB Serverless without requiring separate database creation
 */
export const demoRouter = router({
  simulateWorkflow: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const prefix = input.projectId.replace(/-/g, "_");

      // Create prefixed tables for this project
      await db.execute(sql.raw(`
        CREATE TABLE IF NOT EXISTS \`${prefix}_documents\` (
          id VARCHAR(36) PRIMARY KEY,
          fileName VARCHAR(255) NOT NULL,
          filePath VARCHAR(500) NOT NULL,
          fileSizeBytes BIGINT NOT NULL,
          fileHash VARCHAR(64),
          documentType VARCHAR(50),
          uploadDate DATETIME NOT NULL,
          status VARCHAR(20) DEFAULT 'uploaded',
          extractedText LONGTEXT,
          pageCount INT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `));

      await db.execute(sql.raw(`
        CREATE TABLE IF NOT EXISTS \`${prefix}_facts\` (
          id VARCHAR(36) PRIMARY KEY,
          category VARCHAR(100) NOT NULL,
          \`key\` VARCHAR(255) NOT NULL,
          value TEXT NOT NULL,
          dataType VARCHAR(50),
          confidence DECIMAL(5,2),
          sourceDocumentId VARCHAR(36),
          sourceLocation TEXT,
          extractionMethod VARCHAR(50),
          extractionModel VARCHAR(100),
          verified BOOLEAN DEFAULT FALSE,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `));

      await db.execute(sql.raw(`
        CREATE TABLE IF NOT EXISTS \`${prefix}_redFlags\` (
          id VARCHAR(36) PRIMARY KEY,
          category VARCHAR(100) NOT NULL,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          severity VARCHAR(20),
          triggerFactId VARCHAR(36),
          downstreamConsequences TEXT,
          mitigated BOOLEAN DEFAULT FALSE,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `));

      await db.execute(sql.raw(`
        CREATE TABLE IF NOT EXISTS \`${prefix}_processingJobs\` (
          id VARCHAR(36) PRIMARY KEY,
          documentId VARCHAR(36),
          jobType VARCHAR(50),
          status VARCHAR(20),
          progress INT DEFAULT 0,
          startedAt DATETIME,
          completedAt DATETIME,
          errorMessage TEXT
        )
      `));

      // Insert dummy documents
      const docId1 = "doc-001-clare-im";
      const docId2 = "doc-002-grid-study";
      const docId3 = "doc-003-geotech";
      const docId4 = "doc-004-planning";

      await db.execute(sql.raw(`
        INSERT INTO \`${prefix}_documents\` (id, fileName, filePath, fileSizeBytes, fileHash, documentType, uploadDate, status, extractedText, pageCount)
        VALUES 
          ('${docId1}', 'Clare_Solar_Farm_IM_v2.1.pdf', '/uploads/${prefix}/${docId1}.pdf', 2458624, 'a1b2c3d4e5f6', 'Information Memorandum', NOW(), 'processed', 'Extracted text from IM...', 45),
          ('${docId2}', 'Grid_Connection_Study_Final.pdf', '/uploads/${prefix}/${docId2}.pdf', 1856432, 'f6e5d4c3b2a1', 'Grid Study', NOW(), 'processed', 'Extracted text from grid study...', 32),
          ('${docId3}', 'Geotechnical_Investigation_Report.pdf', '/uploads/${prefix}/${docId3}.pdf', 3245678, 'b2c3d4e5f6a1', 'Geotech Report', NOW(), 'processed', 'Extracted text from geotech...', 28),
          ('${docId4}', 'Planning_Approval_Application.pdf', '/uploads/${prefix}/${docId4}.pdf', 1234567, 'c3d4e5f6a1b2', 'Planning Document', NOW(), 'processed', 'Extracted text from planning...', 18)
      `));

      // Insert dummy facts
      await db.execute(sql.raw(`
        INSERT INTO \`${prefix}_facts\` (id, category, \`key\`, value, dataType, confidence, sourceDocumentId, sourceLocation, extractionMethod, extractionModel, verified)
        VALUES 
          ('fact-001', 'Project_Details', 'Project Name', 'Clare Solar Farm', 'string', 0.98, '${docId1}', 'Page 1, Section 1.1', 'deterministic', NULL, TRUE),
          ('fact-002', 'Technical_Specifications', 'Total Capacity (MW)', '150', 'number', 0.95, '${docId1}', 'Page 3, Table 2', 'deterministic', NULL, TRUE),
          ('fact-003', 'Technical_Specifications', 'Technology Type', 'Bifacial PV Modules', 'string', 0.92, '${docId1}', 'Page 5', 'llm', 'llama3', FALSE),
          ('fact-004', 'Grid_Connection', 'Connection Point', 'Clare 132kV Substation', 'string', 0.96, '${docId2}', 'Page 2', 'deterministic', NULL, TRUE),
          ('fact-005', 'Grid_Connection', 'Grid Capacity Constraint', 'Limited to 100MW during peak', 'string', 0.88, '${docId2}', 'Page 8, Section 3.2', 'llm', 'llama3', FALSE),
          ('fact-006', 'Timeline', 'Expected COD', '2026-Q3', 'date', 0.90, '${docId1}', 'Page 12', 'deterministic', NULL, FALSE),
          ('fact-007', 'Financial', 'Estimated CAPEX', '\\$225M AUD', 'currency', 0.85, '${docId1}', 'Page 15', 'llm', 'llama3', FALSE),
          ('fact-008', 'Site_Conditions', 'Soil Type', 'Clay with moderate bearing capacity', 'string', 0.80, '${docId3}', 'Page 5', 'llm', 'llama3', FALSE),
          ('fact-009', 'Planning', 'Planning Approval Status', 'Pending - submitted Dec 2025', 'string', 0.94, '${docId4}', 'Page 1', 'deterministic', NULL, TRUE),
          ('fact-010', 'Risk', 'Grid Curtailment Risk', 'High - 30% curtailment expected', 'string', 0.75, '${docId2}', 'Page 12', 'llm', 'llama3', FALSE)
      `));

      // Insert dummy red flags
      await db.execute(sql.raw(`
        INSERT INTO \`${prefix}_redFlags\` (id, category, title, description, severity, triggerFactId, downstreamConsequences, mitigated)
        VALUES 
          ('flag-001', 'Grid', 'Grid Capacity Constraint Identified', 'Connection point limited to 100MW during peak demand, project capacity is 150MW', 'high', 'fact-005', 'Potential revenue loss due to curtailment, may require grid augmentation', FALSE),
          ('flag-002', 'Planning', 'Planning Approval Not Yet Granted', 'Planning application submitted but approval pending, COD at risk', 'medium', 'fact-009', 'Project timeline delay, potential cost overruns', FALSE),
          ('flag-003', 'Grid', 'High Curtailment Risk', '30% curtailment expected based on grid study, impacts project economics', 'high', 'fact-010', 'Reduced revenue, longer payback period', FALSE),
          ('flag-004', 'Performance', 'Soil Conditions May Impact Foundation Design', 'Clay soil with moderate bearing capacity may require specialized foundations', 'low', 'fact-008', 'Increased CAPEX for foundations', FALSE)
      `));

      // Insert dummy processing jobs
      await db.execute(sql.raw(`
        INSERT INTO \`${prefix}_processingJobs\` (id, documentId, jobType, status, progress, startedAt, completedAt, errorMessage)
        VALUES 
          ('job-001', '${docId1}', 'text_extraction', 'completed', 100, DATE_SUB(NOW(), INTERVAL 2 HOUR), DATE_SUB(NOW(), INTERVAL 1 HOUR 55 MINUTE), NULL),
          ('job-002', '${docId1}', 'fact_extraction', 'completed', 100, DATE_SUB(NOW(), INTERVAL 1 HOUR 55 MINUTE), DATE_SUB(NOW(), INTERVAL 1 HOUR 45 MINUTE), NULL),
          ('job-003', '${docId2}', 'text_extraction', 'completed', 100, DATE_SUB(NOW(), INTERVAL 1 HOUR 30 MINUTE), DATE_SUB(NOW(), INTERVAL 1 HOUR 25 MINUTE), NULL),
          ('job-004', '${docId2}', 'fact_extraction', 'processing', 65, DATE_SUB(NOW(), INTERVAL 1 HOUR 25 MINUTE), NULL, NULL)
      `));

      return {
        success: true,
        message: "Demo data loaded successfully",
        stats: {
          documents: 4,
          facts: 10,
          redFlags: 4,
          processingJobs: 4,
        },
      };
    }),
});
