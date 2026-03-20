import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Single source of truth for all users across the MCE platform.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Projects table — the single registry for all MCE projects.
 *
 * Each project has a dedicated MySQL database named `proj_{id}` that is
 * provisioned on creation and stores all project-specific operational data
 * (documents, facts, red flags, processing jobs, etc.).
 *
 * The mce-workspace engine and future OE engine are stateless workers that
 * connect to the appropriate `proj_{id}` database based on the project context
 * passed in each request.
 */
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  projectName: varchar("projectName", { length: 255 }).notNull(),
  projectCode: varchar("projectCode", { length: 64 }).notNull().unique(),
  projectType: mysqlEnum("projectType", ["TA_TDD", "OE"]).notNull(),
  phase: varchar("phase", { length: 64 }).notNull().default("Initiation"),

  // Per-project database name — set to `proj_{id}` on creation.
  // This is the database that mce-workspace and other engines connect to.
  projectDbName: varchar("projectDbName", { length: 255 }),

  // Autodesk Construction Cloud integration
  accProjectId: varchar("accProjectId", { length: 255 }),
  accHubId: varchar("accHubId", { length: 255 }),

  // Lifecycle
  status: mysqlEnum("status", ["Active", "Archived"]).notNull().default("Active"),
  archivedAt: timestamp("archivedAt"),

  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

/**
 * ACC credentials table.
 * Stores Autodesk Platform Services OAuth tokens per user.
 * One credential set per user, used across all their projects.
 */
export const accCredentials = mysqlTable("accCredentials", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken"),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AccCredential = typeof accCredentials.$inferSelect;
export type InsertAccCredential = typeof accCredentials.$inferInsert;
