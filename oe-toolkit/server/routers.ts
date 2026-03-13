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
import { createTaTddProject } from "./taTddIntegration";
import { agentRouter } from "./routers/agent";
import { taTddProjectsRouter } from "./routers/taTddProjects";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
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

  // ACC integration router
  acc: accRouter,
  // AI Agent router (connected to TA/TDD database)
  agent: agentRouter,
  // TA/TDD Projects router (queries shared TA/TDD database)
  taTddProjects: taTddProjectsRouter,

  // Projects router
  projects: router({
    // List all projects
    list: protectedProcedure.query(async ({ ctx }) => {
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
          description: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        console.log(`[Project Creation] Creating project: ${input.projectName}`);
        
        // Step 1: Create TA/TDD engine project
        const { id: taTddProjectId, dbName: taTddDbName } = await createTaTddProject({
          name: input.projectName,
          description: input.description,
          createdByUserId: ctx.user.id, // Use the authenticated user's ID
        });
        
        console.log(`[Project Creation] Created TA/TDD project ${taTddProjectId} with DB ${taTddDbName}`);
        
        // Step 2: Create OE Toolkit project with link to TA/TDD project
        const [result] = await db.insert(projects).values({
          projectName: input.projectName,
          projectCode: input.projectCode,
          projectType: input.projectType,
          phase: "Initiation",
          taTddProjectId: taTddProjectId,
          taTddDbName: taTddDbName,
          createdByUserId: ctx.user.id,
        }).$returningId();
        
        console.log(`[Project Creation] Created OE Toolkit project ${result.id}`);
        
        return {
          id: result.id,
          projectName: input.projectName,
          projectCode: input.projectCode,
          projectType: input.projectType,
          taTddProjectId: taTddProjectId,
          taTddDbName: taTddDbName,
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
        
        // Note: Existing 03_Deliverables folder will remain for historical data
        // New 07_Deliverables will be used going forward
        
        // Create new OE folders (03-06)
        await createFolder(creds.accessToken, project.accProjectId, projectFilesFolder.id, "03_Design_Review");
        await createFolder(creds.accessToken, project.accProjectId, projectFilesFolder.id, "04_Construction_Monitoring");
        await createFolder(creds.accessToken, project.accProjectId, projectFilesFolder.id, "05_Quality_Documentation_Review");
        await createFolder(creds.accessToken, project.accProjectId, projectFilesFolder.id, "06_Project_Completion");
        
        // Create 07_Deliverables (note: existing 03_Deliverables will remain for historical data)
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
        
        console.log(`[Archive] Archiving project ${project.id}: ${project.projectName}`);
        console.log(`[Archive] Note: ACC projects must be manually renamed and archived in ACC`);
        
        // Step 1: Archive in OE Toolkit database
        await db
          .update(projects)
          .set({ 
            status: 'Archived',
            archivedAt: new Date(),
          })
          .where(eq(projects.id, input.id));
        
        console.log(`[Archive] ✓ Archived project in OE Toolkit`);
        
        // Step 2: Archive in TA/TDD database (if linked)
        if (project.taTddProjectId) {
          try {
            const { archiveTaTddProject } = await import('./taTddIntegration');
            await archiveTaTddProject(project.taTddProjectId);
            console.log(`[Archive] ✓ Archived project in TA/TDD engine`);
          } catch (error) {
            console.error('[Archive] Failed to archive TA/TDD project:', error);
            // Continue even if TA/TDD archive fails
          }
        }
        
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
