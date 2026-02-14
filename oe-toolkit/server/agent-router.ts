/**
 * Agent Router for OE Toolkit
 * 
 * Thin wrapper that creates the agent router from the @oe-ecosystem/ai-agent npm package.
 * All agent logic, tools, knowledge base, and learning capabilities come from the package.
 */
import { createAgentRouter } from "@oe-ecosystem/ai-agent";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import mysql from "mysql2/promise";

/**
 * Create a project-specific database connection pool.
 * Connects to the same database but wraps queries with project table prefixes.
 * 
 * The agent uses this to query project-specific tables like:
 * - proj_{projectId}_extractedFacts
 * - proj_{projectId}_documents
 * - proj_{projectId}_redFlags
 */
async function createProjectDbConnection(projectId: number) {
  const { ProjectDbPool } = await import("@oe-ecosystem/ai-agent");
  
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  
  const pool = mysql.createPool(databaseUrl);
  return new ProjectDbPool(pool, projectId);
}

export const agentRouter = createAgentRouter({
  router,
  protectedProcedure,
  getDb: getDb as any, // getDb returns drizzle instance, cast for compatibility
  createProjectDbConnection,
});
