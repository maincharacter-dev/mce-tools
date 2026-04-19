/**
 * Report Router
 *
 * Handles all report draft management and generation endpoints for the
 * Deliverables page and Report Builder workflow.
 *
 * NOTE: projectId is optional in most endpoints — when omitted the server
 * resolves it from the draft row itself. This lets client components pass
 * only draftId.
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

/** Safely parse a value that may already be a JS object (mysql2 auto-parses JSON columns). */
function safeParse(val: any): any {
  if (val == null) return null;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return null; }
  }
  return val; // already parsed by mysql2 driver
}

/** Fetch a draft. When projectId is omitted the lookup is by id only. */
async function fetchDraft(pool: any, draftId: number, projectId?: number | null) {
  const [rows] = (projectId != null
    ? await pool.execute("SELECT * FROM report_drafts WHERE id = ? AND project_id = ?", [draftId, projectId])
    : await pool.execute("SELECT * FROM report_drafts WHERE id = ?", [draftId])
  ) as any;
  const row = rows[0];
  if (!row) return null;
  return {
    ...row,
    sections: safeParse(row.sections),
    content: safeParse(row.content),
    metadata: safeParse(row.metadata),
  };
}

// Zod schema for a section object (used in generateSection input)
const sectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  order: z.number().optional(),
  wordTarget: z.number().optional(),
  prompt: z.string().optional(),
  included: z.boolean().optional(),
});

// ─── Router ──────────────────────────────────────────────────────────────────

export const reportRouter = router({

  // List all drafts for a project
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
           WHERE project_id = ?
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
        // Attach a server-side download URL and normalise field names for the client
        return (rows as any[]).map((r: any) => ({
          ...r,
          report_title: r.filename ? r.filename.replace(/_/g, ' ').replace(/\.docx$/i, '') : 'DD Report',
          file_url: `/api/reports/download/${r.id}`,
        }));
      } finally {
        await pool.end();
      }
    }),

  // Get a single draft by ID (projectId optional)
  getDraft: protectedProcedure
    .input(z.object({ draftId: z.number(), projectId: z.number().optional() }))
    .query(async ({ input }) => {
      const { pool } = getMainDb();
      try {
        const draft = await fetchDraft(pool, input.draftId, input.projectId);
        if (!draft) throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found" });
        return draft;
      } finally {
        await pool.end();
      }
    }),

  // Create a new draft — proposes TOC via AI
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

        return { draftId: result.insertId, sections, projectType, dataSummary, metadata: {} };
      } finally {
        await pool.end();
      }
    }),

  // Update section structure (reorder, rename, add, remove)
  updateStructure: protectedProcedure
    .input(z.object({
      draftId: z.number(),
      projectId: z.number().optional(),
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
          "UPDATE report_drafts SET sections = ?, step = 'content', updated_at = NOW() WHERE id = ?",
          [JSON.stringify(input.sections), input.draftId]
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
      projectId: z.number().optional(),
      metadata: z.record(z.string(), z.string()),
    }))
    .mutation(async ({ input }) => {
      const { pool } = getMainDb();
      try {
        await pool.execute(
          "UPDATE report_drafts SET metadata = ?, updated_at = NOW() WHERE id = ?",
          [JSON.stringify(input.metadata), input.draftId]
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
      projectId: z.number().optional(),
      sectionId: z.string(),
      content: z.string(),
    }))
    .mutation(async ({ input }) => {
      const { pool } = getMainDb();
      try {
        const draft = await fetchDraft(pool, input.draftId);
        if (!draft) throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found" });

        const existingContent = draft.content || {};
        existingContent[input.sectionId] = input.content;

        await pool.execute(
          "UPDATE report_drafts SET content = ?, updated_at = NOW() WHERE id = ?",
          [JSON.stringify(existingContent), input.draftId]
        );
        return { success: true };
      } finally {
        await pool.end();
      }
    }),

  // Generate content for a single section
  // Client passes either sectionId (string) or section (full object)
  generateSection: protectedProcedure
    .input(z.object({
      draftId: z.number(),
      projectId: z.number().optional(),
      sectionId: z.string().optional(),
      section: sectionSchema.optional(),
    }))
    .mutation(async ({ input }) => {
      const { pool, db } = getMainDb();
      try {
        const draft = await fetchDraft(pool, input.draftId);
        if (!draft) throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found" });

        const projectId: number = input.projectId ?? draft.project_id;

        // Support both { sectionId } and { section } call patterns
        let section: ReportSection | undefined;
        if (input.section) {
          section = input.section as ReportSection;
        } else if (input.sectionId) {
          const sections: ReportSection[] = draft.sections || [];
          section = sections.find((s: ReportSection) => s.id === input.sectionId);
        }
        if (!section) throw new TRPCError({ code: "NOT_FOUND", message: "Section not found" });

        const content = await generateSectionContent(db as any, projectId, section);

        const existingContent = draft.content || {};
        existingContent[section.id] = content;

        await pool.execute(
          "UPDATE report_drafts SET content = ?, updated_at = NOW() WHERE id = ?",
          [JSON.stringify(existingContent), input.draftId]
        );

        return { sectionId: section.id, content };
      } finally {
        await pool.end();
      }
    }),

  // Generate content for ALL sections (background job)
  generateAllSections: protectedProcedure
    .input(z.object({
      draftId: z.number(),
      projectId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const { pool, db } = getMainDb();
      try {
        const draft = await fetchDraft(pool, input.draftId);
        if (!draft) throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found" });

        const projectId: number = input.projectId ?? draft.project_id;

        const sections: ReportSection[] = (draft.sections || []).filter(
          (s: ReportSection) => s.included !== false
        );
        const jobId = `content-${input.draftId}-${Date.now()}`;

        await pool.execute(
          `UPDATE report_drafts
           SET content_generation_job_id = ?,
               content_generation_status = 'running',
               content_generation_progress = 0,
               content_generation_completed_sections = 0,
               content_generation_total_sections = ?,
               content_generation_current_section = ?,
               updated_at = NOW()
           WHERE id = ?`,
          [jobId, sections.length, sections[0]?.title || "", input.draftId]
        );

        // Run generation in background (fire and forget) — use a dedicated pool
        // so closing it doesn't affect the request-scoped pool above
        const bgPool = createMainDbPool();
        const bgDb = drizzle(bgPool);
        (async () => {
          const existingContent = draft.content || {};
          for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            try {
              const content = await generateSectionContent(bgDb as any, projectId, section);
              existingContent[section.id] = content;

              await bgPool.execute(
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

          await bgPool.execute(
            `UPDATE report_drafts
             SET content_generation_status = 'completed',
                 content_generation_progress = 100,
                 step = 'generate',
                 updated_at = NOW()
             WHERE id = ?`,
            [input.draftId]
          );
          await bgPool.end();
        })().catch(async err => {
          console.error("[Report Router] Background generation failed:", err);
          await bgPool.execute(
            "UPDATE report_drafts SET content_generation_status = 'failed', updated_at = NOW() WHERE id = ?",
            [input.draftId]
          ).catch(() => {});
          await bgPool.end();
        });

        return { jobId, totalSections: sections.length };
      } catch (err) {
        await pool.end();
        throw err;
      }
    }),

  // Poll content generation progress
  // Returns fields the client expects: isComplete, isFailed, completedSections, content
  getContentProgress: protectedProcedure
    .input(z.object({ draftId: z.number(), projectId: z.number().optional() }))
    .query(async ({ input }) => {
      const { pool } = getMainDb();
      try {
        const [rows] = await pool.execute(
          `SELECT content_generation_status, content_generation_progress,
                  content_generation_current_section, content_generation_completed_sections,
                  content_generation_total_sections, content
           FROM report_drafts WHERE id = ?`,
          [input.draftId]
        ) as any;
        const row = rows[0];
        if (!row) return null;
        return {
          status: row.content_generation_status,
          progress: row.content_generation_progress,
          currentSection: row.content_generation_current_section,
          completedSections: row.content_generation_completed_sections,
          totalSections: row.content_generation_total_sections,
          isComplete: row.content_generation_status === "completed",
          isFailed: row.content_generation_status === "failed",
          content: safeParse(row.content) || {},
        };
      } finally {
        await pool.end();
      }
    }),

  // Refine a section with a specific instruction
  // Accepts extra client fields (sectionTitle, currentContent, wordTarget) via passthrough
  refineSection: protectedProcedure
    .input(z.object({
      draftId: z.number(),
      projectId: z.number().optional(),
      sectionId: z.string(),
      instruction: z.string(),
      // Optional fields sent by client (ignored server-side, resolved from draft)
      sectionTitle: z.string().optional(),
      currentContent: z.string().optional(),
      wordTarget: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const { pool, db } = getMainDb();
      try {
        const draft = await fetchDraft(pool, input.draftId);
        if (!draft) throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found" });

        const projectId: number = input.projectId ?? draft.project_id;

        const sections: ReportSection[] = draft.sections || [];
        const section = sections.find((s: ReportSection) => s.id === input.sectionId);
        if (!section) throw new TRPCError({ code: "NOT_FOUND", message: "Section not found" });

        const currentContent = (draft.content || {})[input.sectionId] || input.currentContent || "";
        const refined = await refineSectionContent(
          currentContent,
          section.title,
          input.instruction,
          input.wordTarget || section.wordTarget || 500,
          db as any,
          projectId
        );

        const existingContent = draft.content || {};
        existingContent[input.sectionId] = refined;

        await pool.execute(
          "UPDATE report_drafts SET content = ?, updated_at = NOW() WHERE id = ?",
          [JSON.stringify(existingContent), input.draftId]
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
      projectId: z.number().optional(),
      projectName: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { pool } = getMainDb();
      try {
        const draft = await fetchDraft(pool, input.draftId);
        if (!draft) throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found" });

        const projectId: number = input.projectId ?? draft.project_id;
        const jobId = `gen-${input.draftId}-${Date.now()}`;

        await pool.execute(
          `UPDATE report_drafts
           SET generation_job_id = ?,
               generation_status = 'running',
               generation_progress = 0,
               updated_at = NOW()
           WHERE id = ?`,
          [jobId, input.draftId]
        );

        const sections: ReportSection[] = (draft.sections || []).filter(
          (s: ReportSection) => s.included !== false
        );
        const content: Record<string, string> = draft.content || {};
        const metadata: ReportMetadata = draft.metadata || {};

        // Run generation in background — use a dedicated pool
        const bgPool2 = createMainDbPool();
        (async () => {
          try {
            await bgPool2.execute(
              "UPDATE report_drafts SET generation_progress = 20, generation_current_section = 'Assembling document...' WHERE id = ?",
              [input.draftId]
            );

            const docxBuffer = await generateReportFromContent(sections, content, metadata, projectId);

            await bgPool2.execute(
              "UPDATE report_drafts SET generation_progress = 80, generation_current_section = 'Saving file...' WHERE id = ?",
              [input.draftId]
            );

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

            // Insert into generated_reports table
            const [insertResult] = await bgPool2.execute(
              `INSERT INTO generated_reports
               (project_id, draft_id, report_type, filename, file_key, file_size_bytes)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [projectId, input.draftId, draft.report_type || "dd_report", filename, filePath, stats.size]
            ) as any;
            const reportId = insertResult.insertId;

            await bgPool2.execute(
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

            console.log(`[Report Router] Generated report: ${filename} (${stats.size} bytes), reportId=${reportId}`);
            await bgPool2.end();
          } catch (err: any) {
            console.error("[Report Router] Report generation failed:", err);
            await bgPool2.execute(
              "UPDATE report_drafts SET generation_status = 'failed', generation_error = ?, updated_at = NOW() WHERE id = ?",
              [err.message || "Unknown error", input.draftId]
            ).catch(() => {});
            await bgPool2.end();
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
    .input(z.object({ draftId: z.number(), projectId: z.number().optional() }))
    .query(async ({ input }) => {
      const { pool } = getMainDb();
      try {
        const [rows] = await pool.execute(
          `SELECT generation_status, generation_progress, generation_current_section,
                  generation_error, generated_file_key, generated_filename, generated_file_size_bytes
           FROM report_drafts WHERE id = ?`,
          [input.draftId]
        ) as any;
        return rows[0] || null;
      } finally {
        await pool.end();
      }
    }),

  // Retry a failed generation
  retryGeneration: protectedProcedure
    .input(z.object({ draftId: z.number(), projectId: z.number().optional() }))
    .mutation(async ({ input }) => {
      const { pool } = getMainDb();
      try {
        await pool.execute(
          "UPDATE report_drafts SET generation_status = NULL, generation_error = NULL, generation_progress = 0 WHERE id = ?",
          [input.draftId]
        );
        return { success: true };
      } finally {
        await pool.end();
      }
    }),

  // Download a generated report
  downloadReport: protectedProcedure
    .input(z.object({ reportId: z.number(), projectId: z.number().optional() }))
    .query(async ({ input }) => {
      const { pool } = getMainDb();
      try {
        const [rows] = await pool.execute(
          "SELECT * FROM generated_reports WHERE id = ?",
          [input.reportId]
        ) as any;
        const report = rows[0];
        if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "Report not found" });

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
    .input(z.object({ draftId: z.number(), projectId: z.number().optional() }))
    .mutation(async ({ input }) => {
      const { pool } = getMainDb();
      try {
        await pool.execute(
          "DELETE FROM report_drafts WHERE id = ?",
          [input.draftId]
        );
        return { success: true };
      } finally {
        await pool.end();
      }
    }),
});
