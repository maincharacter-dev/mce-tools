/**
 * TA/TDD Projects Router
 * 
 * Provides endpoints to query projects from the TA/TDD shared database.
 */

import { router, protectedProcedure } from "../_core/trpc";
import mysql from 'mysql2/promise';

/**
 * Get TA/TDD database connection
 */
async function getTaTddDbConnection() {
  const dbUrl = process.env.TA_TDD_DATABASE_URL;
  if (!dbUrl) {
    throw new Error('TA_TDD_DATABASE_URL environment variable not set');
  }

  const url = new URL(dbUrl);
  return await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1), // Remove leading /
    ssl: { rejectUnauthorized: true },
  });
}

export const taTddProjectsRouter = router({
  /**
   * List all projects from TA/TDD database
   */
  list: protectedProcedure.query(async () => {
    const connection = await getTaTddDbConnection();
    
    try {
      const [rows] = await connection.execute(
        `SELECT id, name, description, dbName, createdByUserId, createdAt, updatedAt, status
         FROM projects
         ORDER BY updatedAt DESC`
      );
      
      return rows as Array<{
        id: number;
        name: string;
        description: string | null;
        dbName: string;
        createdByUserId: number;
        createdAt: Date;
        updatedAt: Date;
        status: string | null;
      }>;
    } finally {
      await connection.end();
    }
  }),
});
