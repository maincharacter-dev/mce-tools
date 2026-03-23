/**
 * Admin Users Router
 *
 * Admin-only endpoints for managing local auth users.
 * All mutations update the in-memory LOCAL_USERS list AND the database.
 *
 * Note: In LOCAL_AUTH mode, the source of truth for credentials is the
 * LOCAL_USERS environment variable. This router allows admins to view
 * and manage users that are currently active in the database.
 */
import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq, ne } from "drizzle-orm";

export const adminUsersRouter = router({
  /**
   * List all users in the database.
   */
  list: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    return await db
      .select({
        id: users.id,
        openId: users.openId,
        name: users.name,
        email: users.email,
        role: users.role,
        loginMethod: users.loginMethod,
        createdAt: users.createdAt,
        lastSignedIn: users.lastSignedIn,
      })
      .from(users)
      .orderBy(users.createdAt);
  }),

  /**
   * Update a user's name, email, or role.
   * Cannot demote the last admin.
   */
  update: adminProcedure
    .input(
      z.object({
        openId: z.string(),
        name: z.string().min(1).optional(),
        email: z.string().email().nullable().optional(),
        role: z.enum(["user", "admin"]).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Prevent demoting self
      if (input.role === "user" && ctx.user.openId === input.openId) {
        throw new Error("You cannot demote yourself from admin.");
      }

      // Prevent removing the last admin
      if (input.role === "user") {
        const adminCount = await db
          .select({ id: users.id })
          .from(users)
          .where(ne(users.openId, input.openId));
        const otherAdmins = adminCount.filter(() => true); // just checking count
        const allAdmins = await db
          .select({ id: users.id, role: users.role })
          .from(users)
          .where(ne(users.openId, input.openId));
        const remainingAdmins = allAdmins.filter((u) => u.role === "admin");
        if (remainingAdmins.length === 0) {
          throw new Error("Cannot demote the last admin user.");
        }
      }

      const updateSet: Record<string, unknown> = {};
      if (input.name !== undefined) updateSet.name = input.name;
      if (input.email !== undefined) updateSet.email = input.email;
      if (input.role !== undefined) updateSet.role = input.role;

      if (Object.keys(updateSet).length === 0) return { success: true };

      await db.update(users).set(updateSet).where(eq(users.openId, input.openId));
      return { success: true };
    }),

  /**
   * Delete a user from the database.
   * Cannot delete self or the last admin.
   */
  delete: adminProcedure
    .input(z.object({ openId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      if (ctx.user.openId === input.openId) {
        throw new Error("You cannot delete your own account.");
      }

      // Ensure at least one admin remains
      const targetUser = await db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.openId, input.openId))
        .limit(1);

      if (targetUser[0]?.role === "admin") {
        const allAdmins = await db
          .select({ id: users.id })
          .from(users)
          .where(ne(users.openId, input.openId));
        // We need at least one other admin
        const otherAdmins = (
          await db
            .select({ id: users.id, role: users.role })
            .from(users)
            .where(ne(users.openId, input.openId))
        ).filter((u) => u.role === "admin");
        if (otherAdmins.length === 0) {
          throw new Error("Cannot delete the last admin user.");
        }
      }

      await db.delete(users).where(eq(users.openId, input.openId));
      return { success: true };
    }),
});
