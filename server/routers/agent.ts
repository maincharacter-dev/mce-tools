/**
 * Agent Router Wrapper
 *
 * Thin wrapper that integrates @oe-ecosystem/ai-agent's createAgentRouter
 * with the OE Toolkit's tRPC setup, connecting to the TA/TDD engine database
 * where all agent tables live.
 */
import { createAgentRouter, ProjectDbPool } from "@oe-ecosystem/ai-agent";
import { router, protectedProcedure } from "../_core/trpc";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

// Map Manus platform env vars to what the agent package expects
// The agent's llm.js reads FORGE_API_URL / FORGE_API_KEY / OPENAI_API_KEY
if (process.env.BUILT_IN_FORGE_API_URL && !process.env.FORGE_API_URL) {
  process.env.FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
}
if (process.env.BUILT_IN_FORGE_API_KEY && !process.env.FORGE_API_KEY) {
  process.env.FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;
}

// TA/TDD database connection pool (lazy-initialized, reused)
let _taTddPool: mysql.Pool | null = null;
let _taTddDrizzle: MySql2Database<any> | null = null;

function parseTaTddUrl() {
  const dbUrl = process.env.TA_TDD_DATABASE_URL;
  if (!dbUrl) {
    throw new Error("TA_TDD_DATABASE_URL environment variable not set");
  }
  const url = new URL(dbUrl);
  return {
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1), // Remove leading /
    ssl: { rejectUnauthorized: true },
  };
}

function getTaTddPool(): mysql.Pool {
  if (!_taTddPool) {
    const config = parseTaTddUrl();
    _taTddPool = mysql.createPool({
      ...config,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
    });
  }
  return _taTddPool;
}

/**
 * Get a Drizzle ORM instance connected to the TA/TDD database
 * This is what createAgentRouter's getDb() expects
 */
async function getTaTddDb(): Promise<MySql2Database<any>> {
  if (!_taTddDrizzle) {
    const pool = getTaTddPool();
    _taTddDrizzle = drizzle(pool) as unknown as MySql2Database<any>;
  }
  return _taTddDrizzle;
}

/**
 * Create a project-specific database connection wrapper
 * Uses ProjectDbPool from the agent package for table-prefix support
 */
async function createProjectDbConnection(projectId: number): Promise<ProjectDbPool> {
  const pool = getTaTddPool();
  return new ProjectDbPool(pool, projectId);
}

/**
 * The agent router - created using the factory from @oe-ecosystem/ai-agent
 * Connected to the TA/TDD engine database where agent tables live
 */
export const agentRouter = createAgentRouter({
  router,
  protectedProcedure,
  getDb: getTaTddDb,
  createProjectDbConnection,
});
