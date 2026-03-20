/**
 * Database initialization
 * mce-workspace has no user or project registry tables —
 * those live in oe_toolkit. This file only ensures the
 * app-level config tables (ollamaConfig) exist.
 */

import { getDb } from "./db";
import { sql } from "drizzle-orm";

export async function initializeDatabase() {
  try {
    console.log("[DB Init] Checking database schema...");
    const db = await getDb();

    // Ensure ollamaConfig table exists
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ollamaConfig (
        id INT AUTO_INCREMENT PRIMARY KEY,
        baseUrl VARCHAR(255) DEFAULT 'http://localhost:11434',
        model VARCHAR(255) DEFAULT 'llama2',
        temperature VARCHAR(10) DEFAULT '0.3',
        topP VARCHAR(10) DEFAULT '0.9',
        timeoutSeconds INT DEFAULT 60,
        enabled INT DEFAULT 1,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log("[DB Init] ✓ Schema ready");
    return true;
  } catch (error) {
    console.error("[DB Init] Failed to initialize database:", error);
    return false;
  }
}
