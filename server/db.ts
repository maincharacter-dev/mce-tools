/**
 * mce-workspace database connection
 *
 * mce-workspace owns the mce_workspace database.
 * It has NO users table and NO projects table — those live in oe_toolkit.
 * Per-project data is stored in prefixed tables: proj_{id}_documents, etc.
 * App-level config (ollamaConfig) is stored here.
 */

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { ollamaConfig, InsertOllamaConfig, User } from "../drizzle/schema";
import { eq } from "drizzle-orm";

let _pool: mysql.Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

const getDatabaseUrl = () => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  return "mysql://root@127.0.0.1:3306/mce_workspace";
};

export async function getDb() {
  if (!_db) {
    const dbUrl = getDatabaseUrl();
    console.log(`[Database] Connecting to: ${dbUrl.replace(/:\/\/.*@/, "://***@")}`);
    _pool = mysql.createPool(dbUrl);

    try {
      const [rows] = (await _pool.query("SELECT DATABASE() as db")) as any;
      console.log("[Database] Connected to database:", rows[0].db);
    } catch (error) {
      console.error("[Database] Connection test failed:", error);
      throw error;
    }

    _db = drizzle(_pool);
    console.log("[Database] Connected to local MySQL");
  }
  return _db;
}

export async function getPool(): Promise<mysql.Pool> {
  await getDb(); // ensure pool is initialised
  return _pool!;
}

/**
 * Stub — mce-workspace has no users table.
 * These functions exist for OAuth/SDK compatibility but are never called
 * because mce-workspace always runs in LOCAL_AUTH=true mode.
 */
export async function upsertUser(_data: Partial<User> & { openId: string }): Promise<void> {
  // No-op: user management is handled by oe-toolkit
}

export async function getUserByOpenId(_openId: string): Promise<User | null> {
  // No-op: user management is handled by oe-toolkit
  return null;
}

export async function getOllamaConfig() {
  const db = await getDb();
  const result = await db.select().from(ollamaConfig).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateOllamaConfig(config: Partial<InsertOllamaConfig>) {
  const db = await getDb();
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
