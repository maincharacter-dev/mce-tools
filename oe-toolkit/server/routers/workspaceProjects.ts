/**
 * Workspace Projects Router
 *
 * Provides project context endpoints for Sprocket AI agent injection.
 * Projects are sourced from oe_toolkit.projects (the single registry).
 * Project-specific data (facts, red flags) is read from mce-workspace's
 * mce_workspace database using proj_{id}_ table prefixes.
 */

import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import mysql from "mysql2/promise";
import { getDb } from "../db";
import { projects } from "../../drizzle/schema";

/**
 * Get a connection to the mce-workspace database (for reading project data)
 */
async function getWorkspaceDbConnection() {
  const dbUrl = process.env.MCE_WORKSPACE_DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("MCE_WORKSPACE_DATABASE_URL environment variable not set");

  // Replace the database name in the URL with mce_workspace
  const url = new URL(dbUrl);
  url.pathname = "/mce_workspace";

  return await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: url.username,
    password: url.password,
    database: "mce_workspace",
  });
}

export const workspaceProjectsRouter = router({
  /**
   * List all projects from oe_toolkit (the single registry).
   * Used by mce-workspace UI and Sprocket to select a project context.
   */
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    return await db.select().from(projects);
  }),

  /**
   * Get rich project context for Sprocket injection.
   * Returns project name, top extracted facts (by category + confidence),
   * and red flags — formatted as a concise system context string.
   */
  getProjectContext: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      let connection: mysql.Connection | null = null;

      try {
        connection = await getWorkspaceDbConnection();

        const prefix = `proj_${input.projectId}`;

        // Check if per-project tables exist
        const [tableCheck] = await connection.execute(
          `SELECT COUNT(*) as cnt FROM information_schema.tables 
           WHERE table_schema = 'mce_workspace' AND table_name = ?`,
          [`${prefix}_extracted_facts`]
        );
        const hasTables = (tableCheck as Array<{ cnt: number }>)[0].cnt > 0;

        const contextParts: string[] = [
          `Project ID: ${input.projectId}`,
        ];

        if (hasTables) {
          // Get top facts grouped by category (max 5 per category, highest confidence)
          const [factRows] = await connection.execute(
            `SELECT category, \`key\`, value, confidence
             FROM \`${prefix}_extracted_facts\`
             WHERE confidence >= 0.7
             ORDER BY category, confidence DESC
             LIMIT 50`
          );
          const facts = factRows as Array<{ category: string; key: string; value: string; confidence: number }>;

          if (facts.length > 0) {
            // Group by category
            const byCategory: Record<string, typeof facts> = {};
            for (const f of facts) {
              if (!byCategory[f.category]) byCategory[f.category] = [];
              if (byCategory[f.category].length < 5) byCategory[f.category].push(f);
            }

            contextParts.push("\nKey Project Facts:");
            for (const [cat, catFacts] of Object.entries(byCategory)) {
              contextParts.push(`\n${cat}:`);
              for (const f of catFacts) {
                contextParts.push(`  - ${f.key}: ${f.value}`);
              }
            }
          }

          // Check for red flags table
          const [rfCheck] = await connection.execute(
            `SELECT COUNT(*) as cnt FROM information_schema.tables 
             WHERE table_schema = 'mce_workspace' AND table_name = ?`,
            [`${prefix}_red_flags`]
          );
          const hasRedFlags = (rfCheck as Array<{ cnt: number }>)[0].cnt > 0;

          if (hasRedFlags) {
            const [rfRows] = await connection.execute(
              `SELECT category, description, severity
               FROM \`${prefix}_red_flags\`
               ORDER BY severity DESC
               LIMIT 10`
            );
            const redFlags = rfRows as Array<{ category: string; description: string; severity: string }>;

            if (redFlags.length > 0) {
              contextParts.push("\nRed Flags / Key Risks:");
              for (const rf of redFlags) {
                contextParts.push(`  - [${rf.severity || "MEDIUM"}] ${rf.category}: ${rf.description}`);
              }
            }
          }
        }

        return {
          projectId: input.projectId,
          context: contextParts.join("\n"),
        };
      } catch (error) {
        console.error(`[WorkspaceProjects] Failed to get project context for ${input.projectId}:`, error);
        // Return minimal context rather than throwing — Sprocket should still work without it
        return {
          projectId: input.projectId,
          context: `Project ID: ${input.projectId}`,
        };
      } finally {
        if (connection) await connection.end();
      }
    }),
});
