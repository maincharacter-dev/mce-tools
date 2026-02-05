import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
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
 * Projects table for OE Toolkit
 * Tracks TA/TDD and OE projects with ACC integration
 */
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  projectName: varchar("projectName", { length: 255 }).notNull(),
  projectCode: varchar("projectCode", { length: 64 }).notNull().unique(),
  projectType: mysqlEnum("projectType", ["TA_TDD", "OE"]).notNull(),
  phase: varchar("phase", { length: 64 }).notNull().default("Initiation"),
  accProjectId: varchar("accProjectId", { length: 255 }),
  accHubId: varchar("accHubId", { length: 255 }),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

/**
 * ACC credentials table
 * Stores Autodesk Platform Services OAuth tokens per project
 */
export const accCredentials = mysqlTable("accCredentials", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken"),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AccCredential = typeof accCredentials.$inferSelect;
export type InsertAccCredential = typeof accCredentials.$inferInsert;