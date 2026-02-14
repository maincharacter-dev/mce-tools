import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, bigint } from "drizzle-orm/mysql-core";

/**
 * Multi-tenant schema for project documents, facts, and red flags
 * All tables include project_id for data isolation
 */

export const documents = mysqlTable("documents", {
  id: varchar("id", { length: 36 }).primaryKey(),
  projectId: int("project_id").notNull(), // Foreign key to projects table
  fileName: varchar("file_name", { length: 255 }).notNull(),
  filePath: varchar("file_path", { length: 500 }).notNull(),
  fileSizeBytes: bigint("file_size_bytes", { mode: "number" }).notNull(),
  fileHash: varchar("file_hash", { length: 64 }),
  documentType: varchar("document_type", { length: 50 }),
  uploadDate: timestamp("upload_date").notNull(),
  status: varchar("status", { length: 20 }).default("uploaded"),
  extractedText: text("extracted_text"),
  pageCount: int("page_count"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const extractedFacts = mysqlTable("extracted_facts", {
  id: varchar("id", { length: 36 }).primaryKey(),
  projectId: int("project_id").notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  key: varchar("key", { length: 255 }).notNull(),
  value: text("value").notNull(),
  dataType: varchar("data_type", { length: 50 }),
  confidence: decimal("confidence", { precision: 5, scale: 2 }),
  sourceDocumentId: varchar("source_document_id", { length: 36 }),
  sourceLocation: text("source_location"),
  extractionMethod: varchar("extraction_method", { length: 50 }),
  extractionModel: varchar("extraction_model", { length: 100 }),
  verified: boolean("verified").default(false),
  verificationStatus: mysqlEnum("verification_status", ["pending", "approved", "rejected"]).default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const redFlags = mysqlTable("red_flags", {
  id: varchar("id", { length: 36 }).primaryKey(),
  projectId: int("project_id").notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  severity: varchar("severity", { length: 20 }),
  triggerFactId: varchar("trigger_fact_id", { length: 36 }),
  downstreamConsequences: text("downstream_consequences"),
  mitigated: boolean("mitigated").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const processingJobs = mysqlTable("processing_jobs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  projectId: int("project_id").notNull(),
  documentId: varchar("document_id", { length: 36 }),
  jobType: varchar("job_type", { length: 50 }),
  status: varchar("status", { length: 20 }),
  progress: int("progress").default(0),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;
export type ExtractedFact = typeof extractedFacts.$inferSelect;
export type InsertExtractedFact = typeof extractedFacts.$inferInsert;
export type RedFlag = typeof redFlags.$inferSelect;
export type InsertRedFlag = typeof redFlags.$inferInsert;
export type ProcessingJob = typeof processingJobs.$inferSelect;
export type InsertProcessingJob = typeof processingJobs.$inferInsert;
