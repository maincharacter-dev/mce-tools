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
  pollProjectActivation,
  getUserProfile,
  assignProjectAdmin,
  createFolder,
  listProjectFolders,
} from "./aps";
import { getDb } from "./db";
import { accCredentials, projects } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { getProjectDbConnection } from "./projectProvisioner";

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
      let accProject;
      try {
        accProject = await createACCProject(
          creds[0].accessToken,
          input.hubId,
          input.projectName,
          input.projectType === 'TA_TDD' ? 'Office' : 'Office' // Map project type to ACC type
        );
      } catch (error: any) {
        // Handle 409 Conflict (duplicate project name)
        if (error.message.includes('409')) {
          throw new Error(`A project named "${input.projectName}" already exists in this ACC account. Please choose a different name.`);
        }
        throw error;
      }
      
      // Convert ACC Admin project ID to Data Management format (add b. prefix)
      const dmProjectId = `b.${accProject.id}`;
      console.log('[ACC] Created project ID:', accProject.id, '-> DM format:', dmProjectId);
      
      // Wait for project activation (project must be active before folder operations)
      console.log('[ACC] Waiting for project activation...');
      try {
        await pollProjectActivation(creds[0].accessToken, accProject.id);
        console.log('[ACC] Project activation complete!');
      } catch (error: any) {
        console.error('[ACC] Project activation timeout:', error.message);
        throw new Error(`Project created but activation timed out: ${error.message}. The project may still be activating in ACC.`);
      }
      
      // Assign current user as project administrator
      console.log('[ACC] Assigning current user as project administrator...');
      try {
        const userProfile = await getUserProfile(creds[0].accessToken);
        console.log('[ACC] User profile:', JSON.stringify(userProfile, null, 2));
        
        await assignProjectAdmin(
          creds[0].accessToken,
          accProject.id,
          userProfile.userId,
          userProfile.emailId
        );
        console.log('[ACC] User assigned as project admin!');
      } catch (error: any) {
        console.error('[ACC] Failed to assign project admin:', error.message);
        // Don't fail the whole operation if user assignment fails
        // The project is still created and activated
      }
      
      // Wait for ACC to provision the project folders (retry with exponential backoff)
      let folders: any[] = [];
      let retries = 0;
      const maxRetries = 10; // Increased from 5 to 10 for more patience
      
      while (retries < maxRetries) {
        try {
          console.log(`[ACC] Attempting to list project folders (attempt ${retries + 1}/${maxRetries})...`);
          folders = await listProjectFolders(creds[0].accessToken, input.hubId, dmProjectId);
          console.log('[ACC] Successfully listed project folders');
          break;
        } catch (error: any) {
          retries++;
          if (retries >= maxRetries) {
            console.error('[ACC] Max retries reached, project may not be provisioned yet');
            throw new Error(`Failed to list project folders after ${maxRetries} attempts: ${error.message}`);
          }
          const delay = Math.pow(2, retries) * 1000; // Exponential backoff: 2s, 4s, 8s, 16s
          console.log(`[ACC] Retry ${retries}/${maxRetries} - waiting ${delay}ms before next attempt`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      const projectFilesFolder = folders.find((f: any) => f.attributes.displayName === "Project Files");
      
      if (!projectFilesFolder) {
        throw new Error("Could not find Project Files folder in ACC project");
      }
      
      // Create folder structure based on project type
      if (input.projectType === "TA_TDD") {
        // TA/TDD structure: 01_PM, 02_Data_Incoming, 03_Deliverables
        await createFolder(creds[0].accessToken, dmProjectId, projectFilesFolder.id, "01_PM");
        const dataIncoming = await createFolder(creds[0].accessToken, dmProjectId, projectFilesFolder.id, "02_Data_Incoming");
        await createFolder(creds[0].accessToken, dmProjectId, projectFilesFolder.id, "03_Deliverables");
        
        // Create subfolders in Data_Incoming
        await createFolder(creds[0].accessToken, dmProjectId, dataIncoming.id, "Information_Memorandum");
        await createFolder(creds[0].accessToken, dmProjectId, dataIncoming.id, "Due_Diligence_Pack");
        await createFolder(creds[0].accessToken, dmProjectId, dataIncoming.id, "Contracts");
        await createFolder(creds[0].accessToken, dmProjectId, dataIncoming.id, "Grid_Studies");
        await createFolder(creds[0].accessToken, dmProjectId, dataIncoming.id, "Concept_Design");
        await createFolder(creds[0].accessToken, dmProjectId, dataIncoming.id, "Other_Documents");
      } else {
        // OE structure: 01_PM, 02_Data_Incoming, 03-06 (OE phases), 07_Deliverables
        await createFolder(creds[0].accessToken, dmProjectId, projectFilesFolder.id, "01_PM");
        await createFolder(creds[0].accessToken, dmProjectId, projectFilesFolder.id, "02_Data_Incoming");
        await createFolder(creds[0].accessToken, dmProjectId, projectFilesFolder.id, "03_Design_Review");
        await createFolder(creds[0].accessToken, dmProjectId, projectFilesFolder.id, "04_Construction_Monitoring");
        await createFolder(creds[0].accessToken, dmProjectId, projectFilesFolder.id, "05_Quality_Documentation_Review");
        await createFolder(creds[0].accessToken, dmProjectId, projectFilesFolder.id, "06_Project_Completion");
        await createFolder(creds[0].accessToken, dmProjectId, projectFilesFolder.id, "07_Deliverables");
      }
      
      // Update OE Toolkit project with ACC project ID and hub ID
      await db
        .update(projects)
        .set({
          accProjectId: accProject.id,
          accHubId: input.hubId,
        })
        .where(eq(projects.id, input.projectId));
      
      // Store ACC mapping and credentials in the project's dedicated database
      try {
        const projectConn = await getProjectDbConnection(input.projectId);
        try {
          // Get hub name
          const hubs = await listHubs(creds[0].accessToken);
          const hub = hubs.find((h: any) => h.id === input.hubId);
          const hubName = (hub as any)?.attributes?.name || 'Unknown Hub';

          // Store ACC project mapping
          await projectConn.execute(
            `INSERT INTO acc_project_mapping (accHubId, accHubName, accProjectId, accProjectName, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, NOW(), NOW())`,
            [input.hubId, hubName, accProject.id, accProject.name]
          );

          // Store ACC credentials
          await projectConn.execute(
            `INSERT INTO acc_credentials (accessToken, refreshToken, expiresAt, createdAt, updatedAt)
             VALUES (?, ?, ?, NOW(), NOW())`,
            [creds[0].accessToken, creds[0].refreshToken || null, new Date(creds[0].expiresAt)]
          );

          console.log(`[ACC] Stored ACC mapping and credentials in project database proj_${input.projectId}`);
        } finally {
          await projectConn.end();
        }
      } catch (error) {
        console.error('[ACC] Failed to store ACC data in project database:', error);
        // Non-fatal: ACC project is created, credentials are in oe_toolkit.accCredentials
      }
      
      return {
        accProjectId: accProject.id,
        accProjectName: accProject.name,
      };
    }),

  /**
   * List all ACC projects in a hub/account
   */
  listACCProjects: protectedProcedure
    .input(
      z.object({
        hubId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // Get user's ACC credentials
      const creds = await db
        .select()
        .from(accCredentials)
        .where(eq(accCredentials.userId, ctx.user.id));
      
      if (creds.length === 0) {
        throw new Error("No ACC credentials found. Please connect to ACC first.");
      }
      
      const { listACCProjects } = await import("./aps");
      const projects = await listACCProjects(creds[0].accessToken, input.hubId);
      
      return projects;
    }),

  /**
   * Delete an ACC project
   */
  deleteACCProject: protectedProcedure
    .input(
      z.object({
        hubId: z.string(),
        projectId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // Get user's ACC credentials
      const creds = await db
        .select()
        .from(accCredentials)
        .where(eq(accCredentials.userId, ctx.user.id));
      
      if (creds.length === 0) {
        throw new Error("No ACC credentials found. Please connect to ACC first.");
      }
      
      const { deleteACCProject } = await import("./aps");
      await deleteACCProject(creds[0].accessToken, input.hubId, input.projectId);
      
      return { success: true };
    }),
});
