import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json } from "drizzle-orm/mysql-core";

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
 * Multi-tenant tables for project documents, facts, and red flags
 */
export const documents = mysqlTable("documents", {
  id: varchar("id", { length: 36 }).primaryKey(),
  projectId: int("project_id").notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  filePath: varchar("file_path", { length: 500 }).notNull(),
  fileSizeBytes: int("file_size_bytes").notNull(),
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
  confidence: varchar("confidence", { length: 10 }),
  sourceDocumentId: varchar("source_document_id", { length: 36 }),
  sourceLocation: text("source_location"),
  extractionMethod: varchar("extraction_method", { length: 50 }),
  extractionModel: varchar("extraction_model", { length: 100 }),
  verified: int("verified").default(0),
  verificationStatus: varchar("verification_status", { length: 20 }).default("pending"),
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
  mitigated: int("mitigated").default(0),
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

export const performanceValidations = mysqlTable("performance_validations", {
  id: varchar("id", { length: 36 }).primaryKey(),
  projectId: int("project_id").notNull(),
  calculationId: varchar("calculation_id", { length: 100 }).notNull(),
  
  // Results
  annualGenerationGwh: varchar("annual_generation_gwh", { length: 20 }),
  capacityFactorPercent: varchar("capacity_factor_percent", { length: 20 }),
  performanceRatioPercent: varchar("performance_ratio_percent", { length: 20 }),
  specificYieldKwhKwp: varchar("specific_yield_kwh_kwp", { length: 20 }),
  
  // Contractor claims comparison
  contractorClaimGwh: varchar("contractor_claim_gwh", { length: 20 }),
  variancePercent: varchar("variance_percent", { length: 20 }),
  varianceGwh: varchar("variance_gwh", { length: 20 }),
  flagTriggered: int("flag_triggered").default(0),
  confidenceLevel: varchar("confidence_level", { length: 20 }),
  
  // Input summary
  dcCapacityMw: varchar("dc_capacity_mw", { length: 20 }),
  acCapacityMw: varchar("ac_capacity_mw", { length: 20 }),
  moduleModel: varchar("module_model", { length: 255 }),
  inverterModel: varchar("inverter_model", { length: 255 }),
  trackingType: varchar("tracking_type", { length: 50 }),
  totalSystemLossesPercent: varchar("total_system_losses_percent", { length: 20 }),
  parametersExtractedCount: int("parameters_extracted_count"),
  parametersAssumedCount: int("parameters_assumed_count"),
  confidenceScore: varchar("confidence_score", { length: 20 }),
  
  // Weather data
  weatherDataSource: varchar("weather_data_source", { length: 255 }),
  ghiAnnualKwhM2: varchar("ghi_annual_kwh_m2", { length: 20 }),
  poaAnnualKwhM2: varchar("poa_annual_kwh_m2", { length: 20 }),
  
  // Monthly profile (stored as JSON)
  monthlyProfile: text("monthly_profile"),
  
  // Metadata
  modelUsed: varchar("model_used", { length: 50 }),
  pysamVersion: varchar("pysam_version", { length: 20 }),
  calculationTimeSeconds: varchar("calculation_time_seconds", { length: 20 }),
  warnings: text("warnings"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;
export type ExtractedFact = typeof extractedFacts.$inferSelect;
export type InsertExtractedFact = typeof extractedFacts.$inferInsert;
export type RedFlag = typeof redFlags.$inferSelect;
export type InsertRedFlag = typeof redFlags.$inferInsert;
export type ProcessingJob = typeof processingJobs.$inferSelect;
export type InsertProcessingJob = typeof processingJobs.$inferInsert;
export type PerformanceValidation = typeof performanceValidations.$inferSelect;
export type InsertPerformanceValidation = typeof performanceValidations.$inferInsert;

/**
 * Performance parameters extracted from project documents
 * Used as inputs for Solar Analyzer performance validation
 */
export const performanceParameters = mysqlTable("performance_parameters", {
  id: varchar("id", { length: 36 }).primaryKey(),
  projectId: int("project_id").notNull(),
  
  // System design
  dcCapacityMw: varchar("dc_capacity_mw", { length: 20 }),
  acCapacityMw: varchar("ac_capacity_mw", { length: 20 }),
  moduleModel: varchar("module_model", { length: 255 }),
  modulePowerWatts: varchar("module_power_watts", { length: 20 }),
  moduleCount: int("module_count"),
  inverterModel: varchar("inverter_model", { length: 255 }),
  inverterPowerKw: varchar("inverter_power_kw", { length: 20 }),
  inverterCount: int("inverter_count"),
  trackingType: varchar("tracking_type", { length: 50 }), // fixed_tilt, single_axis, dual_axis
  tiltAngleDegrees: varchar("tilt_angle_degrees", { length: 20 }),
  azimuthDegrees: varchar("azimuth_degrees", { length: 20 }),
  
  // Location
  latitude: varchar("latitude", { length: 20 }),
  longitude: varchar("longitude", { length: 20 }),
  siteName: varchar("site_name", { length: 255 }),
  elevationM: varchar("elevation_m", { length: 20 }),
  timezone: varchar("timezone", { length: 50 }),
  
  // Performance assumptions
  systemLossesPercent: varchar("system_losses_percent", { length: 20 }),
  degradationRatePercent: varchar("degradation_rate_percent", { length: 20 }),
  availabilityPercent: varchar("availability_percent", { length: 20 }),
  soilingLossPercent: varchar("soiling_loss_percent", { length: 20 }),
  
  // Weather data
  weatherFileUrl: varchar("weather_file_url", { length: 500 }),
  ghiAnnualKwhM2: varchar("ghi_annual_kwh_m2", { length: 20 }),
  dniAnnualKwhM2: varchar("dni_annual_kwh_m2", { length: 20 }),
  temperatureAmbientC: varchar("temperature_ambient_c", { length: 20 }),
  
  // Contractor claims
  p50GenerationGwh: varchar("p50_generation_gwh", { length: 20 }),
  p90GenerationGwh: varchar("p90_generation_gwh", { length: 20 }),
  capacityFactorPercent: varchar("capacity_factor_percent", { length: 20 }),
  specificYieldKwhKwp: varchar("specific_yield_kwh_kwp", { length: 20 }),
  
  // Metadata
  sourceDocumentId: varchar("source_document_id", { length: 36 }),
  confidence: varchar("confidence", { length: 20 }),
  extractionMethod: varchar("extraction_method", { length: 50 }), // llm, deterministic, manual
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

/**
 * Financial data extracted from project documents
 * Used for CapEx/OpEx benchmarking and analysis
 */
export const financialData = mysqlTable("financial_data", {
  id: varchar("id", { length: 36 }).primaryKey(),
  projectId: int("project_id").notNull(),
  
  // CapEx breakdown (in USD)
  totalCapexUsd: varchar("total_capex_usd", { length: 20 }),
  modulesUsd: varchar("modules_usd", { length: 20 }),
  invertersUsd: varchar("inverters_usd", { length: 20 }),
  trackersUsd: varchar("trackers_usd", { length: 20 }),
  civilWorksUsd: varchar("civil_works_usd", { length: 20 }),
  gridConnectionUsd: varchar("grid_connection_usd", { length: 20 }),
  developmentCostsUsd: varchar("development_costs_usd", { length: 20 }),
  otherCapexUsd: varchar("other_capex_usd", { length: 20 }),
  
  // OpEx breakdown (annual, in USD)
  totalOpexAnnualUsd: varchar("total_opex_annual_usd", { length: 20 }),
  omUsd: varchar("om_usd", { length: 20 }),
  insuranceUsd: varchar("insurance_usd", { length: 20 }),
  landLeaseUsd: varchar("land_lease_usd", { length: 20 }),
  assetManagementUsd: varchar("asset_management_usd", { length: 20 }),
  otherOpexUsd: varchar("other_opex_usd", { length: 20 }),
  
  // Normalized metrics
  capexPerWattUsd: varchar("capex_per_watt_usd", { length: 20 }),
  opexPerMwhUsd: varchar("opex_per_mwh_usd", { length: 20 }),
  
  // Currency and date
  originalCurrency: varchar("original_currency", { length: 10 }),
  exchangeRateToUsd: varchar("exchange_rate_to_usd", { length: 20 }),
  costYear: int("cost_year"),
  escalationRatePercent: varchar("escalation_rate_percent", { length: 20 }),
  
  // Metadata
  sourceDocumentId: varchar("source_document_id", { length: 36 }),
  confidence: varchar("confidence", { length: 20 }),
  extractionMethod: varchar("extraction_method", { length: 50 }), // llm, deterministic, manual
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

/**
 * Weather files for performance validation
 * Supports both extracted (from documents) and manually uploaded files
 */
export const weatherFiles = mysqlTable("weather_files", {
  id: varchar("id", { length: 36 }).primaryKey(),
  projectId: int("project_id").notNull(),
  
  // File storage
  fileKey: varchar("file_key", { length: 500 }).notNull(), // S3 key
  fileUrl: varchar("file_url", { length: 500 }).notNull(), // S3 URL
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileSizeBytes: int("file_size_bytes").notNull(),
  
  // Source tracking
  sourceType: varchar("source_type", { length: 50 }).notNull(), // extracted, manual_upload, pvgis_api
  sourceDocumentId: varchar("source_document_id", { length: 36 }), // If extracted from document
  extractedUrl: varchar("extracted_url", { length: 500 }), // Original URL if extracted
  
  // Format and metadata
  originalFormat: varchar("original_format", { length: 50 }), // pvgis, tmy3, epw, pvsyst, sam_csv
  convertedFormat: varchar("converted_format", { length: 50 }).default("sam_csv"),
  convertedFileKey: varchar("converted_file_key", { length: 500 }), // S3 key for SAM CSV
  
  // Location metadata
  latitude: varchar("latitude", { length: 20 }),
  longitude: varchar("longitude", { length: 20 }),
  elevation: varchar("elevation", { length: 20 }),
  timezone: varchar("timezone", { length: 20 }),
  locationName: varchar("location_name", { length: 255 }),
  
  // Quality metrics
  qualityScore: varchar("quality_score", { length: 20 }), // 0.0-1.0
  recordCount: int("record_count"), // Should be 8760 for hourly annual
  missingHours: int("missing_hours"),
  outlierCount: int("outlier_count"),
  validationWarnings: text("validation_warnings"), // JSON array of warnings
  
  // Parsed data (from TMY file)
  monthlyIrradiance: json("monthly_irradiance"), // JSON array of monthly GHI/DNI data
  annualSummary: json("annual_summary"), // JSON object with annual totals
  parsedLocation: json("parsed_location"), // JSON object with lat/lon/elevation from file
  
  // Status
  status: varchar("status", { length: 20 }).default("pending"), // pending, processing, ready, failed
  processingError: text("processing_error"),
  
  // Usage tracking
  usedInValidationId: varchar("used_in_validation_id", { length: 36 }), // Link to performance_validations
  isActive: int("is_active").default(1), // Allow multiple files, mark which is active
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type PerformanceParameters = typeof performanceParameters.$inferSelect;
export type InsertPerformanceParameters = typeof performanceParameters.$inferInsert;
export type FinancialData = typeof financialData.$inferSelect;
export type InsertFinancialData = typeof financialData.$inferInsert;
export type WeatherFile = typeof weatherFiles.$inferSelect;
export type InsertWeatherFile = typeof weatherFiles.$inferInsert;

/**
 * Projects table - stores project metadata and per-project database configuration
 */
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  dbName: varchar("dbName", { length: 255 }).notNull().unique(), // Dynamic project DB name
  dbHost: varchar("dbHost", { length: 255 }).default("localhost"),
  dbPort: int("dbPort").default(3306),
  dbUser: varchar("dbUser", { length: 255 }),
  dbPassword: varchar("dbPassword", { length: 255 }),
  status: mysqlEnum("status", ["Active", "Archived", "Deleted"]).default("Active"),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

/**
 * Knowledge base configuration - stores connection details for the central knowledge database
 */
export const knowledgeBaseConfig = mysqlTable("knowledgeBaseConfig", {
  id: int("id").autoincrement().primaryKey(),
  dbName: varchar("dbName", { length: 255 }).notNull().unique(),
  dbHost: varchar("dbHost", { length: 255 }).default("localhost"),
  dbPort: int("dbPort").default(3306),
  dbUser: varchar("dbUser", { length: 255 }),
  dbPassword: varchar("dbPassword", { length: 255 }),
  status: mysqlEnum("status", ["Active", "Inactive"]).default("Active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type KnowledgeBaseConfig = typeof knowledgeBaseConfig.$inferSelect;
export type InsertKnowledgeBaseConfig = typeof knowledgeBaseConfig.$inferInsert;

/**
 * Ollama configuration - stores LLM model settings for document processing
 */
export const ollamaConfig = mysqlTable("ollamaConfig", {
  id: int("id").autoincrement().primaryKey(),
  baseUrl: varchar("baseUrl", { length: 255 }).default("http://localhost:11434"),
  model: varchar("model", { length: 255 }).default("llama2"),
  temperature: varchar("temperature", { length: 10 }).default("0.3"),
  topP: varchar("topP", { length: 10 }).default("0.9"),
  timeoutSeconds: int("timeoutSeconds").default(60),
  enabled: int("enabled").default(1), // 1 = true, 0 = false
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OllamaConfig = typeof ollamaConfig.$inferSelect;
export type InsertOllamaConfig = typeof ollamaConfig.$inferInsert;

/**
 * Section narratives - stores generated narrative summaries for fact sections
 * Stored in main database, linked to projects via project_db_name
 */
export const sectionNarratives = mysqlTable("section_narratives", {
  id: int("id").autoincrement().primaryKey(),
  projectDbName: varchar("project_db_name", { length: 255 }).notNull(),
  sectionName: varchar("section_name", { length: 255 }).notNull(),
  narrativeText: text("narrative_text").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

export type SectionNarrative = typeof sectionNarratives.$inferSelect;
export type InsertSectionNarrative = typeof sectionNarratives.$inferInsert;