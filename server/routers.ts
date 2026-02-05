import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { accRouter } from "./accRouter";
import { getDb } from "./db";
import { projects } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

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
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const [result] = await db.insert(projects).values({
          projectName: input.projectName,
          projectCode: input.projectCode,
          projectType: input.projectType,
          phase: "Initiation",
          createdByUserId: ctx.user.id,
        }).$returningId();
        
        return {
          id: result.id,
          projectName: input.projectName,
          projectCode: input.projectCode,
          projectType: input.projectType,
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
  }),
});

export type AppRouter = typeof appRouter;
