import { describe, expect, it, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { projects } from "../drizzle/schema";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
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

  return ctx;
}

describe("projects router", () => {
  beforeEach(async () => {
    // Clean up test data
    const db = await getDb();
    if (db) {
      await db.delete(projects);
    }
  });

  describe("projects.create", () => {
    it("creates a new TA/TDD project", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.projects.create({
        projectName: "Test Solar Project",
        projectCode: "TSP-001",
        projectType: "TA_TDD",
      });

      expect(result).toMatchObject({
        projectName: "Test Solar Project",
        projectCode: "TSP-001",
        projectType: "TA_TDD",
      });
      expect(result.id).toBeTypeOf("number");
      expect(result.id).toBeGreaterThan(0);
    });

    it("creates a new OE project", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.projects.create({
        projectName: "Test OE Project",
        projectCode: "TOE-001",
        projectType: "OE",
      });

      expect(result).toMatchObject({
        projectName: "Test OE Project",
        projectCode: "TOE-001",
        projectType: "OE",
      });
      expect(result.id).toBeTypeOf("number");
    });

    it("fails with empty project name", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.projects.create({
          projectName: "",
          projectCode: "TSP-001",
          projectType: "TA_TDD",
        })
      ).rejects.toThrow();
    });

    it("fails with empty project code", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.projects.create({
          projectName: "Test Project",
          projectCode: "",
          projectType: "TA_TDD",
        })
      ).rejects.toThrow();
    });
  });

  describe("projects.list", () => {
    it("returns empty array when no projects exist", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.projects.list();

      expect(result).toEqual([]);
    });

    it("returns all projects", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // Create two projects
      await caller.projects.create({
        projectName: "Project 1",
        projectCode: "P1",
        projectType: "TA_TDD",
      });
      await caller.projects.create({
        projectName: "Project 2",
        projectCode: "P2",
        projectType: "OE",
      });

      const result = await caller.projects.list();

      expect(result).toHaveLength(2);
      expect(result[0]?.projectName).toBe("Project 1");
      expect(result[1]?.projectName).toBe("Project 2");
    });
  });

  describe("projects.get", () => {
    it("returns project by ID", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const created = await caller.projects.create({
        projectName: "Test Project",
        projectCode: "TP-001",
        projectType: "TA_TDD",
      });

      const result = await caller.projects.get({ id: created.id });

      expect(result).toMatchObject({
        id: created.id,
        projectName: "Test Project",
        projectCode: "TP-001",
        projectType: "TA_TDD",
        phase: "Initiation",
      });
    });

    it("throws error for non-existent project", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.projects.get({ id: 99999 })).rejects.toThrow(
        "Project not found"
      );
    });
  });

  describe("projects.updatePhase", () => {
    it("updates project phase", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const created = await caller.projects.create({
        projectName: "Test Project",
        projectCode: "TP-001",
        projectType: "TA_TDD",
      });

      const updateResult = await caller.projects.updatePhase({
        id: created.id,
        phase: "Development",
      });

      expect(updateResult).toEqual({ success: true });

      const updated = await caller.projects.get({ id: created.id });
      expect(updated.phase).toBe("Development");
    });
  });
});
