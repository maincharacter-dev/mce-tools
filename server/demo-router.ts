import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db"; // This import sets DATABASE_URL if not already set

export const demoRouter = router({
  simulateWorkflow: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const projectId = input.projectId;

      // Get project details to find dbName
      const { getProjectById } = await import("./db");
      const project = await getProjectById(projectId);
      if (!project) throw new Error("Project not found");

      // Generate IDs for documents
      const docId1 = "doc-001-clare-im";
      const docId2 = "doc-002-grid-study";
      const docId3 = "doc-003-geotech";
      const docId4 = "doc-004-planning";

      // Get project database connection using dbName
      const mysql = await import("mysql2/promise");
      const url = new URL(process.env.DATABASE_URL!);
      url.pathname = `/${project.dbName}`;
      const projectDb = await mysql.default.createConnection(url.toString());
      
      // Delete existing demo data (no project_id in per-project database)
      // Wrap in try-catch in case tables don't exist yet
      try {
        await projectDb.execute(`DELETE FROM processing_jobs`);
      } catch (e) { /* Table might not exist */ }
      try {
        await projectDb.execute(`DELETE FROM redFlags`);
      } catch (e) { /* Table might not exist */ }
      try {
        await projectDb.execute(`DELETE FROM extracted_facts`);
      } catch (e) { /* Table might not exist */ }
      try {
        await projectDb.execute(`DELETE FROM documents`);
      } catch (e) { /* Table might not exist */ }

      const now = new Date();
      // Convert to MySQL datetime format (YYYY-MM-DD HH:MM:SS)
      const formatDateTime = (date: Date) => {
        return date.toISOString().slice(0, 19).replace('T', ' ');
      };
      const nowStr = formatDateTime(now);

      // Helper to escape SQL strings
      const escapeSQL = (str: string | null) => {
        if (str === null) return 'NULL';
        return `'${str.replace(/'/g, "''")}'`;
      };

      // Insert dummy documents using raw SQL with camelCase columns
      await projectDb.execute(`
        INSERT INTO documents (id, fileName, filePath, fileSizeBytes, fileHash, documentType, uploadDate, status, extractedText, pageCount) 
        VALUES (${escapeSQL(docId1)}, ${escapeSQL("Clare_Solar_Farm_IM_v2.1.pdf")}, ${escapeSQL(`/uploads/project_${projectId}/${docId1}.pdf`)}, 2458624, ${escapeSQL("a1b2c3d4e5f6")}, ${escapeSQL("IM")}, ${escapeSQL(nowStr)}, ${escapeSQL("Processed")}, ${escapeSQL("Extracted text from IM document...")}, 45)
      `);
      
      await projectDb.execute(`
        INSERT INTO documents (id, fileName, filePath, fileSizeBytes, fileHash, documentType, uploadDate, status, extractedText, pageCount) 
        VALUES (${escapeSQL(docId2)}, ${escapeSQL("Grid_Connection_Study_Final.pdf")}, ${escapeSQL(`/uploads/project_${projectId}/${docId2}.pdf`)}, 1856432, ${escapeSQL("f6e5d4c3b2a1")}, ${escapeSQL("Grid_Study")}, ${escapeSQL(nowStr)}, ${escapeSQL("Processed")}, ${escapeSQL("Extracted text from grid study...")}, 32)
      `);
      
      await projectDb.execute(`
        INSERT INTO documents (id, fileName, filePath, fileSizeBytes, fileHash, documentType, uploadDate, status, extractedText, pageCount) 
        VALUES (${escapeSQL(docId3)}, ${escapeSQL("Geotechnical_Investigation_Report.pdf")}, ${escapeSQL(`/uploads/project_${projectId}/${docId3}.pdf`)}, 3245678, ${escapeSQL("b2c3d4e5f6a1")}, ${escapeSQL("Design")}, ${escapeSQL(nowStr)}, ${escapeSQL("Processed")}, ${escapeSQL("Extracted text from geotech report...")}, 28)
      `);
      
      await projectDb.execute(`
        INSERT INTO documents (id, fileName, filePath, fileSizeBytes, fileHash, documentType, uploadDate, status, extractedText, pageCount) 
        VALUES (${escapeSQL(docId4)}, ${escapeSQL("Planning_Approval_Application.pdf")}, ${escapeSQL(`/uploads/project_${projectId}/${docId4}.pdf`)}, 1234567, ${escapeSQL("c3d4e5f6a1b2")}, ${escapeSQL("Planning")}, ${escapeSQL(nowStr)}, ${escapeSQL("Processed")}, ${escapeSQL("Extracted text from planning document...")}, 18)
      `);

      // Insert dummy facts using raw SQL (extracted_facts table has project_id)
      await projectDb.execute(`
        INSERT INTO extracted_facts (id, project_id, category, \`key\`, value, data_type, confidence, source_document_id, source_location, extraction_method, extraction_model, verified, verification_status) 
        VALUES (${escapeSQL("fact-001")}, ${projectId}, ${escapeSQL("Project_Details")}, ${escapeSQL("Project Name")}, ${escapeSQL("Clare Solar Farm")}, ${escapeSQL("string")}, ${escapeSQL("0.98")}, ${escapeSQL(docId1)}, ${escapeSQL("Page 1, Section 1.1")}, ${escapeSQL("deterministic")}, NULL, 1, ${escapeSQL("approved")})
      `);
      
      await projectDb.execute(`
        INSERT INTO extracted_facts (id, project_id, category, \`key\`, value, data_type, confidence, source_document_id, source_location, extraction_method, extraction_model, verified, verification_status) 
        VALUES (${escapeSQL("fact-002")}, ${projectId}, ${escapeSQL("Technical_Specifications")}, ${escapeSQL("Total Capacity (MW)")}, ${escapeSQL("150")}, ${escapeSQL("number")}, ${escapeSQL("0.95")}, ${escapeSQL(docId1)}, ${escapeSQL("Page 3, Table 2")}, ${escapeSQL("deterministic")}, NULL, 1, ${escapeSQL("approved")})
      `);
      
      await projectDb.execute(`
        INSERT INTO extracted_facts (id, project_id, category, \`key\`, value, data_type, confidence, source_document_id, source_location, extraction_method, extraction_model, verified, verification_status) 
        VALUES (${escapeSQL("fact-003")}, ${projectId}, ${escapeSQL("Technical_Specifications")}, ${escapeSQL("Technology Type")}, ${escapeSQL("Bifacial PV Modules")}, ${escapeSQL("string")}, ${escapeSQL("0.92")}, ${escapeSQL(docId1)}, ${escapeSQL("Page 5")}, ${escapeSQL("llm")}, ${escapeSQL("llama3")}, 0, ${escapeSQL("pending")})
      `);
      
      await projectDb.execute(`
        INSERT INTO extracted_facts (id, project_id, category, \`key\`, value, data_type, confidence, source_document_id, source_location, extraction_method, extraction_model, verified, verification_status) 
        VALUES (${escapeSQL("fact-004")}, ${projectId}, ${escapeSQL("Grid_Connection")}, ${escapeSQL("Connection Point")}, ${escapeSQL("Clare 132kV Substation")}, ${escapeSQL("string")}, ${escapeSQL("0.96")}, ${escapeSQL(docId2)}, ${escapeSQL("Page 2")}, ${escapeSQL("deterministic")}, NULL, 1, ${escapeSQL("approved")})
      `);
      
      await projectDb.execute(`
        INSERT INTO extracted_facts (id, project_id, category, \`key\`, value, data_type, confidence, source_document_id, source_location, extraction_method, extraction_model, verified, verification_status) 
        VALUES (${escapeSQL("fact-005")}, ${projectId}, ${escapeSQL("Grid_Connection")}, ${escapeSQL("Grid Capacity Constraint")}, ${escapeSQL("Limited to 100MW during peak")}, ${escapeSQL("string")}, ${escapeSQL("0.88")}, ${escapeSQL(docId2)}, ${escapeSQL("Page 8, Section 3.2")}, ${escapeSQL("llm")}, ${escapeSQL("llama3")}, 0, ${escapeSQL("pending")})
      `);
      
      await projectDb.execute(`
        INSERT INTO extracted_facts (id, project_id, category, \`key\`, value, data_type, confidence, source_document_id, source_location, extraction_method, extraction_model, verified, verification_status) 
        VALUES (${escapeSQL("fact-006")}, ${projectId}, ${escapeSQL("Timeline")}, ${escapeSQL("Expected COD")}, ${escapeSQL("2026-Q3")}, ${escapeSQL("date")}, ${escapeSQL("0.90")}, ${escapeSQL(docId1)}, ${escapeSQL("Page 12")}, ${escapeSQL("deterministic")}, NULL, 0, ${escapeSQL("pending")})
      `);
      
      await projectDb.execute(`
        INSERT INTO extracted_facts (id, project_id, category, \`key\`, value, data_type, confidence, source_document_id, source_location, extraction_method, extraction_model, verified, verification_status) 
        VALUES (${escapeSQL("fact-007")}, ${projectId}, ${escapeSQL("Financial")}, ${escapeSQL("Estimated CAPEX")}, ${escapeSQL("$225M AUD")}, ${escapeSQL("currency")}, ${escapeSQL("0.85")}, ${escapeSQL(docId1)}, ${escapeSQL("Page 15")}, ${escapeSQL("llm")}, ${escapeSQL("llama3")}, 0, ${escapeSQL("pending")})
      `);
      
      await projectDb.execute(`
        INSERT INTO extracted_facts (id, project_id, category, \`key\`, value, data_type, confidence, source_document_id, source_location, extraction_method, extraction_model, verified, verification_status) 
        VALUES (${escapeSQL("fact-008")}, ${projectId}, ${escapeSQL("Site_Conditions")}, ${escapeSQL("Soil Type")}, ${escapeSQL("Clay with moderate bearing capacity")}, ${escapeSQL("string")}, ${escapeSQL("0.80")}, ${escapeSQL(docId3)}, ${escapeSQL("Page 5")}, ${escapeSQL("llm")}, ${escapeSQL("llama3")}, 0, ${escapeSQL("pending")})
      `);
      
      await projectDb.execute(`
        INSERT INTO extracted_facts (id, project_id, category, \`key\`, value, data_type, confidence, source_document_id, source_location, extraction_method, extraction_model, verified, verification_status) 
        VALUES (${escapeSQL("fact-009")}, ${projectId}, ${escapeSQL("Planning")}, ${escapeSQL("Planning Approval Status")}, ${escapeSQL("Pending - submitted Dec 2025")}, ${escapeSQL("string")}, ${escapeSQL("0.94")}, ${escapeSQL(docId4)}, ${escapeSQL("Page 1")}, ${escapeSQL("deterministic")}, NULL, 1, ${escapeSQL("approved")})
      `);
      
      await projectDb.execute(`
        INSERT INTO extracted_facts (id, project_id, category, \`key\`, value, data_type, confidence, source_document_id, source_location, extraction_method, extraction_model, verified, verification_status) 
        VALUES (${escapeSQL("fact-010")}, ${projectId}, ${escapeSQL("Risk")}, ${escapeSQL("Grid Curtailment Risk")}, ${escapeSQL("High - 30% curtailment expected")}, ${escapeSQL("string")}, ${escapeSQL("0.75")}, ${escapeSQL(docId2)}, ${escapeSQL("Page 12")}, ${escapeSQL("llm")}, ${escapeSQL("llama3")}, 0, ${escapeSQL("pending")})
      `);

      // Insert dummy red flags using raw SQL (redFlags table is per-project, no project_id column)
      await projectDb.execute(`
        INSERT INTO redFlags (id, category, title, description, severity, triggerFactId, downstreamConsequences, mitigated) 
        VALUES (${escapeSQL("flag-001")}, ${escapeSQL("Grid")}, ${escapeSQL("Grid Capacity Constraint Identified")}, ${escapeSQL("Connection point limited to 100MW during peak demand, project capacity is 150MW")}, ${escapeSQL("High")}, ${escapeSQL("fact-005")}, ${escapeSQL("Potential revenue loss due to curtailment, may require grid augmentation")}, 0)
      `);
      
      await projectDb.execute(`
        INSERT INTO redFlags (id, category, title, description, severity, triggerFactId, downstreamConsequences, mitigated) 
        VALUES (${escapeSQL("flag-002")}, ${escapeSQL("Planning")}, ${escapeSQL("Planning Approval Not Yet Granted")}, ${escapeSQL("Planning application submitted but approval pending, COD at risk")}, ${escapeSQL("Medium")}, ${escapeSQL("fact-009")}, ${escapeSQL("Project timeline delay, potential cost overruns")}, 0)
      `);
      
      await projectDb.execute(`
        INSERT INTO redFlags (id, category, title, description, severity, triggerFactId, downstreamConsequences, mitigated) 
        VALUES (${escapeSQL("flag-003")}, ${escapeSQL("Grid")}, ${escapeSQL("High Curtailment Risk")}, ${escapeSQL("30% curtailment expected based on grid study, impacts project economics")}, ${escapeSQL("High")}, ${escapeSQL("fact-010")}, ${escapeSQL("Reduced revenue, longer payback period")}, 0)
      `);
      
      await projectDb.execute(`
        INSERT INTO redFlags (id, category, title, description, severity, triggerFactId, downstreamConsequences, mitigated) 
        VALUES (${escapeSQL("flag-004")}, ${escapeSQL("Performance")}, ${escapeSQL("Soil Conditions May Impact Foundation Design")}, ${escapeSQL("Clay soil with moderate bearing capacity may require specialized foundations")}, ${escapeSQL("Low")}, ${escapeSQL("fact-008")}, ${escapeSQL("Increased CAPEX for foundations")}, 0)
      `);

      // Insert dummy processing jobs using raw SQL (processing_jobs table has document_id but no project_id based on schema)
      const twoHoursAgo = formatDateTime(new Date(now.getTime() - 2 * 60 * 60 * 1000));
      const oneHour55Ago = formatDateTime(new Date(now.getTime() - 115 * 60 * 1000));
      const oneHour45Ago = formatDateTime(new Date(now.getTime() - 105 * 60 * 1000));
      const oneHour30Ago = formatDateTime(new Date(now.getTime() - 90 * 60 * 1000));
      const oneHour25Ago = formatDateTime(new Date(now.getTime() - 85 * 60 * 1000));

      await projectDb.execute(`
        INSERT INTO processing_jobs (document_id, status, stage, progress_percent, started_at, completed_at) 
        VALUES (${escapeSQL(docId1)}, ${escapeSQL("completed")}, ${escapeSQL("text_extraction")}, 100, ${escapeSQL(twoHoursAgo)}, ${escapeSQL(oneHour55Ago)})
      `);
      
      await projectDb.execute(`
        INSERT INTO processing_jobs (document_id, status, stage, progress_percent, started_at, completed_at) 
        VALUES (${escapeSQL(docId2)}, ${escapeSQL("completed")}, ${escapeSQL("text_extraction")}, 100, ${escapeSQL(oneHour45Ago)}, ${escapeSQL(oneHour30Ago)})
      `);
      
      await projectDb.execute(`
        INSERT INTO processing_jobs (document_id, status, stage, progress_percent, started_at, completed_at) 
        VALUES (${escapeSQL(docId3)}, ${escapeSQL("completed")}, ${escapeSQL("text_extraction")}, 100, ${escapeSQL(oneHour30Ago)}, ${escapeSQL(oneHour25Ago)})
      `);
      
      await projectDb.execute(`
        INSERT INTO processing_jobs (document_id, status, stage, progress_percent, started_at) 
        VALUES (${escapeSQL(docId4)}, ${escapeSQL("processing")}, ${escapeSQL("fact_extraction")}, 65, ${escapeSQL(oneHour25Ago)})
      `);

      // Close the connection
      await projectDb.end();

      return {
        success: true,
        stats: {
          documents: 4,
          facts: 10,
          redFlags: 4,
          processingJobs: 4,
        },
      };
    }),
});
