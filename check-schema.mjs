import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute(`
  SELECT TABLE_NAME, COLUMN_NAME 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME LIKE 'proj_%_processing_jobs'
  ORDER BY TABLE_NAME, ORDINAL_POSITION
`);
const tables = {};
for (const r of rows) {
  if (!tables[r.TABLE_NAME]) tables[r.TABLE_NAME] = [];
  tables[r.TABLE_NAME].push(r.COLUMN_NAME);
}
console.log(JSON.stringify(tables, null, 2));
await conn.end();
