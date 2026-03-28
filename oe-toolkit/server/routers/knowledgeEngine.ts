/**
 * Knowledge Engine Router
 *
 * tRPC procedures that proxy to the MCE Knowledge Engine (FastAPI) REST API.
 * The Knowledge Engine runs at KNOWLEDGE_ENGINE_URL inside the Docker network.
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import {
  getKeHealth,
  getKeStatus,
  getKeGaps,
  getKeSimilarRisks,
  getKeRisksByCategory,
  getKeBenchmarkEstimate,
} from "../knowledge-engine-client";

export const knowledgeEngineRouter = router({
  /** Health check — verify the Knowledge Engine is reachable */
  health: protectedProcedure.query(async () => {
    return getKeHealth();
  }),

  /** Overall intelligence status: record counts, coverage, data quality */
  status: protectedProcedure.query(async () => {
    return getKeStatus();
  }),

  /** Intelligence gaps and recommendations */
  gaps: protectedProcedure.query(async () => {
    return getKeGaps();
  }),

  /** Similar risks for a project type */
  similarRisks: protectedProcedure
    .input(
      z.object({
        project_type: z.string(),
        risk_type: z.string().optional(),
        category: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ input }) => {
      return getKeSimilarRisks(
        input.project_type,
        input.risk_type,
        input.category,
        input.limit,
      );
    }),

  /** Risks grouped by category */
  risksByCategory: protectedProcedure
    .input(
      z.object({
        category: z.string(),
        project_type: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      return getKeRisksByCategory(input.category, input.project_type);
    }),

  /** Benchmark cost/schedule estimate */
  benchmarkEstimate: protectedProcedure
    .input(
      z.object({
        project_type: z.string(),
        capacity_mw: z.number().positive(),
        region: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      return getKeBenchmarkEstimate(
        input.project_type,
        input.capacity_mw,
        input.region,
      );
    }),
});
