/**
 * AI Agent Router
 * 
 * Thin wrapper around @oe-ecosystem/ai-agent package
 * Provides tRPC endpoints for agent conversations, knowledge base, and learning
 */

import { createAgentRouter, wrapPool } from "@oe-ecosystem/ai-agent";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import type { AgentRouterDependencies } from "@oe-ecosystem/ai-agent";
import mysql from 'mysql2/promise';

// Create project database connection function
// This is used by the agent to query project-specific tables (proj_{id}_*)
async function createProjectDbConnection(projectId: number) {
  // Create a mysql2 pool for the project
  // Using the same database but with table prefix transformation
  const pool = mysql.createPool({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER || 'root',
    password: process.env.DATABASE_PASSWORD || '',
    database: process.env.DATABASE_NAME || 'ingestion_engine_main',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
  
  // Wrap the pool with ProjectDbPool to handle table prefix transformation
  return wrapPool(pool, projectId);
}

// Agent dependencies
const agentDependencies: AgentRouterDependencies = {
  router,
  protectedProcedure,
  getDb,
  createProjectDbConnection,
};

// Create and export the agent router
export const agentRouter = createAgentRouter(agentDependencies);
