/**
 * Agent Router
 *
 * Thin wrapper that creates the agent tRPC router using the
 * @oe-ecosystem/ai-agent npm package. All agent logic, tools,
 * knowledge base, and learning capabilities come from the package.
 *
 * This file only provides the platform-specific dependencies:
 * - tRPC router and protectedProcedure
 * - Database connections (main DB and project DB)
 */

import { createAgentRouter } from "@oe-ecosystem/ai-agent";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { createProjectDbConnection } from "../db-connection";

export const agentRouter = createAgentRouter({
  router,
  protectedProcedure,
  getDb,
  createProjectDbConnection,
});
