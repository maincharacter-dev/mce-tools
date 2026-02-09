import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { AgentOrchestrator } from "./agent-orchestrator";
import { getDb } from "../db";
import { createProjectDbConnection } from "../db-connection";

/**
 * Agent Router
 * 
 * tRPC router exposing AI Agent functionality to the frontend
 */

// Lazy-initialized orchestrator
let orchestrator: AgentOrchestrator | null = null;

async function getOrchestrator(): Promise<AgentOrchestrator> {
  if (!orchestrator) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    orchestrator = new AgentOrchestrator(db, async (projectId: number) => {
      return await createProjectDbConnection(projectId);
    });
  }
  return orchestrator;
}

export const agentRouter = router({
  /**
   * Send a message to the agent
   */
  chat: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        conversationId: z.string().optional(),
        message: z.string().min(1),
        context: z
          .object({
            currentPage: z.string().optional(),
            workflowStage: z.string().optional(),
            relevantDocuments: z.array(z.string()).optional(),
            relevantFacts: z.array(z.string()).optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const agent = await getOrchestrator();

      const response = await agent.processMessage({
        userId: ctx.user.id,
        projectId: input.projectId,
        conversationId: input.conversationId,
        message: input.message,
        context: input.context,
      });

      return response;
    }),

  /**
   * Get conversation history
   */
  getConversation: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const agent = await getOrchestrator();
      const messages = await agent.getConversationHistory(input.conversationId);
      return { messages };
    }),

  /**
   * Get all conversations for a project
   */
  getConversations: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      const agent = await getOrchestrator();
      const conversations = await agent.getConversations(ctx.user.id, input.projectId);
      return { conversations };
    }),

  /**
   * Archive a conversation
   */
  archiveConversation: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const agent = await getOrchestrator();
      await agent.archiveConversation(input.conversationId);
      return { success: true };
    }),

  /**
   * Delete a conversation
   */
  deleteConversation: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const agent = await getOrchestrator();
      await agent.deleteConversation(input.conversationId);
      return { success: true };
    }),

  /**
   * Submit user edit for learning
   */
  submitEdit: protectedProcedure
    .input(
      z.object({
        contentId: z.string(),
        finalContent: z.string(),
        feedback: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const agent = await getOrchestrator();
      await agent.submitEdit(input.contentId, input.finalContent, input.feedback);
      return { success: true };
    }),

  /**
   * Get user's style model
   */
  getStyleModel: protectedProcedure.query(async ({ ctx }) => {
    const agent = await getOrchestrator();
    const styleModel = await agent.getStyleModel(ctx.user.id);
    return { styleModel };
  }),

  /**
   * Get learning statistics
   */
  getLearningStats: protectedProcedure.query(async ({ ctx }) => {
    const agent = await getOrchestrator();
    const stats = await agent.getLearningStats(ctx.user.id);
    return stats;
  }),

  /**
   * Get conversation statistics
   */
  getConversationStats: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const agent = await getOrchestrator();
      const stats = await agent.getConversationStats(input.conversationId);
      return stats;
    }),

  /**
   * Get project summary (quick overview)
   */
  getProjectSummary: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      const agent = await getOrchestrator();
      
      // Use the agent to generate a quick summary
      const response = await agent.processMessage({
        userId: ctx.user.id,
        projectId: input.projectId,
        message: "Give me a quick summary of this project including document count, fact count, and key risks.",
      });

      return {
        summary: response.message,
        metadata: response.metadata,
      };
    }),

  /**
   * Quick query - one-off question without conversation context
   */
  quickQuery: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        query: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const agent = await getOrchestrator();

      const response = await agent.processMessage({
        userId: ctx.user.id,
        projectId: input.projectId,
        message: input.query,
      });

      return {
        answer: response.message,
        toolsUsed: response.metadata.toolsUsed,
      };
    }),
});
