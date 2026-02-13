import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { AgentOrchestrator } from "./agent-orchestrator";
import { getDb } from "../db";
import { createProjectDbConnection } from "../db-connection";
import { agentKnowledgeBase, agentConversations, agentMessages, agentActions, agentLearningSamples, agentGeneratedContent } from "./schema";
import { eq, desc, like, sql, and, count } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

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

  // ============================================================
  // KNOWLEDGE BASE ENDPOINTS
  // ============================================================

  /**
   * List all knowledge base entries with optional filtering
   */
  listKnowledge: protectedProcedure
    .input(
      z.object({
        category: z.string().optional(),
        search: z.string().optional(),
        confidence: z.string().optional(),
        limit: z.number().optional().default(50),
        offset: z.number().optional().default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const conditions: any[] = [];
      if (input.category) {
        conditions.push(eq(agentKnowledgeBase.category, input.category));
      }
      if (input.confidence) {
        conditions.push(eq(agentKnowledgeBase.confidence, input.confidence));
      }
      if (input.search) {
        conditions.push(
          sql`(LOWER(${agentKnowledgeBase.topic}) LIKE ${`%${input.search.toLowerCase()}%`} OR LOWER(${agentKnowledgeBase.content}) LIKE ${`%${input.search.toLowerCase()}%`})`
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const entries = await db
        .select()
        .from(agentKnowledgeBase)
        .where(whereClause)
        .orderBy(desc(agentKnowledgeBase.updatedAt))
        .limit(input.limit)
        .offset(input.offset);

      // Get total count
      const [countResult] = await db
        .select({ total: count() })
        .from(agentKnowledgeBase)
        .where(whereClause);

      return {
        entries,
        total: countResult?.total || 0,
      };
    }),

  /**
   * Get a single knowledge base entry by ID
   */
  getKnowledge: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [entry] = await db
        .select()
        .from(agentKnowledgeBase)
        .where(eq(agentKnowledgeBase.id, input.id));

      if (!entry) throw new Error("Knowledge entry not found");
      return entry;
    }),

  /**
   * Create a new knowledge base entry
   */
  createKnowledge: protectedProcedure
    .input(
      z.object({
        category: z.string(),
        topic: z.string().min(1),
        content: z.string().min(1),
        confidence: z.string().default("medium"),
        tags: z.array(z.string()).optional(),
        relatedTopics: z.array(z.string()).optional(),
        applicability: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const id = uuidv4();
      await db.insert(agentKnowledgeBase).values({
        id,
        category: input.category,
        topic: input.topic,
        content: input.content,
        confidence: input.confidence,
        sourceCount: 1,
        metadata: {
          tags: input.tags || [],
          relatedTopics: input.relatedTopics || [],
          applicability: input.applicability || [],
        },
      });

      return { id, success: true };
    }),

  /**
   * Update a knowledge base entry
   */
  updateKnowledge: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        category: z.string().optional(),
        topic: z.string().optional(),
        content: z.string().optional(),
        confidence: z.string().optional(),
        tags: z.array(z.string()).optional(),
        relatedTopics: z.array(z.string()).optional(),
        applicability: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { id, tags, relatedTopics, applicability, ...fields } = input;

      const updates: any = {};
      if (fields.category) updates.category = fields.category;
      if (fields.topic) updates.topic = fields.topic;
      if (fields.content) updates.content = fields.content;
      if (fields.confidence) updates.confidence = fields.confidence;

      if (tags || relatedTopics || applicability) {
        // Get existing metadata
        const [existing] = await db
          .select({ metadata: agentKnowledgeBase.metadata })
          .from(agentKnowledgeBase)
          .where(eq(agentKnowledgeBase.id, id));

        const existingMeta = (existing?.metadata || {}) as any;
        updates.metadata = {
          tags: tags || existingMeta.tags || [],
          relatedTopics: relatedTopics || existingMeta.relatedTopics || [],
          applicability: applicability || existingMeta.applicability || [],
        };
      }

      await db
        .update(agentKnowledgeBase)
        .set(updates)
        .where(eq(agentKnowledgeBase.id, id));

      return { success: true };
    }),

  /**
   * Delete a knowledge base entry
   */
  deleteKnowledge: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .delete(agentKnowledgeBase)
        .where(eq(agentKnowledgeBase.id, input.id));

      return { success: true };
    }),

  /**
   * Seed the knowledge base with foundational data
   */
  seedKnowledge: protectedProcedure
    .mutation(async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check current count
      const [countResult] = await db
        .select({ total: count() })
        .from(agentKnowledgeBase);

      // Seed knowledge base is handled by the migration SQL.
      // This endpoint returns current state info.
      return {
        added: 0,
        skipped: 0,
        total: countResult?.total || 0,
        existingCount: countResult?.total || 0,
        message: "Knowledge base entries are managed via the UI or auto-extraction. Seed data is loaded from migration.",
      };
    }),

  // ============================================================
  // LEARNING STATS ENDPOINTS
  // ============================================================

  /**
   * Get comprehensive learning statistics
   */
  getKnowledgeStats: protectedProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Knowledge base stats
      const allKnowledge = await db
        .select({
          category: agentKnowledgeBase.category,
          confidence: agentKnowledgeBase.confidence,
          sourceCount: agentKnowledgeBase.sourceCount,
          createdAt: agentKnowledgeBase.createdAt,
        })
        .from(agentKnowledgeBase);

      const byCategory: Record<string, number> = {};
      const byConfidence: Record<string, number> = {};
      let totalSourceCount = 0;

      for (const entry of allKnowledge) {
        byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
        byConfidence[entry.confidence || "medium"] = (byConfidence[entry.confidence || "medium"] || 0) + 1;
        totalSourceCount += entry.sourceCount || 1;
      }

      // Conversation stats
      const [conversationCount] = await db
        .select({ total: count() })
        .from(agentConversations);

      // Message stats
      const [messageCount] = await db
        .select({ total: count() })
        .from(agentMessages);

      // Action stats
      const [actionCount] = await db
        .select({ total: count() })
        .from(agentActions);

      // Learning samples stats
      const [sampleCount] = await db
        .select({ total: count() })
        .from(agentLearningSamples);

      // Generated content stats
      const [generatedCount] = await db
        .select({ total: count() })
        .from(agentGeneratedContent);

      // Recent knowledge entries (last 10)
      const recentKnowledge = await db
        .select({
          id: agentKnowledgeBase.id,
          topic: agentKnowledgeBase.topic,
          category: agentKnowledgeBase.category,
          confidence: agentKnowledgeBase.confidence,
          sourceCount: agentKnowledgeBase.sourceCount,
          createdAt: agentKnowledgeBase.createdAt,
          updatedAt: agentKnowledgeBase.updatedAt,
        })
        .from(agentKnowledgeBase)
        .orderBy(desc(agentKnowledgeBase.updatedAt))
        .limit(10);

      // Top knowledge by source count (most validated)
      const topKnowledge = await db
        .select({
          id: agentKnowledgeBase.id,
          topic: agentKnowledgeBase.topic,
          category: agentKnowledgeBase.category,
          confidence: agentKnowledgeBase.confidence,
          sourceCount: agentKnowledgeBase.sourceCount,
        })
        .from(agentKnowledgeBase)
        .orderBy(desc(agentKnowledgeBase.sourceCount))
        .limit(10);

      return {
        knowledge: {
          totalEntries: allKnowledge.length,
          byCategory,
          byConfidence,
          averageSourceCount: allKnowledge.length > 0 ? totalSourceCount / allKnowledge.length : 0,
          recentEntries: recentKnowledge,
          topEntries: topKnowledge,
        },
        activity: {
          totalConversations: conversationCount?.total || 0,
          totalMessages: messageCount?.total || 0,
          totalActions: actionCount?.total || 0,
          totalLearningSamples: sampleCount?.total || 0,
          totalGeneratedContent: generatedCount?.total || 0,
        },
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
