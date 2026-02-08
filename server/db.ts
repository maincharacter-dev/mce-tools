import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { InsertUser, users, projects, ollamaConfig, InsertOllamaConfig } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: any = null;

// Force DATABASE_URL to use local MySQL (override Manus TiDB Serverless)
const localMySQLUrl = "mysql://root@127.0.0.1:3306/ingestion_engine_main";
process.env.DATABASE_URL = localMySQLUrl;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db) {
    const pool = mysql.createPool(localMySQLUrl);
    
    // Test the connection and verify database
    try {
      const [rows] = await pool.query('SELECT DATABASE() as db') as any;
      console.log("[Database] Connected to database:", rows[0].db);
      const [tables] = await pool.query('SHOW TABLES') as any;
      console.log("[Database] Available tables:", tables.length);
    } catch (error) {
      console.error("[Database] Connection test failed:", error);
      throw error;
    }
    
    _db = drizzle(pool);
    console.log("[Database] Connected to local MySQL");
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Project Management Queries
 */
export async function createProject(
  name: string,
  description: string | null,
  dbName: string,
  createdByUserId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Create the project record first
  const result = await db.insert(projects).values({
    name,
    description,
    dbName,
    createdByUserId,
  });

  // Get the inserted project ID
  const projectId = Number(result[0].insertId);

  // Provision tables with prefix using standard schema
  const { provisionProjectTables, getTableProvisionConfig } = await import("./project-table-provisioner");
  const config = getTableProvisionConfig(projectId);
  await provisionProjectTables(config);

  console.log(`[DB] Created project ${projectId} with prefixed tables`);

  return result;
}

export async function getProjectById(projectId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getProjectsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    console.log('[DB] Querying projects for user:', userId);
    const result = await db
      .select()
      .from(projects)
      .where(eq(projects.createdByUserId, userId))
      .orderBy(desc(projects.createdAt));
    console.log('[DB] Found projects:', result.length);
    return result;
  } catch (error) {
    console.error('[DB] Error querying projects:', error);
    throw error;
  }
}

export async function getOllamaConfig() {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(ollamaConfig).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateOllamaConfig(config: Partial<InsertOllamaConfig>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getOllamaConfig();
  if (existing) {
    return await db
      .update(ollamaConfig)
      .set(config)
      .where(eq(ollamaConfig.id, existing.id));
  } else {
    return await db.insert(ollamaConfig).values(config as InsertOllamaConfig);
  }
}

// TODO: add feature queries here as your schema grows.
