import mysql from "mysql2/promise";

/**
 * Creates a direct MySQL connection to a project's dedicated database (proj_{id}).
 * Used by accRouter and other server code that needs to write directly to project data.
 */
export async function getProjectDbConnection(projectId: number) {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL environment variable not set");
  }

  // Parse the base connection URL and replace the database name with proj_{id}
  const url = new URL(dbUrl);
  const projectDbName = `proj_${projectId}`;
  url.pathname = `/${projectDbName}`;

  const connection = await mysql.createConnection(url.toString());
  return connection;
}
