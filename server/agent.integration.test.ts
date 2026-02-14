import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-agent-user",
    email: "agent-test@example.com",
    name: "Agent Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("agent router integration", () => {
  it("agent router is mounted on appRouter", () => {
    // Verify the agent sub-router exists on the app router
    // The createAgentRouter returns a tRPC router with procedures
    expect(appRouter).toBeDefined();
    
    // Create a caller to verify agent procedures are accessible
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    // The agent namespace should exist on the caller
    expect(caller.agent).toBeDefined();
  });

  it("agent router has expected procedure namespaces", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    // Check that key agent procedures exist
    // These are the main procedure groups from createAgentRouter
    expect(typeof caller.agent.chat).toBe("function");
    expect(typeof caller.agent.listKnowledge).toBe("function");
    expect(typeof caller.agent.createKnowledge).toBe("function");
    expect(typeof caller.agent.deleteKnowledge).toBe("function");
    expect(typeof caller.agent.getConversations).toBe("function");
    expect(typeof caller.agent.getTools).toBe("function");
    expect(typeof caller.agent.seedKnowledge).toBe("function");
    expect(typeof caller.agent.getKnowledgeStats).toBe("function");
  });

  it("getTools returns available tools list", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    // getTools should return an array of tool definitions
    // This doesn't require database access - it returns static tool registry
    const tools = await caller.agent.getTools();
    
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
    
    // Tools are returned in OpenAI function-calling format: { type, function: { name, description, parameters } }
    for (const tool of tools) {
      expect(tool).toHaveProperty("type");
      expect(tool.type).toBe("function");
      expect(tool).toHaveProperty("function");
      expect(tool.function).toHaveProperty("name");
      expect(tool.function).toHaveProperty("description");
      expect(typeof tool.function.name).toBe("string");
      expect(typeof tool.function.description).toBe("string");
    }
  });
});
