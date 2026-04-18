/**
 * Report Router
 *
 * Handles all report draft management and generation endpoints for the
 * Deliverables page and Report Builder workflow.
 */

import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { createMainDbPool } from "./db-connection";
import { drizzle } from "drizzle-orm/mysql2";
import {
  generateReportFromContent,
  generateSectionContent,
  proposeTableOfContents,
  refineSectionContent,
  type ReportSection,
  type ReportMetadata,
} from "./report-generator";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMainDb() {
  const pool = createMainDbPool();
  return { pool, db: drizzle(pool) };
}

async function getDraft(pool: any, draftId: number, projectId: number) {
  const [rows] = await pool.execute(
    "SELECT * FROM report_drafts WHERE id = ? AND project_id = ?",
    [draftId, projectId]
  ) as any;
  const row = rows[0];
  if (!row) return null;
  return {
    ...row,
    sections: row.sections ? JSON.parse(row.sections) : null,
    content: row.content ? JSON.parse(row.content) : null,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
  };
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const reportRouter = router({

  // List all in-progress drafts for a project
  listDrafts: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      const { pool } = getMainDb();
      try {
        const [rows] = await pool.execute(
          `SELECT id, project_id, report_type, step, project_name, project_type,
                  generation_status, content_generation_status,
                  created_at, updated_at
           FROM report_drafts
           WHERE project_id = ? AND (generation_status IS NULL OR generation_status != 'completed')
           ORDER BY updated_at DESC`,
          [input.projectId]
        ) as any;
        return rows;
      } finally {
        await pool.end();
      }
    }),

  // List completed generated reports for a project
  listByProject: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      const { pool } = getMainDb();
      try {
        const [rows] = await pool.execute(
          `SELECT id, project_id, draft_id, report_type, filename, file_key,
                  file_size_bytes, download_url, download_url_expires_at, created_at
           FROM generated_reports
           WHERE project_id = ?
           ORDER BY created_at DESC`,
          [input.projectId]
        ) as any;
        return rows;
      } finally {
        await pool.end();
      }
    }),

  // Get a single draft by ID
  getDraft: protectedProcedure
    .input(z.object({ draftId: z.number(), projectId: z.number() }))
    .query(async ({ input }) => {
      const { pool } = getMainDb();
      try {
        const draft = await getDraft(pool, input.draftId, input.projectId);
        if (!draft) throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found" });
        return draft;
      } finally {
        await pool.end();
      }
    }),

  // Create a new draft (Step 1: Structure)
  createDraft: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      projectName: z.string(),
      reportType: z.string().default("dd_report"),
    }))
    .mutation(async ({ input }) => {
      const { pool, db } = getMainDb();
      try {
        console.log(`[Report Router] Creating draft for project ${input.projectId}`);

        // Propose table of contents using AI
        const { sections, projectType, dataSummary } = await proposeTableOfContents(
          db as any,
          input.projectId,
          input.projectName
        );

        const [result] = await pool.execute(
          `INSERT INTO report_drafts
           (project_id, report_type, step, project_name, sections, project_type, data_summary)
           VALUES (?, ?, 'structure', ?, ?, ?, ?)`,
          [
            input.projectId,
            input.reportType,
            input.projectName,
            JSON.stringify(sections),
            projectType,
            dataSummary,
          ]
        ) as any;

        return { draftId: result.insertId, sections, projectType, dataSummary };
      } finally {
        await pool.end();
      }
    }),

  // Update section structure (reorder, rename, add, remove)
  updateStructure: protectedProcedure
    .input(z.object({
      draftId: z.number(),
      projectId: z.number(),
      sections: z.array(z.object({
        id: z.string(),
        title: z.string(),
        prompt: z.string().optional(),
        wordTarget: z.number().optional(),
        order: z.number(),
        included: z.boolean().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      const { pool } = getMainDb();
      try {
        await pool.execute(
          "UPDATE report_drafts SET sections = ?, step = 'content', updated_at = NOW() WHERE id = ? AND project_id = ?",
          [JSON.stringify(input.sections), input.draftId, input.projectId]
        );
        return { success: true };
      } finally {
        await pool.end();
      }
    }),

  // Update metadata (project name, client, preparer, etc.)
  updateMetadata: protectedProcedure
    .input(z.object({
      draftId: z.number(),
      projectId: z.number(),
      metadata: z.record(z.string()),
    }))
    .mutation(async ({ input }) => {
      const { pool } = getMainDb();
      try {
        await pool.execute(
          "UPDATE report_drafts SET metadata = ?, updated_at = NOW() WHERE id = ? AND project_id = ?",
          [JSON.stringify(input.metadata), input.draftId, input.projectId]
        );
        return { success: true };
      } finally {
        await pool.end();
      }
    }),

  // Update a single section's content
  updateSectionContent: protectedProcedure
    .input(z.object({
      draftId: z.number(),
      projectId: z.number(),
      sectionId: z.string(),
      content: z.string(),
    }))
    .mutation(async ({ input }) => {
      const { pool } = getMainDb();
      try {
        const draft = await getDraft(pool, input.draftId, input.projectId);
        if (!draft) throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found" });

        const existingContent = draft.content || {};
        existingContent[input.sectionId] = input.content;

        await pool.execute(
          "UPDATE report_drafts SET content = ?, updated_at = NOW() WHERE id = ? AND project_id = ?",
          [JSON.stringify(existingContent), input.draftId, input.projectId]
        );
        return { success: true };
      } finally {
        await pool.end();
      }
    }),

  // Generate content for a single section
  generateSection: protectedProcedure
    .input(z.object({
      draftId: z.number(),
      projectId: z.number(),
      sectionId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const { pool, db } = getMainDb();
      try {
        const draft = await getDraft(pool, input.draftId, input.projectId);
        if (!draft) throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found" });

        const sections: ReportSection[] = draft.sections || [];
        const section = sections.find((s: ReportSection) => s.id === input.sectionId);
        if (!section) throw new TRPCError({ code: "NOT_FOUND", message: "Section not found" });

        const content = await generateSectionContent(db as any, input.projectId, section);

        const existingContent = draft.content || {};
        existingContent[input.sectionId] = content;

        await pool.execute(
          "UPDATE report_drafts SET content = ?, updated_at = NOW() WHERE id = ? AND project_id = ?",
          [JSON.stringify(existingContent), input.draftId, input.projectId]
        );

        return { sectionId: input.sectionId, content };
      } finally {
        await pool.end();
      }
    }),

  // Generate content for ALL sections (background job)
  generateAllSections: protectedProcedure
    .input(z.object({
      draftId: z.number(),
      projectId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const { pool, db } = getMainDb();
      try {
        const draft = await getDraft(pool, input.draftId, input.projectId);
        if (!draft) throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found" });

        const sections: ReportSection[] = (draft.sections || []).filter(
          (s: ReportSection) => s.included !== false
        );
        const jobId = `content-${input.draftId}-${Date.now()}`;

        // Mark as in-progress
        await pool.execute(
          `UPDATE report_drafts
           SET content_generation_job_id = ?,
               content_generation_status = 'running',
               content_generation_progress = 0,
               content_generation_completed_sections = 0,
               content_generation_total_sections = ?,
               content_generation_current_section = ?,
               updated_at = NOW()
           WHERE id = ? AND project_id = ?`,
          [jobId, sections.length, sections[0]?.title || "", input.draftId, input.projectId]
        );

        // Run generation in background (fire and forget)
        (async () => {
          const existingContent = draft.content || {};
          for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            try {
              const content = await generateSectionContent(db as any, input.projectId, section);
              existingContent[section.id] = content;

              await pool.execute(
                `UPDATE report_drafts
                 SET content = ?,
                     content_generation_completed_sections = ?,
                     content_generation_progress = ?,
                     content_generation_current_section = ?,
                     updated_at = NOW()
                 WHERE id = ?`,
                [
                  JSON.stringify(existingContent),
                  i + 1,
                  Math.round(((i + 1) / sections.length) * 100),
                  sections[i + 1]?.title || "Done",
                  input.draftId,
                ]
              );
            } catch (err) {
              console.error(`[Report Router] Error generating section ${section.id}:`, err);
            }
          }

          await pool.execute(
            `UPDATE report_drafts
             SET content_generation_status = 'completed',
                 content_generation_progress = 100,
                 step = 'generate',
                 updated_at = NOW()
             WHERE id = ?`,
            [input.draftId]
          );
          await pool.end();
        })().catch(err => {
          console.error("[Report Router] Background generation failed:", err);
          pool.execute(
            "UPDATE report_drafts SET content_generation_status = 'failed', updated_at = NOW() WHERE id = ?",
            [input.draftId]
          ).catch(() => {});
        });

        return { jobId, totalSections: sections.length };
      } catch (err) {
        await pool.end();
        throw err;
      }
    }),

  // Poll content generation progress
  getContentProgress: protectedProcedure
    .input(z.object({ draftId: z.number(), projectId: z.number() }))
    .query(async ({ input }) => {
      const { pool } = getMainDb();
      try {
        const [rows] = await pool.execute(
          `SELECT content_generation_status, content_generation_progress,
                  content_generation_current_section, content_generation_completed_sections,
                  content_generation_total_sections
           FROM report_drafts WHERE id = ? AND project_id = ?`,
          [input.draftId, input.projectId]
        ) as any;
        return rows[0] || null;
      } finally {
        await pool.end();
      }
    }),

  // Refine a section with a specific instruction
  refineSection: protectedProcedure
    .input(z.object({
      draftId: z.number(),
      projectId: z.number(),
      sectionId: z.string(),
      instruction: z.string(),
    }))
    .mutation(async ({ input }) => {
      const { pool, db } = getMainDb();
      try {
        const draft = await getDraft(pool, input.draftId, input.projectId);
        if (!draft) throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found" });

        const sections: ReportSection[] = draft.sections || [];
        const section = sections.find((s: ReportSection) => s.id === input.sectionId);
        if (!section) throw new TRPCError({ code: "NOT_FOUND", message: "Section not found" });

        const currentContent = (draft.content || {})[input.sectionId] || "";
        const refined = await refineSectionContent(
          currentContent,
          section.title,
          input.instruction,
          section.wordTarget || 500,
          db as any,
          input.projectId
        );

        const existingContent = draft.content || {};
        existingContent[input.sectionId] = refined;

        await pool.execute(
          "UPDATE report_drafts SET content = ?, updated_at = NOW() WHERE id = ? AND project_id = ?",
          [JSON.stringify(existingContent), input.draftId, input.projectId]
        );

        return { sectionId: input.sectionId, content: refined };
      } finally {
        await pool.end();
      }
    }),

  // Generate the final DOCX report
  generateFinalReport: protectedProcedure
    .input(z.object({
      draftId: z.number(),
      projectId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const { pool } = getMainDb();
      try {
        const draft = await getDraft(pool, input.draftId, input.projectId);
        if (!draft) throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found" });

        const jobId = `gen-${input.draftId}-${Date.now()}`;

        // Mark as generating
        await pool.execute(
          `UPDATE report_drafts
           SET generation_job_id = ?,
               generation_status = 'running',
               generation_progress = 0,
               updated_at = NOW()
           WHERE id = ? AND project_id = ?`,
          [jobId, input.draftId, input.projectId]
        );

        const sections: ReportSection[] = (draft.sections || []).filter(
          (s: ReportSection) => s.included !== false
        );
        const content: Record<string, string> = draft.content || {};
        const metadata: ReportMetadata = draft.metadata || {};

        // Run generation in background
        (async () => {
          try {
            await pool.execute(
              "UPDATE report_drafts SET generation_progress = 20, generation_current_section = 'Assembling document...' WHERE id = ?",
              [input.draftId]
            );

            const docxBuffer = await generateReportFromContent(
              sections,
              content,
              metadata,
              input.projectId
            );

            await pool.execute(
              "UPDATE report_drafts SET generation_progress = 80, generation_current_section = 'Saving file...' WHERE id = ?",
              [input.draftId]
            );

            // Save to local filesystem
            const fs = await import("fs/promises");
            const path = await import("path");
            const outputDir = `/app/data/reports`;
            await fs.mkdir(outputDir, { recursive: true });

            const projectName = (draft.project_name || "report").replace(/[^a-zA-Z0-9_-]/g, "_");
            const timestamp = new Date().toISOString().slice(0, 10);
            const filename = `${projectName}_DD_Report_${timestamp}.docx`;
            const filePath = path.join(outputDir, filename);
            await fs.writeFile(filePath, docxBuffer);

            const stats = await fs.stat(filePath);

            // Record in generated_reports
            const [result] = await pool.execute(
              `INSERT INTO generated_reports
               (project_id, draft_id, report_type, filename, file_key, file_size_bytes)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [input.projectId, input.draftId, draft.report_type || "dd_report", filename, filePath, stats.size]
            ) as any;

            await pool.execute(
              `UPDATE report_drafts
               SET generation_status = 'completed',
                   generation_progress = 100,
                   generated_file_key = ?,
                   generated_filename = ?,
                   generated_file_size_bytes = ?,
                   updated_at = NOW()
               WHERE id = ?`,
              [filePath, filename, stats.size, input.draftId]
            );

            console.log(`[Report Router] Generated report: ${filename} (${stats.size} bytes)`);
            await pool.end();
          } catch (err: any) {
            console.error("[Report Router] Report generation failed:", err);
            await pool.execute(
              "UPDATE report_drafts SET generation_status = 'failed', generation_error = ?, updated_at = NOW() WHERE id = ?",
              [err.message || "Unknown error", input.draftId]
            ).catch(() => {});
            await pool.end();
          }
        })();

        return { jobId };
      } catch (err) {
        await pool.end();
        throw err;
      }
    }),

  // Poll final report generation status
  getGenerationStatus: protectedProcedure
    .input(z.object({ draftId: z.number(), projectId: z.number() }))
    .query(async ({ input }) => {
      const { pool } = getMainDb();
      try {
        const [rows] = await pool.execute(
          `SELECT generation_status, generation_progress, generation_current_section,
                  generation_error, generated_file_key, generated_filename, generated_file_size_bytes
           FROM report_drafts WHERE id = ? AND project_id = ?`,
          [input.draftId, input.projectId]
        ) as any;
        return rows[0] || null;
      } finally {
        await pool.end();
      }
    }),

  // Retry a failed generation
  retryGeneration: protectedProcedure
    .input(z.object({ draftId: z.number(), projectId: z.number() }))
    .mutation(async ({ input }) => {
      const { pool } = getMainDb();
      try {
        await pool.execute(
          "UPDATE report_drafts SET generation_status = NULL, generation_error = NULL, generation_progress = 0 WHERE id = ? AND project_id = ?",
          [input.draftId, input.projectId]
        );
        return { success: true };
      } finally {
        await pool.end();
      }
    }),

  // Download a generated report
  downloadReport: protectedProcedure
    .input(z.object({ reportId: z.number(), projectId: z.number() }))
    .query(async ({ input }) => {
      const { pool } = getMainDb();
      try {
        const [rows] = await pool.execute(
          "SELECT * FROM generated_reports WHERE id = ? AND project_id = ?",
          [input.reportId, input.projectId]
        ) as any;
        const report = rows[0];
        if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "Report not found" });

        // Return the file path for the client to download via a separate HTTP endpoint
        return {
          filename: report.filename,
          fileKey: report.file_key,
          fileSizeBytes: report.file_size_bytes,
        };
      } finally {
        await pool.end();
      }
    }),

  // Delete a draft
  deleteDraft: protectedProcedure
    .input(z.object({ draftId: z.number(), projectId: z.number() }))
    .mutation(async ({ input }) => {
      const { pool } = getMainDb();
      try {
        await pool.execute(
          "DELETE FROM report_drafts WHERE id = ? AND project_id = ?",
          [input.draftId, input.projectId]
        );
        return { success: true };
      } finally {
        await pool.end();
      }
    }),
});
