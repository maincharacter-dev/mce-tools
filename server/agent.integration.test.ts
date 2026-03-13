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

  it("agent router has expected Sprocket proxy procedures", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Core Sprocket proxy procedures (replaced @oe-ecosystem/ai-agent)
    expect(typeof caller.agent.chat).toBe("function");
    expect(typeof caller.agent.getConversations).toBe("function");
    expect(typeof caller.agent.getMessages).toBe("function");
    expect(typeof caller.agent.deleteConversation).toBe("function");
    expect(typeof caller.agent.getProjects).toBe("function");
    expect(typeof caller.agent.createProject).toBe("function");
    expect(typeof caller.agent.health).toBe("function");
  });
});
