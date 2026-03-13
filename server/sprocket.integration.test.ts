/**
 * Sprocket integration tests — validates credentials, connectivity, and chat
 */
import { describe, it, expect } from "vitest";
import {
  getSprocketHealth,
  getSprocketConversations,
  sprocketChat,
  getSprocketProjects,
} from "./sprocket-client";

describe("Sprocket API connectivity", () => {
  it("should connect to Sprocket and return health status", async () => {
    const health = await getSprocketHealth();
    expect(health).toBeDefined();
    expect(health.status).toBeDefined();
    console.log("[Sprocket] Health:", JSON.stringify(health, null, 2));
  }, 15_000);

  it("should authenticate and list conversations", async () => {
    const conversations = await getSprocketConversations(1);
    expect(Array.isArray(conversations)).toBe(true);
    console.log(`[Sprocket] Found ${conversations.length} conversations`);
  }, 15_000);

  it("should list Sprocket projects", async () => {
    const projects = await getSprocketProjects(1);
    expect(Array.isArray(projects)).toBe(true);
    console.log(`[Sprocket] Found ${projects.length} projects`);
  }, 15_000);

  it("should send a chat message and get a response", async () => {
    const result = await sprocketChat({
      message: "Hello, please respond with exactly: 'Sprocket integration test successful'",
      userId: 1,
    });
    expect(result).toBeDefined();
    expect(result.message).toBeDefined();
    expect(result.conversationId).toBeDefined();
    console.log(`[Sprocket] Chat response (${result.message.length} chars): ${result.message.substring(0, 100)}...`);
    console.log(`[Sprocket] Conversation ID: ${result.conversationId}`);
  }, 30_000);
});
