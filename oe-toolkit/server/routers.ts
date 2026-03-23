import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { accRouter } from "./accRouter";
import { getDb } from "./db";
import { projects, accCredentials } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { listProjectFolders, createFolder } from "./aps";
import { z } from "zod";
import { agentRouter } from "./routers/agent";
import { workspaceProjectsRouter } from "./routers/workspaceProjects";
import { adminUsersRouter } from "./routers/adminUsers";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts
  // all api routes should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Admin users management router (admin-only)
  adminUsers: adminUsersRouter,
  // ACC integration router
  acc: accRouter,
  // AI Agent router
  agent: agentRouter,
  // Workspace project context router (reads from mce-workspace database for Sprocket)
  workspaceProjects: workspaceProjectsRouter,

  // Projects router — oe_toolkit is the single source of truth for all projects
  projects: router({
    // List all projects
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      return await db.select().from(projects);
    }),

    // Get project by ID
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const result = await db
          .select()
          .from(projects)
          .where(eq(projects.id, input.id))
          .limit(1);

        if (!result || result.length === 0) {
          throw new Error("Project not found");
        }

        return result[0];
      }),

    // Create new project
    create: protectedProcedure
      .input(
        z.object({
          projectName: z.string().min(1),
          projectCode: z.string().min(1),
          projectType: z.enum(["TA_TDD", "OE"]),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        console.log(`[Project Creation] Creating project: ${input.projectName}`);

        // Insert the project row
        const [result] = await db.insert(projects).values({
          projectName: input.projectName,
          projectCode: input.projectCode,
          projectType: input.projectType,
          phase: "Initiation",
          createdByUserId: ctx.user.id,
        }).$returningId();

        const projectId = result.id;
        const projectDbName = `proj_${projectId}`;

        // Set the projectDbName now that we have the ID
        await db
          .update(projects)
          .set({ projectDbName })
          .where(eq(projects.id, projectId));

        // Provision mce-workspace tables for this project (fire-and-forget with logging)
        const workspaceUrl = process.env.MCE_WORKSPACE_URL || "http://mce-workspace:3000";
        fetch(`${workspaceUrl}/api/trpc/projects.provision`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ json: { projectId } }),
        }).then(res => {
          if (!res.ok) console.warn(`[Project Creation] mce-workspace provision returned ${res.status}`);
          else console.log(`[Project Creation] ✓ mce-workspace tables provisioned for project ${projectId}`);
        }).catch(err => {
          console.warn(`[Project Creation] mce-workspace provision failed (non-fatal): ${err.message}`);
        });

        console.log(`[Project Creation] ✓ Project ${projectId} created (db: ${projectDbName})`);

        return {
          id: projectId,
          projectName: input.projectName,
          projectCode: input.projectCode,
          projectType: input.projectType,
          projectDbName,
        };
      }),

    // Update project phase
    updatePhase: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          phase: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await db
          .update(projects)
          .set({ phase: input.phase })
          .where(eq(projects.id, input.id));

        return { success: true };
      }),

    // Transition TA/TDD project to OE
    transitionToOE: protectedProcedure
      .input(
        z.object({
          id: z.number(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Get project
        const [project] = await db
          .select()
          .from(projects)
          .where(eq(projects.id, input.id))
          .limit(1);

        if (!project) {
          throw new Error("Project not found");
        }

        if (project.projectType !== "TA_TDD") {
          throw new Error("Only TA/TDD projects can be transitioned to OE");
        }

        if (!project.accProjectId || !project.accHubId) {
          throw new Error("Project must have an ACC project before transitioning");
        }

        // Get ACC credentials for current user
        const [creds] = await db
          .select()
          .from(accCredentials)
          .where(eq(accCredentials.userId, ctx.user.id))
          .limit(1);

        if (!creds) {
          throw new Error("No ACC credentials found. Please connect to ACC first.");
        }

        // Get project folders to find "Project Files" folder
        const folders = await listProjectFolders(
          creds.accessToken,
          project.accHubId,
          project.accProjectId
        );
        const projectFilesFolder = folders.find(
          (f: any) => f.attributes.displayName === "Project Files"
        );

        if (!projectFilesFolder) {
          throw new Error("Could not find Project Files folder in ACC project");
        }

        // Create new OE folders
        await createFolder(creds.accessToken, project.accProjectId, projectFilesFolder.id, "03_Design_Review");
        await createFolder(creds.accessToken, project.accProjectId, projectFilesFolder.id, "04_Construction_Monitoring");
        await createFolder(creds.accessToken, project.accProjectId, projectFilesFolder.id, "05_Quality_Documentation_Review");
        await createFolder(creds.accessToken, project.accProjectId, projectFilesFolder.id, "06_Project_Completion");
        await createFolder(creds.accessToken, project.accProjectId, projectFilesFolder.id, "07_Deliverables");

        // Update project type to OE
        await db
          .update(projects)
          .set({
            projectType: "OE",
            phase: "Design Review",
          })
          .where(eq(projects.id, input.id));

        return { success: true };
      }),

    // Archive project
    archive: protectedProcedure
      .input(
        z.object({
          id: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await db
          .update(projects)
          .set({
            status: 'Archived',
            archivedAt: new Date(),
          })
          .where(eq(projects.id, input.id));

        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
