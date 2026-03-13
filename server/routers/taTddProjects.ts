/**
 * TA/TDD Projects Router
 *
 * Provides endpoints to query projects and project context from the TA/TDD shared database.
 * The project context is used to inject relevant facts into Sprocket chat requests.
 */

import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import mysql from "mysql2/promise";

/**
 * Get a fresh TA/TDD database connection
 */
async function getTaTddDbConnection() {
  const dbUrl = process.env.TA_TDD_DATABASE_URL;
  if (!dbUrl) throw new Error("TA_TDD_DATABASE_URL environment variable not set");

  const url = new URL(dbUrl);
  return await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    ssl: { rejectUnauthorized: true },
  });
}

export const taTddProjectsRouter = router({
  /**
   * List all projects from TA/TDD database
   */
  list: protectedProcedure.query(async () => {
    const connection = await getTaTddDbConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT id, name, description, dbName, createdAt, updatedAt
         FROM projects
         ORDER BY updatedAt DESC`
      );
      return rows as Array<{
        id: number;
        name: string;
        description: string | null;
        dbName: string;
        createdAt: Date;
        updatedAt: Date;
      }>;
    } finally {
      await connection.end();
    }
  }),

  /**
   * Get rich project context for Sprocket injection.
   * Returns project name, top extracted facts (by category + confidence),
   * and red flags — formatted as a concise system context string.
   */
  getProjectContext: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      const connection = await getTaTddDbConnection();
      try {
        // Get project info
        const [projectRows] = await connection.execute(
          `SELECT id, name, description, dbName FROM projects WHERE id = ? LIMIT 1`,
          [input.projectId]
        );
        const projects = projectRows as Array<{ id: number; name: string; description: string | null; dbName: string }>;
        if (!projects.length) throw new Error(`Project ${input.projectId} not found`);

        const project = projects[0];
        const prefix = project.dbName; // e.g. "proj_390002"

        // Check if per-project tables exist
        const [tableCheck] = await connection.execute(
          `SELECT COUNT(*) as cnt FROM information_schema.tables 
           WHERE table_schema = DATABASE() AND table_name = ?`,
          [`${prefix}_extractedFacts`]
        );
        const hasTables = (tableCheck as Array<{ cnt: number }>)[0].cnt > 0;

        let contextParts: string[] = [
          `Project: ${project.name}`,
        ];

        if (project.description) {
          contextParts.push(`Description: ${project.description}`);
        }

        if (hasTables) {
          // Get top facts grouped by category (max 5 per category, highest confidence)
          const [factRows] = await connection.execute(
            `SELECT category, \`key\`, value, confidence
             FROM \`${prefix}_extractedFacts\`
             WHERE deleted_at IS NULL AND confidence >= 0.7
             ORDER BY category, confidence DESC
             LIMIT 50`,
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
             WHERE table_schema = DATABASE() AND table_name = ?`,
            [`${prefix}_redFlags`]
          );
          const hasRedFlags = (rfCheck as Array<{ cnt: number }>)[0].cnt > 0;

          if (hasRedFlags) {
            const [rfRows] = await connection.execute(
              `SELECT category, description, severity
               FROM \`${prefix}_redFlags\`
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
          projectId: project.id,
          projectName: project.name,
          context: contextParts.join("\n"),
        };
      } finally {
        await connection.end();
      }
    }),
});
