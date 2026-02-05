/**
 * ACC (Autodesk Construction Cloud) Router for OE Toolkit
 * 
 * Handles APS OAuth and ACC project creation with ISO 19650 folder structure.
 */

import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import {
  getAPSAuthUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  listHubs,
  listProjects,
  createACCProject,
  createFolder,
  listProjectFolders,
} from "./aps";
import { getDb } from "./db";
import { accCredentials, projects } from "../drizzle/schema";
import { eq } from "drizzle-orm";

export const accRouter = router({
  /**
   * Get APS OAuth authorization URL
   */
  getAuthUrl: publicProcedure
    .input(
      z.object({
        redirectUri: z.string(),
        projectId: z.number(), // Required: project ID to associate credentials with
      })
    )
    .query(({ input }) => {
      // Pass projectId as state parameter so OAuth callback knows which project to store tokens for
      const authUrl = getAPSAuthUrl(input.redirectUri, input.projectId.toString());
      return { authUrl };
    }),

  /**
   * Exchange authorization code for access token and store credentials for current user
   */
  exchangeCode: protectedProcedure
    .input(
      z.object({
        code: z.string(),
        redirectUri: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const tokens = await exchangeCodeForToken(input.code, input.redirectUri);
      
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // Calculate expiry time (tokens typically expire in 3600 seconds)
      const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);
      
      // Delete any existing credentials for this user
      await db.delete(accCredentials).where(eq(accCredentials.userId, ctx.user.id));
      
      // Insert new credentials
      await db.insert(accCredentials).values({
        userId: ctx.user.id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
      });
      
      console.log(`[ACC Auth] Stored credentials for user ${ctx.user.id}`);
      
      return tokens;
    }),

  /**
   * Get stored ACC credentials for the current user
   */
  getStoredCredentials: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const creds = await db
        .select()
        .from(accCredentials)
        .where(eq(accCredentials.userId, ctx.user.id))
        .limit(1);
      
      if (!creds || creds.length === 0) {
        return { hasCredentials: false };
      }
      
      const cred = creds[0];
      const expiresAt = new Date(cred.expiresAt);
      const isExpired = expiresAt < new Date();
      
      // If expired, try to refresh
      if (isExpired && cred.refreshToken) {
        console.log(`[ACC Auth] Token expired, refreshing...`);
        try {
          const tokens = await refreshAccessToken(cred.refreshToken);
          
          // Update credentials in database
          const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);
          await db
            .update(accCredentials)
            .set({
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token,
              expiresAt: newExpiresAt,
            })
            .where(eq(accCredentials.id, cred.id));
          
          console.log(`[ACC Auth] Token refreshed successfully`);
          return {
            hasCredentials: true,
            isExpired: false,
            accessToken: tokens.access_token,
            expiresAt: newExpiresAt.toISOString(),
          };
        } catch (error) {
          console.error(`[ACC Auth] Failed to refresh token:`, error);
          return { hasCredentials: true, isExpired: true };
        }
      }
      
      return {
        hasCredentials: true,
        isExpired: false,
        accessToken: cred.accessToken,
        expiresAt: expiresAt.toISOString(),
      };
    }),

  /**
   * Disconnect ACC (remove user credentials)
   */
  disconnect: protectedProcedure
    .mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      await db.delete(accCredentials).where(eq(accCredentials.userId, ctx.user.id));
      
      return { success: true };
    }),

  /**
   * List all accessible ACC hubs for current user
   */
  listHubs: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const creds = await db
        .select()
        .from(accCredentials)
        .where(eq(accCredentials.userId, ctx.user.id))
        .limit(1);
      
      if (!creds || creds.length === 0) {
        throw new Error("No ACC credentials found. Please connect to ACC first.");
      }
      
      return await listHubs(creds[0].accessToken);
    }),

  /**
   * List projects within a hub
   */
  listProjects: protectedProcedure
    .input(
      z.object({
        hubId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const creds = await db
        .select()
        .from(accCredentials)
        .where(eq(accCredentials.userId, ctx.user.id))
        .limit(1);
      
      if (!creds || creds.length === 0) {
        throw new Error("No ACC credentials found. Please connect to ACC first.");
      }
      
      return await listProjects(creds[0].accessToken, input.hubId);
    }),

  /**
   * Create ACC project with ISO 19650 folder structure
   */
  createProject: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        hubId: z.string(),
        projectName: z.string(),
        projectType: z.enum(["TA_TDD", "OE"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const creds = await db
        .select()
        .from(accCredentials)
        .where(eq(accCredentials.userId, ctx.user.id))
        .limit(1);
      
      if (!creds || creds.length === 0) {
        throw new Error("No ACC credentials found. Please connect to ACC first.");
      }
      
      // Create ACC project
      const accProject = await createACCProject(
        creds[0].accessToken,
        input.hubId,
        input.projectName
      );
      
      // Get project folders to find "Project Files" folder
      const folders = await listProjectFolders(creds[0].accessToken, input.hubId, accProject.id);
      const projectFilesFolder = folders.find((f: any) => f.attributes.displayName === "Project Files");
      
      if (!projectFilesFolder) {
        throw new Error("Could not find Project Files folder in ACC project");
      }
      
      // Create folder structure based on project type
      if (input.projectType === "TA_TDD") {
        // TA/TDD structure: 01_PM, 02_Data_Incoming, 03_Deliverables
        await createFolder(creds[0].accessToken, accProject.id, projectFilesFolder.id, "01_PM");
        const dataIncoming = await createFolder(creds[0].accessToken, accProject.id, projectFilesFolder.id, "02_Data_Incoming");
        await createFolder(creds[0].accessToken, accProject.id, projectFilesFolder.id, "03_Deliverables");
        
        // Create subfolders in Data_Incoming
        await createFolder(creds[0].accessToken, accProject.id, dataIncoming.id, "Information_Memorandum");
        await createFolder(creds[0].accessToken, accProject.id, dataIncoming.id, "Due_Diligence_Pack");
        await createFolder(creds[0].accessToken, accProject.id, dataIncoming.id, "Contracts");
        await createFolder(creds[0].accessToken, accProject.id, dataIncoming.id, "Grid_Studies");
        await createFolder(creds[0].accessToken, accProject.id, dataIncoming.id, "Concept_Design");
        await createFolder(creds[0].accessToken, accProject.id, dataIncoming.id, "Other_Documents");
      } else {
        // OE structure: 01_PM, 02_Data_Incoming, 03-06 (OE phases), 07_Deliverables
        await createFolder(creds[0].accessToken, accProject.id, projectFilesFolder.id, "01_PM");
        await createFolder(creds[0].accessToken, accProject.id, projectFilesFolder.id, "02_Data_Incoming");
        await createFolder(creds[0].accessToken, accProject.id, projectFilesFolder.id, "03_Design_Review");
        await createFolder(creds[0].accessToken, accProject.id, projectFilesFolder.id, "04_Construction_Monitoring");
        await createFolder(creds[0].accessToken, accProject.id, projectFilesFolder.id, "05_Quality_Documentation_Review");
        await createFolder(creds[0].accessToken, accProject.id, projectFilesFolder.id, "06_Project_Completion");
        await createFolder(creds[0].accessToken, accProject.id, projectFilesFolder.id, "07_Deliverables");
      }
      
      // Update OE Toolkit project with ACC project ID and hub ID
      await db
        .update(projects)
        .set({
          accProjectId: accProject.id,
          accHubId: input.hubId,
        })
        .where(eq(projects.id, input.projectId));
      
      return {
        accProjectId: accProject.id,
        accProjectName: accProject.attributes.name,
      };
    }),
});
