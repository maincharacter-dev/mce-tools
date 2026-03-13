/**
 * Sprocket Agent Router
 *
 * tRPC procedures that proxy to the Sprocket (oe-ai-agent-2) REST API.
 * Sprocket runs at SPROCKET_URL with LOCAL_AUTH=true.
 *
 * All agent intelligence, memory, knowledge graph, and conversation history
 * live in Sprocket's own database — OE Toolkit is a thin UI client.
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import {
  getSprocketHealth,
  getSprocketConversations,
  getSprocketMessages,
  deleteSprocketConversation,
  sprocketChat,
  getSprocketProjects,
  createSprocketProject,
} from "../sprocket-client";

export const agentRouter = router({
  /** Health check — verify Sprocket is reachable */
  health: protectedProcedure.query(async () => {
    return getSprocketHealth();
  }),

  /** List all conversations (from Sprocket) */
  getConversations: protectedProcedure.query(async () => {
    return getSprocketConversations(1);
  }),

  /** Get messages for a specific conversation */
  getMessages: protectedProcedure
    .input(z.object({ conversationId: z.string() }))
    .query(async ({ input }) => {
      return getSprocketMessages(input.conversationId);
    }),

  /** Delete a conversation */
  deleteConversation: protectedProcedure
    .input(z.object({ conversationId: z.string() }))
    .mutation(async ({ input }) => {
      return deleteSprocketConversation(input.conversationId);
    }),

  /**
   * Send a chat message to Sprocket (non-streaming).
   * Optionally injects TA/TDD project context as a system prefix.
   */
  chat: protectedProcedure
    .input(
      z.object({
        message: z.string().min(1),
        conversationId: z.string().optional(),
        systemContext: z.string().optional(), // TA/TDD project context injected by frontend
      })
    )
    .mutation(async ({ input }) => {
      return sprocketChat({
        message: input.message,
        conversationId: input.conversationId,
        systemContext: input.systemContext,
        userId: 1,
      });
    }),

  /** List Sprocket projects */
  getProjects: protectedProcedure.query(async () => {
    return getSprocketProjects(1);
  }),

  /** Create a Sprocket project */
  createProject: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ input }) => {
      return createSprocketProject(input.name, 1);
    }),
});
