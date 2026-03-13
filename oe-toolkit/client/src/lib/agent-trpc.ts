/**
 * Agent tRPC Hook Helper
 *
 * The @oe-ecosystem/ai-agent package's createAgentRouter returns `any`,
 * so tRPC can't infer nested procedure types. This helper provides
 * a typed wrapper that casts the agent sub-router for use in components.
 */
import { trpc } from "./trpc";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const agentTrpc = (trpc as any).agent;
